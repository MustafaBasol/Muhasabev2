import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Tenant,
  SubscriptionPlan,
  TenantStatus,
} from '../tenants/entities/tenant.entity';

type Interval = 'month' | 'year';

@Injectable()
export class BillingService {
  private stripe: Stripe;

  private readonly priceMap = {
    // Base plans
    PRO: {
      month: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
      year: process.env.STRIPE_PRICE_PRO_YEARLY || '',
    },
    BUSINESS: {
      month: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',
      year: process.env.STRIPE_PRICE_BUSINESS_YEARLY || '',
    },
    // Add-on per user
    ADDON_USER: {
      month: process.env.STRIPE_PRICE_ADDON_USER_MONTHLY || '',
      year: process.env.STRIPE_PRICE_ADDON_USER_YEARLY || '',
    },
  } as const;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16',
    });
  }

  // Her plan için dahil edilen baz kullanıcı sayısı
  private baseIncludedUsers(plan: SubscriptionPlan): number {
    switch (plan) {
      case SubscriptionPlan.PROFESSIONAL:
        return 3; // Pro planda 3 kullanıcı dahildir
      case SubscriptionPlan.ENTERPRISE:
        return 10; // Enterprise için varsayılan 10 (gerekirse ayarlanabilir)
      case SubscriptionPlan.BASIC:
      case SubscriptionPlan.FREE:
      default:
        return 1; // Ücretsiz/Basic planlarda 1 kullanıcı
    }
  }

  private ensurePriceId(id: string, label: string) {
    if (!id)
      throw new InternalServerErrorException(
        `Stripe price id missing for ${label}`,
      );
    return id;
  }

  private toPlanEnum(plan: string): SubscriptionPlan {
    const p = plan.toLowerCase();
    if (p === 'professional' || p === 'pro')
      return SubscriptionPlan.PROFESSIONAL;
    if (p === 'basic' || p === 'starter') return SubscriptionPlan.BASIC;
    if (p === 'enterprise' || p === 'business')
      return SubscriptionPlan.ENTERPRISE;
    return SubscriptionPlan.FREE;
  }

  private fromPlanEnum(plan: SubscriptionPlan): 'PRO' | 'BUSINESS' | null {
    if (plan === SubscriptionPlan.PROFESSIONAL) return 'PRO';
    if (plan === SubscriptionPlan.ENTERPRISE) return 'BUSINESS';
    return null; // FREE/BASIC handled separately or via custom prices later
  }

  async ensureStripeCustomer(
    tenant: Tenant,
    customerEmail?: string,
  ): Promise<string> {
    if (tenant.stripeCustomerId) {
      // Müşteri mevcutsa ve email sağlanmışsa Stripe üzerinde güncelle
      try {
        if (customerEmail) {
          const cust = (await this.stripe.customers.retrieve(
            tenant.stripeCustomerId,
          )) as Stripe.Customer | Stripe.DeletedCustomer;
          if (!('deleted' in cust && cust.deleted)) {
            const currEmail = cust.email || undefined;
            if (
              !currEmail ||
              currEmail.toLowerCase() !== customerEmail.toLowerCase()
            ) {
              await this.stripe.customers.update(tenant.stripeCustomerId, {
                email: customerEmail,
              });
            }
          }
          if (!tenant.email) {
            tenant.email = customerEmail;
            await this.tenantRepo.save(tenant);
          }
        }
      } catch (_) {
        // sessiz geç: email güncellemesi başarısız olsa bile checkout çalışsın
      }
      return tenant.stripeCustomerId;
    }
    const customer = await this.stripe.customers.create({
      name: tenant.companyName || tenant.name,
      email: customerEmail || tenant.email || undefined,
      metadata: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      },
    });
    tenant.stripeCustomerId = customer.id;
    if (!tenant.email && customer.email) tenant.email = customer.email;
    await this.tenantRepo.save(tenant);
    return customer.id;
  }

  async createCheckoutSession(params: {
    tenantId: string;
    plan: SubscriptionPlan | string;
    interval: Interval;
    seats?: number; // paid seats for add-on
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }) {
    const tenant = await this.tenantRepo.findOne({
      where: { id: params.tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Koruma: Mevcut abonelik var ve istenen plan mevcut plan ile aynıysa ama interval değişiyorsa,
    // checkout yerine plan-update endpointini kullanın.
    if (
      tenant.stripeSubscriptionId &&
      tenant.subscriptionPlan &&
      this.fromPlanEnum(this.toPlanEnum(String(params.plan))) &&
      this.toPlanEnum(String(params.plan)) === tenant.subscriptionPlan &&
      tenant.billingInterval && tenant.billingInterval !== params.interval
    ) {
      throw new BadRequestException('Interval değişimi için checkout yerine plan-update kullanılmalıdır.');
    }

    const customerId = await this.ensureStripeCustomer(
      tenant,
      params.customerEmail,
    );
    const planKey = this.fromPlanEnum(this.toPlanEnum(String(params.plan)));
    if (!planKey)
      throw new BadRequestException('Plan not supported for checkout');
    const basePriceId = this.ensurePriceId(
      this.priceMap[planKey][params.interval],
      `${planKey}.${params.interval}`,
    );
    const addOnPriceId = this.ensurePriceId(
      this.priceMap.ADDON_USER[params.interval],
      `ADDON_USER.${params.interval}`,
    );

    const qty = Math.max(0, Math.floor(params.seats ?? 0));

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        { price: basePriceId, quantity: 1 },
        ...(qty > 0 ? [{ price: addOnPriceId, quantity: qty }] : []),
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        tenantId: tenant.id,
        desiredPlan: planKey,
        interval: params.interval,
      },
      subscription_data: {
        metadata: {
          tenantId: tenant.id,
        },
      },
    });

    return { url: session.url, id: session.id };
  }

  /**
   * Mevcut aboneliğin planını ve/veya interval'ını yerinde günceller.
   * Varsayılan: proration oluşturur; chargeNow=true ise proration'ı hemen faturalar ve tahsil etmeye çalışır.
   */
  async updatePlanAndInterval(params: {
    tenantId: string;
    plan: SubscriptionPlan | string;
    interval: Interval;
    seats?: number; // addon kullanıcı sayısı (base dahil değil, sadece ekstra)
    chargeNow?: boolean;
    interactive?: boolean; // true ise invoice send_invoice biçiminde oluşturulur ve otomatik tahsil edilmez (kullanıcı hosted invoice sayfasında öder)
    idempotencyKey?: string;
  }) {
    const tenant = await this.tenantRepo.findOne({ where: { id: params.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeSubscriptionId) throw new BadRequestException('No active subscription to update');
    if (!tenant.stripeCustomerId) throw new BadRequestException('No Stripe customer');

    const desiredEnum = this.toPlanEnum(String(params.plan));
    const desiredPlanKey = this.fromPlanEnum(desiredEnum);
    if (!desiredPlanKey) throw new BadRequestException('Unsupported plan for update');

    const basePriceId = this.ensurePriceId(this.priceMap[desiredPlanKey][params.interval], `${desiredPlanKey}.${params.interval}`);
    const addOnPriceId = this.ensurePriceId(this.priceMap.ADDON_USER[params.interval], `ADDON_USER.${params.interval}`);

    // Mevcut aboneliği çek
    const sub = await this.stripe.subscriptions.retrieve(tenant.stripeSubscriptionId, { expand: ['items'] });
    const addonPriceIds = [this.priceMap.ADDON_USER.month, this.priceMap.ADDON_USER.year].filter(Boolean);
    const baseItem = sub.items.data.find((it) => !addonPriceIds.includes(it.price.id));
    let addonItem = sub.items.data.find((it) => addonPriceIds.includes(it.price.id));
    if (!baseItem) throw new InternalServerErrorException('Base plan item missing on subscription');

    const nextAddonQty = Math.max(0, Math.floor(params.seats ?? (addonItem?.quantity ?? 0)));

    // items dizisini kur: base item yeni fiyatla, addon varsa uygun fiyat ve quantity ile
    const updateItems: Array<{ id: string; price?: string; quantity?: number } & any> = [
      { id: baseItem.id, price: basePriceId },
    ];
    if (addonItem) {
      updateItems.push({ id: addonItem.id, price: addOnPriceId, quantity: nextAddonQty });
    } else {
      // Addon yoksa ve qty > 0 ise oluşturmak için separate call yerine items paramıyla ekleyemiyoruz (id gerekli),
      // bu nedenle önce oluştururuz.
      if (nextAddonQty > 0) {
        addonItem = await this.stripe.subscriptionItems.create({
          subscription: sub.id,
          price: addOnPriceId,
          quantity: nextAddonQty,
          proration_behavior: 'create_prorations',
        });
      }
    }

    // Aboneliği güncelle: faturayı şimdi başlat (billing_cycle_anchor: 'now') ve proration oluştur
    await this.stripe.subscriptions.update(
      sub.id,
      {
        items: updateItems as any,
        billing_cycle_anchor: 'now',
        proration_behavior: 'create_prorations',
        cancel_at_period_end: false,
      },
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey + ':sub' } as any : undefined,
    );

    // Yerel tenant durumunu güncelle
    tenant.subscriptionPlan = desiredEnum;
    tenant.billingInterval = params.interval;
    const baseIncluded = this.baseIncludedUsers(desiredEnum);
    tenant.maxUsers = baseIncluded + (addonItem?.quantity ?? nextAddonQty);
    tenant.cancelAtPeriodEnd = false;
    await this.tenantRepo.save(tenant);

    // Upcoming invoice'ı kontrol et: tutar 0 veya null ise invoice adımını atla
    let upcoming: Stripe.UpcomingInvoice | null = null;
    let upcomingTotal: number | null = null;
    try {
      const resp = (await this.stripe.invoices.retrieveUpcoming({
        customer: tenant.stripeCustomerId!,
        subscription: sub.id,
      })) as Stripe.UpcomingInvoice;
      upcoming = resp;
      upcomingTotal = (resp.total as any) ?? null;
    } catch (_) {}

    // İsteğe bağlı: proration'ı hemen faturala ve tahsil et (yalnızca toplam > 0 ise)
    let invoiceResult: Stripe.Invoice | null = null;
    let invoiceSkipped = false;
    let invoiceError: string | null = null;
    if (params.chargeNow) {
      if (typeof upcomingTotal === 'number' && upcomingTotal <= 0) {
        invoiceSkipped = true;
      } else {
        try {
          const invoice = await this.stripe.invoices.create(
            {
              customer: tenant.stripeCustomerId,
              subscription: sub.id,
              collection_method: params.interactive ? 'send_invoice' : 'charge_automatically',
              ...(params.interactive ? { days_until_due: 7 } : {}),
              auto_advance: false,
            },
            params.idempotencyKey ? { idempotencyKey: params.idempotencyKey + ':inv' } as any : undefined,
          );
          const finalized = await this.stripe.invoices.finalizeInvoice(invoice.id);
          invoiceResult = finalized;
          if (!params.interactive && (finalized.amount_due || 0) > 0 && finalized.status !== 'paid') {
            try {
              invoiceResult = await this.stripe.invoices.pay(finalized.id);
            } catch (payErr: any) {
              // ödeme başarısız olabilir; açık fatura olarak döneriz
              invoiceError = payErr?.message || 'Payment failed';
            }
          }
        } catch (e: any) {
          // Sertleştirme: plan güncellendi ama fatura adımı başarısız olabilir; bilgiyi üst katmana taşıyalım
          invoiceError = e?.message || 'Invoice creation failed';
        }
      }
    }

    return {
      success: true,
      plan: tenant.subscriptionPlan,
      billingInterval: tenant.billingInterval,
      maxUsers: tenant.maxUsers,
      upcomingTotal,
      invoiceSkipped,
      invoiceError,
      invoiceId: invoiceResult?.id ?? null,
      invoiceStatus: invoiceResult?.status ?? null,
      amountDue: (invoiceResult as any)?.amount_due ?? null,
      amountPaid: (invoiceResult as any)?.amount_paid ?? null,
      currency: (invoiceResult as any)?.currency ?? null,
      hostedInvoiceUrl: (invoiceResult as any)?.hosted_invoice_url ?? null,
      pdf: (invoiceResult as any)?.invoice_pdf ?? null,
    };
  }

  /**
   * Mevcut aboneliğe ilave kullanıcı ekler ve prorasyon ile bir sonraki/önümüzdeki fatura önizlemesini döner.
   * Stripe seat artışlarında ayrı bir ödeme ekranı yerine subscription item quantity güncellenir ve
   * ek ücret proration olarak upcoming invoice'a yansır.
   */
  async addAddonUsersProrated(params: { tenantId: string; additional: number }) {
    const { tenantId, additional } = params;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeSubscriptionId) throw new BadRequestException('No active subscription');
    if (additional <= 0) throw new BadRequestException('Additional users must be > 0');

    const sub = await this.stripe.subscriptions.retrieve(tenant.stripeSubscriptionId, { expand: ['items'] });
    const addonPriceIds = [this.priceMap.ADDON_USER.month, this.priceMap.ADDON_USER.year].filter(Boolean);
    let addonItem = sub.items.data.find(it => addonPriceIds.includes(it.price.id));

    // Interval base item üzerinden tespit
    const baseItem = sub.items.data.find(it => !addonPriceIds.includes(it.price.id));
    const interval = baseItem?.price?.recurring?.interval === 'year' ? 'year' : 'month';
    const addOnPriceId = this.ensurePriceId(this.priceMap.ADDON_USER[interval], `ADDON_USER.${interval}`);

    const currentAddonQty = addonItem?.quantity ?? 0;
    const newAddonQty = currentAddonQty + Math.max(0, Math.floor(additional));

    if (!addonItem) {
      addonItem = await this.stripe.subscriptionItems.create({
        subscription: sub.id,
        price: addOnPriceId,
        quantity: newAddonQty,
        proration_behavior: 'create_prorations',
      });
    } else {
      await this.stripe.subscriptionItems.update(addonItem.id, {
        quantity: newAddonQty,
        proration_behavior: 'create_prorations',
      });
    }

    // Tenant maxUsers güncelle
    const base = this.baseIncludedUsers(tenant.subscriptionPlan);
    tenant.maxUsers = base + newAddonQty;
    await this.tenantRepo.save(tenant);

    // Upcoming invoice içindeki PRORATION satırlarını topla (sadece ek ücretleri göster)
    let upcoming: Stripe.UpcomingInvoice | null = null;
    let prorationTotal: number | null = null;
    try {
      const resp = (await this.stripe.invoices.retrieveUpcoming({
        customer: tenant.stripeCustomerId!,
        subscription: tenant.stripeSubscriptionId!,
        expand: ['lines'] as any,
      })) as any;
      upcoming = resp as Stripe.UpcomingInvoice;
      const lines: Array<any> = resp?.lines?.data || [];
      const onlyProrations = lines.filter((l) => !!l?.proration);
      if (onlyProrations.length > 0) {
        prorationTotal = onlyProrations.reduce(
          (sum, l) => sum + (typeof l.amount === 'number' ? l.amount : 0),
          0,
        );
      } else {
        prorationTotal = 0;
      }
    } catch (_) {}

    return {
      success: true,
      newAddonQty,
      maxUsers: tenant.maxUsers,
      upcomingProrationTotal: prorationTotal,
      upcomingCurrency: (upcoming as any)?.currency ?? null,
      upcomingNextInvoiceTotal: (upcoming as any)?.total ?? null,
      upcomingPeriodEnd: (upcoming as any)?.period_end
        ? new Date((upcoming as any).period_end * 1000).toISOString()
        : null,
    };
  }

  async createPortalSession(tenantId: string, returnUrl: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    try {
      const customerId = await this.ensureStripeCustomer(tenant);
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return { url: session.url };
    } catch (e: any) {
      const msg = e?.message || 'Stripe Portal session failed';
      throw new BadRequestException('Portal oturumu oluşturulamadı: ' + msg);
    }
  }

  async listInvoices(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeCustomerId) {
      // Hiç müşteri oluşturulmamışsa fatura yoktur
      return { invoices: [] };
    }
    const invoices = await this.stripe.invoices.list({
      customer: tenant.stripeCustomerId,
      limit: 25,
      expand: ['data.payment_intent'],
    });
    // UI için sadeleştirilmiş veri
    const mapped = invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      currency: inv.currency,
      total: inv.total, // en küçük para birimi (kuruş)
      hostedInvoiceUrl: inv.hosted_invoice_url,
      pdf: inv.invoice_pdf,
      created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      periodStart: inv.period_start
        ? new Date(inv.period_start * 1000).toISOString()
        : null,
      periodEnd: inv.period_end
        ? new Date(inv.period_end * 1000).toISOString()
        : null,
      attemptCount: inv.attempt_count,
      paid: inv.paid,
    }));
    return { invoices: mapped };
  }

  /**
   * İlave kullanıcıları hemen faturalandır: qty'yi artır, proration oluştur, sonra anında invoice oluşturup tahsil et.
   */
  async addAddonUsersAndInvoiceNow(params: { tenantId: string; additional: number }) {
    const { tenantId, additional } = params;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeSubscriptionId) throw new BadRequestException('No active subscription');
    if (!tenant.stripeCustomerId) throw new BadRequestException('No Stripe customer');
    if (additional <= 0) throw new BadRequestException('Additional users must be > 0');

    // 1) Abonelikte add-on miktarını artır (proration oluşsun)
    const sub = await this.stripe.subscriptions.retrieve(tenant.stripeSubscriptionId, { expand: ['items'] });
    const addonPriceIds = [this.priceMap.ADDON_USER.month, this.priceMap.ADDON_USER.year].filter(Boolean);
    let addonItem = sub.items.data.find((it) => addonPriceIds.includes(it.price.id));
    const baseItem = sub.items.data.find((it) => !addonPriceIds.includes(it.price.id));
    const interval: Interval = baseItem?.price?.recurring?.interval === 'year' ? 'year' : 'month';
    const addOnPriceId = this.ensurePriceId(this.priceMap.ADDON_USER[interval], `ADDON_USER.${interval}`);
    const currentAddonQty = addonItem?.quantity ?? 0;
    const newAddonQty = currentAddonQty + Math.max(0, Math.floor(additional));

    if (!addonItem) {
      addonItem = await this.stripe.subscriptionItems.create({
        subscription: sub.id,
        price: addOnPriceId,
        quantity: newAddonQty,
        proration_behavior: 'create_prorations',
      });
    } else {
      await this.stripe.subscriptionItems.update(addonItem.id, {
        quantity: newAddonQty,
        proration_behavior: 'create_prorations',
      });
    }

    // 2) Yerel maxUsers güncelle
    const base = this.baseIncludedUsers(tenant.subscriptionPlan);
    tenant.maxUsers = base + newAddonQty;
    await this.tenantRepo.save(tenant);

    // 3) Bekleyen proration kalemlerini hemen faturala ve tahsil et
    //    Stripe, qty artışı sonrası pending invoice items oluşturur; yeni bir invoice yaratıp finalize+pay yapıyoruz.
    let paid: Stripe.Invoice | null = null;
    try {
      const invoice = await this.stripe.invoices.create({
        customer: tenant.stripeCustomerId,
        subscription: tenant.stripeSubscriptionId,
        collection_method: 'charge_automatically',
        auto_advance: false,
      });
      const finalized = await this.stripe.invoices.finalizeInvoice(invoice.id);
      paid = finalized;
      if ((finalized.amount_due || 0) > 0 && finalized.status !== 'paid') {
        try {
          paid = await this.stripe.invoices.pay(finalized.id);
        } catch (_) {
          // Ödeme başarısız olabilir; faturayı açık olarak döndürürüz
        }
      }
    } catch (e: any) {
      throw new BadRequestException('Anlık faturalandırma başarısız: ' + (e?.message || e));
    }

    return {
      success: true,
      newAddonQty,
      maxUsers: tenant.maxUsers,
      invoiceId: paid?.id ?? null,
      invoiceStatus: paid?.status ?? null,
      amountDue: (paid as any)?.amount_due ?? null,
      amountPaid: (paid as any)?.amount_paid ?? null,
      currency: (paid as any)?.currency ?? null,
      hostedInvoiceUrl: (paid as any)?.hosted_invoice_url ?? null,
      pdf: (paid as any)?.invoice_pdf ?? null,
    };
  }

  async updateSeats(tenantId: string, seats: number) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeSubscriptionId)
      throw new BadRequestException('No active Stripe subscription');

    const sub = await this.stripe.subscriptions.retrieve(
      tenant.stripeSubscriptionId,
    );
    // find add-on item by price matches either monthly or yearly addon
    const addonPriceIds = [
      this.priceMap.ADDON_USER.month,
      this.priceMap.ADDON_USER.year,
    ].filter(Boolean);
    let addonItem = sub.items.data.find((it) =>
      addonPriceIds.includes(it.price.id),
    );

    const nextQty = Math.max(0, Math.floor(seats));
    // Eğer add-on item yoksa yeni bir satır ekle
    if (!addonItem) {
      // Abonelikteki interval'i base item üzerinden belirle
      const baseItem = sub.items.data.find(
        (it) => !addonPriceIds.includes(it.price.id),
      );
      const interval = baseItem?.price?.recurring?.interval === 'year' ? 'year' : 'month';
      const addonPriceId = this.priceMap.ADDON_USER[interval];
      if (!addonPriceId) {
        throw new InternalServerErrorException('Add-on price id missing for interval ' + interval);
      }
      addonItem = (await this.stripe.subscriptionItems.create({
        subscription: sub.id,
        price: addonPriceId,
        quantity: nextQty,
        proration_behavior: 'create_prorations',
      })) as any;
    } else {
      await this.stripe.subscriptionItems.update(addonItem.id, {
        quantity: nextQty,
        proration_behavior: 'create_prorations',
      });
    }

    // Also store seat limit locally
    const base = this.baseIncludedUsers(tenant.subscriptionPlan);
    tenant.maxUsers = Math.max(base, base + nextQty);
    await this.tenantRepo.save(tenant);
    return { success: true, maxUsers: tenant.maxUsers };
  }

  async cancelAtPeriodEnd(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeSubscriptionId)
      throw new BadRequestException('No active Stripe subscription');
    const updated = await this.stripe.subscriptions.update(
      tenant.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      },
    );
    tenant.cancelAtPeriodEnd = true;
    tenant.status = TenantStatus.ACTIVE; // still active until end
    tenant.subscriptionExpiresAt = new Date(updated.current_period_end * 1000);
    await this.tenantRepo.save(tenant);
    return { success: true, currentPeriodEnd: tenant.subscriptionExpiresAt };
  }

  // Called from webhook
  async applySubscriptionUpdateFromStripe(subscription: Stripe.Subscription) {
    const tenantId = (subscription.metadata as any)?.tenantId as
      | string
      | undefined;
    // Fallback: try from customer metadata
    let tenant: Tenant | null = null;
    if (tenantId) {
      tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    } else if (subscription.customer) {
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
      tenant = await this.tenantRepo.findOne({
        where: { stripeCustomerId: customerId },
      });
    }
    if (!tenant) return; // unknown tenant; ignore silently

    // Determine interval from plan item
    const interval = subscription.items.data.find((it) => it.price.recurring)
      ?.price.recurring?.interval as Interval | undefined;
    // Determine seat qty from addon item
    const addonPriceIds = [
      this.priceMap.ADDON_USER.month,
      this.priceMap.ADDON_USER.year,
    ].filter(Boolean);
    const addonItem = subscription.items.data.find((it) =>
      addonPriceIds.includes(it.price.id),
    );
    const seats = addonItem?.quantity ?? 0;

    // Map base plan price to app plan
    const baseItem = subscription.items.data.find(
      (it) => !addonPriceIds.includes(it.price.id),
    );
    const basePriceId = baseItem?.price.id || '';
    let nextPlan = tenant.subscriptionPlan;
    if (
      basePriceId === this.priceMap.PRO.month ||
      basePriceId === this.priceMap.PRO.year
    ) {
      nextPlan = SubscriptionPlan.PROFESSIONAL;
    } else if (
      basePriceId === this.priceMap.BUSINESS.month ||
      basePriceId === this.priceMap.BUSINESS.year
    ) {
      nextPlan = SubscriptionPlan.ENTERPRISE;
    }

    tenant.subscriptionPlan = nextPlan;
    tenant.stripeSubscriptionId = subscription.id;
    tenant.billingInterval = interval || null;
    tenant.status =
      subscription.status === 'active' || subscription.status === 'trialing'
        ? TenantStatus.ACTIVE
        : TenantStatus.SUSPENDED;
    tenant.cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
    if (subscription.current_period_end) {
      tenant.subscriptionExpiresAt = new Date(
        subscription.current_period_end * 1000,
      );
    }
    // Baz kullanıcı + eklenti koltukları
    const base = this.baseIncludedUsers(nextPlan);
    tenant.maxUsers = base + Math.max(0, seats ?? 0);

    await this.tenantRepo.save(tenant);
  }

  async listHistory(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const events: Array<{
      type: string;
      at?: string;
      plan?: string;
      users?: number;
      amount?: number;
      currency?: string;
    }> = [];

    if (tenant.subscriptionPlan) {
      events.push({
        type: 'plan.current',
        plan: tenant.subscriptionPlan,
        at: tenant.updatedAt?.toISOString?.(),
      });
    }
    if (tenant.subscriptionExpiresAt) {
      const at =
        tenant.subscriptionExpiresAt instanceof Date
          ? tenant.subscriptionExpiresAt.toISOString()
          : new Date(tenant.subscriptionExpiresAt as any).toISOString();
      events.push({ type: 'plan.renewal_due', at });
    }
    if (tenant.cancelAtPeriodEnd) {
      events.push({
        type: 'cancel.at_period_end',
        at: tenant.updatedAt?.toISOString?.(),
      });
    }

    if (tenant.stripeCustomerId) {
      const invs = await this.stripe.invoices.list({
        customer: tenant.stripeCustomerId,
        limit: 20,
      });
      for (const inv of invs.data) {
        const at = inv.created
          ? new Date(inv.created * 1000).toISOString()
          : undefined;
        const evtType = inv.paid
          ? 'invoice.paid'
          : inv.status === 'open' || inv.status === 'draft'
            ? 'invoice.open'
            : inv.status === 'uncollectible' || inv.status === 'void'
              ? 'invoice.uncollectible'
              : inv.status === 'paid'
                ? 'invoice.paid'
                : inv.status === 'unpaid'
                  ? 'invoice.payment_failed'
                  : `invoice.${inv.status}`;
        events.push({
          type: evtType,
          at,
          amount: inv.total || undefined,
          currency: inv.currency || undefined,
        });
      }
    }

    // Tarihe göre sırala (en yeni üstte)
    events.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return tb - ta;
    });

    return { success: true, events };
  }

  /**
   * Manuel senkron: Stripe'tan ilgili müşteri için aboneliği çekip yerel tenant kaydını günceller.
   * Webhook ulaşamadığında (ör. local dev) başarı sonrası çağırmak için kullanılır.
   */
  async syncFromStripe(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeCustomerId) {
      return { success: false, message: 'Stripe müşteri bulunamadı' };
    }

    const subs = await this.stripe.subscriptions.list({
      customer: tenant.stripeCustomerId,
      status: 'all',
      limit: 20,
      expand: ['data.items'],
    });
    if (!subs.data || subs.data.length === 0) {
      return { success: true, updated: false };
    }

    // En uygun aboneliği seç: aktif/deneme öncelikli, yoksa en son oluşturulan
    const preferredStatuses = new Set<Stripe.Subscription.Status>([
      'active',
      'trialing',
      'past_due',
      'unpaid',
      'incomplete',
    ]);
    const sorted = [...subs.data].sort(
      (a, b) => (b.created || 0) - (a.created || 0),
    );
    const sub =
      sorted.find((s) => preferredStatuses.has(s.status)) || sorted[0];

    await this.applySubscriptionUpdateFromStripe(sub);
    const updated = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return {
      success: true,
      updated: true,
      plan: updated?.subscriptionPlan ?? null,
      billingInterval: updated?.billingInterval ?? null,
      maxUsers: updated?.maxUsers ?? null,
      cancelAtPeriodEnd: updated?.cancelAtPeriodEnd ?? null,
      subscriptionExpiresAt: updated?.subscriptionExpiresAt ?? null,
    };
  }
}

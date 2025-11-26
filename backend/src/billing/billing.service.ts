import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  Logger,
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

export interface InvoiceSummary {
  id: string;
  number: string | null;
  total: number;
  currency: string | null;
  created: string | null;
}

export type ZeroInvoiceReason = 'PLAN_CHANGE_NO_CHARGE' | 'ZERO_TOTAL';

export interface ZeroInvoiceSummary {
  id: string;
  number: string | null;
  reason: ZeroInvoiceReason;
  created: string | null;
}

export interface UpgradeStatusSummary {
  success: true;
  subscriptionPlan: SubscriptionPlan | null;
  billingInterval: string | null;
  maxUsers: number | null;
  latestPaidInvoice: InvoiceSummary | null;
  zeroInvoice: ZeroInvoiceSummary | null;
  cancelAtPeriodEnd: boolean;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
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

  // Son sync isteklerini hafifletmek için basit in-memory throttle
  private lastSyncCheck: Map<string, number> = new Map();

  /** Upgrade sonrası hızlı durum: plan güncellendi mi, son ücretli fatura nedir, sıfır tutarlı açıklama */
  async getUpgradeStatus(tenantId: string): Promise<UpgradeStatusSummary> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const plan = tenant.subscriptionPlan || null;
    const interval = tenant.billingInterval || null;
    const maxUsers = tenant.maxUsers ?? null;
    let latestPaid: InvoiceSummary | null = null;
    let zeroInvoice: ZeroInvoiceSummary | null = null;
    if (tenant.stripeCustomerId) {
      try {
        const invoices = await this.stripe.invoices.list({
          customer: tenant.stripeCustomerId,
          limit: 10,
          expand: ['data.lines'],
        });
        for (const inv of invoices.data) {
          const total = inv.total ?? 0;
          if (total > 0 && !latestPaid) {
            latestPaid = {
              id: inv.id,
              number: inv.number,
              total,
              currency: inv.currency,
              created: this.formatStripeDate(inv.created),
            };
          }
          if (total === 0 && !zeroInvoice) {
            const lines = this.extractInvoiceLines(inv);
            const onlyProration =
              lines.length > 0 &&
              lines.every((line) => Boolean(line.proration));
            zeroInvoice = {
              id: inv.id,
              number: inv.number,
              reason: onlyProration ? 'PLAN_CHANGE_NO_CHARGE' : 'ZERO_TOTAL',
              created: this.formatStripeDate(inv.created),
            };
          }
          if (latestPaid && zeroInvoice) break; // erken çık
        }
      } catch (error: unknown) {
        this.logger.warn(
          `Stripe invoices fetch failed for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return {
      success: true,
      subscriptionPlan: plan,
      billingInterval: interval,
      maxUsers,
      latestPaidInvoice: latestPaid,
      zeroInvoice,
      cancelAtPeriodEnd: tenant.cancelAtPeriodEnd || false,
    };
  }

  // Her plan için dahil edilen baz kullanıcı sayısı
  private baseIncludedUsers(plan: SubscriptionPlan): number {
    switch (plan) {
      case SubscriptionPlan.PROFESSIONAL:
        return 3; // Pro planda 3 kullanıcı dahildir
      case SubscriptionPlan.ENTERPRISE:
        return 10; // Business (Enterprise) planda 10 kullanıcı dahildir
      case SubscriptionPlan.BASIC:
      case SubscriptionPlan.FREE:
      default:
        return 1; // Ücretsiz/Basic planlarda 1 kullanıcı
    }
  }

  private isUnlimitedPlan(_plan: SubscriptionPlan): boolean {
    return false; // Artık hiçbir plan sınırsız değil; koltuklar baz + addon ile belirlenir
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
    if (p === 'basic') return SubscriptionPlan.BASIC; // legacy
    if (p === 'starter' || p === 'free') return SubscriptionPlan.FREE;
    if (p === 'enterprise' || p === 'business')
      return SubscriptionPlan.ENTERPRISE;
    return SubscriptionPlan.FREE;
  }

  private fromPlanEnum(plan: SubscriptionPlan): 'PRO' | 'BUSINESS' | null {
    if (plan === SubscriptionPlan.PROFESSIONAL) return 'PRO';
    if (plan === SubscriptionPlan.ENTERPRISE) return 'BUSINESS';
    return null; // FREE/BASIC handled separately or via custom prices later
  }

  private extractInvoiceLines(
    invoice: Stripe.Invoice,
  ): Stripe.InvoiceLineItem[] {
    if (Array.isArray(invoice.lines?.data)) {
      return invoice.lines.data;
    }
    return [];
  }

  private formatStripeDate(timestamp?: number | null): string | null {
    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
      return new Date(timestamp * 1000).toISOString();
    }
    return null;
  }

  private buildIdempotencyOptions(
    key?: string,
    suffix = '',
  ): Stripe.RequestOptions | undefined {
    if (!key) {
      return undefined;
    }
    return { idempotencyKey: `${key}${suffix}` };
  }

  private extractInvoiceAmount(invoice: Stripe.Invoice | null): number | null {
    if (!invoice) {
      return null;
    }
    if (typeof invoice.amount_paid === 'number' && invoice.amount_paid > 0) {
      return invoice.amount_paid;
    }
    if (typeof invoice.amount_due === 'number' && invoice.amount_due > 0) {
      return invoice.amount_due;
    }
    if (typeof invoice.total === 'number' && invoice.total > 0) {
      return invoice.total;
    }
    return invoice.amount_paid ?? invoice.amount_due ?? invoice.total ?? null;
  }

  private errorMessage(error: unknown, fallback = 'Unexpected error'): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }
    return fallback;
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
      } catch (error: unknown) {
        this.logger.warn(
          `Stripe customer metadata sync skipped for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
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
      tenant.billingInterval &&
      tenant.billingInterval !== params.interval
    ) {
      throw new BadRequestException(
        'Interval değişimi için checkout yerine plan-update kullanılmalıdır.',
      );
    }

    const customerId = await this.ensureStripeCustomer(
      tenant,
      params.customerEmail,
    );
    const planKey = this.fromPlanEnum(this.toPlanEnum(String(params.plan)));
    if (!planKey)
      throw new BadRequestException('Plan not supported for checkout');

    // Eğer aktif bir Stripe aboneliği varsa ve hedef plan mevcut ücretli plandan farklıysa
    // yeni bir checkout yerine plan-update endpointi kullanılmalı. Aksi halde çift abonelik oluşur.
    if (
      tenant.stripeSubscriptionId &&
      tenant.subscriptionPlan &&
      ['PROFESSIONAL', 'ENTERPRISE'].includes(
        String(tenant.subscriptionPlan),
      ) &&
      this.toPlanEnum(String(params.plan)) !== tenant.subscriptionPlan
    ) {
      throw new BadRequestException(
        'Mevcut bir aboneliğiniz var; plan değişimi için /billing/{tenantId}/plan-update kullanılmalıdır.',
      );
    }
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
    const tenant = await this.tenantRepo.findOne({
      where: { id: params.tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeSubscriptionId)
      throw new BadRequestException('No active subscription to update');
    if (!tenant.stripeCustomerId)
      throw new BadRequestException('No Stripe customer');

    const desiredEnum = this.toPlanEnum(String(params.plan));
    const desiredPlanKey = this.fromPlanEnum(desiredEnum);
    if (!desiredPlanKey)
      throw new BadRequestException('Unsupported plan for update');

    const basePriceId = this.ensurePriceId(
      this.priceMap[desiredPlanKey][params.interval],
      `${desiredPlanKey}.${params.interval}`,
    );
    const addOnPriceId = this.ensurePriceId(
      this.priceMap.ADDON_USER[params.interval],
      `ADDON_USER.${params.interval}`,
    );

    // Mevcut aboneliği çek
    const sub = await this.stripe.subscriptions.retrieve(
      tenant.stripeSubscriptionId,
      { expand: ['items'] },
    );
    const addonPriceIds = [
      this.priceMap.ADDON_USER.month,
      this.priceMap.ADDON_USER.year,
    ].filter(Boolean);
    const baseItem = sub.items.data.find(
      (it) => !addonPriceIds.includes(it.price.id),
    );
    let addonItem = sub.items.data.find((it) =>
      addonPriceIds.includes(it.price.id),
    );
    if (!baseItem)
      throw new InternalServerErrorException(
        'Base plan item missing on subscription',
      );

    // ===== Koltuk migrasyonu mantığı =====
    // Amaç: Plan değişiminde (ör. PRO -> BUSINESS) addon qty otomatik yeniden hesaplanmalı.
    // Senaryolar:
    // 1) Kullanıcı Pro (3 baz) + 2 addon (toplam 5) iken Business (10 baz) planına geçerse ==> addon = 0 (çünkü 10 baz yeterli).
    // 2) Kullanıcı Pro (3 baz) + 12 addon (toplam 15) -> Business (10 baz) ==> addon = 5 (15 - 10).
    // 3) Business -> Pro downgrade: ör. Business 10 baz + 4 addon (14 toplam) -> Pro 3 baz ==> addon = 11 (14 - 3) (mevcut koltukları koru).
    // 4) Kullanıcı seats paramı gönderirse (explicit) bu değer override eder (manuel kontrol).

    const oldPlanEnum = tenant.subscriptionPlan;
    const oldBaseIncluded = this.baseIncludedUsers(oldPlanEnum);
    const oldAddonQty = addonItem?.quantity ?? 0;
    const prevTotalSeats = oldBaseIncluded + oldAddonQty;
    const newBaseIncluded = this.baseIncludedUsers(desiredEnum);
    const planChanged = oldPlanEnum !== desiredEnum;

    let nextAddonQty: number;
    if (typeof params.seats === 'number') {
      // Explicit istekte gönderilen addon qty (yalnızca ekstra koltuklar)
      nextAddonQty = Math.max(0, Math.floor(params.seats));
    } else if (planChanged) {
      // Otomatik migrasyon: Mevcut toplam koltukları koru, yeni baz dahil koltukları düş.
      const computed = prevTotalSeats - newBaseIncluded;
      nextAddonQty = Math.max(0, computed);
    } else {
      // Plan değişmedi; mevcut addon qty'yi koru.
      nextAddonQty = oldAddonQty;
    }

    // items dizisini kur: base item yeni fiyatla, addon varsa uygun fiyat ve quantity ile
    const updateItems: Stripe.SubscriptionUpdateParams.Item[] = [
      { id: baseItem.id, price: basePriceId },
    ];
    if (addonItem) {
      updateItems.push({
        id: addonItem.id,
        price: addOnPriceId,
        quantity: nextAddonQty,
      });
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
        items: updateItems,
        billing_cycle_anchor: 'now',
        proration_behavior: 'create_prorations',
        cancel_at_period_end: false,
      },
      this.buildIdempotencyOptions(params.idempotencyKey, ':sub'),
    );

    // Yerel tenant durumunu güncelle
    tenant.subscriptionPlan = desiredEnum;
    tenant.billingInterval = params.interval;
    if (this.isUnlimitedPlan(desiredEnum)) {
      tenant.maxUsers = -1; // sınırsız
    } else {
      const baseIncluded = this.baseIncludedUsers(desiredEnum);
      tenant.maxUsers = baseIncluded + (addonItem?.quantity ?? nextAddonQty);
    }
    tenant.cancelAtPeriodEnd = false;
    await this.tenantRepo.save(tenant);

    // Upcoming invoice'ı kontrol et: tutar 0 veya null ise invoice adımını atla
    let upcomingTotal: number | null = null;
    try {
      const resp = await this.stripe.invoices.retrieveUpcoming({
        customer: tenant.stripeCustomerId,
        subscription: sub.id,
      });
      upcomingTotal = resp.total ?? null;
    } catch (error: unknown) {
      this.logger.warn(
        `Stripe upcoming invoice preview failed for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

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
              collection_method: params.interactive
                ? 'send_invoice'
                : 'charge_automatically',
              ...(params.interactive ? { days_until_due: 7 } : {}),
              auto_advance: false,
            },
            this.buildIdempotencyOptions(params.idempotencyKey, ':inv'),
          );
          const finalized = await this.stripe.invoices.finalizeInvoice(
            invoice.id,
          );
          invoiceResult = finalized;
          if (
            !params.interactive &&
            (finalized.amount_due || 0) > 0 &&
            finalized.status !== 'paid'
          ) {
            try {
              invoiceResult = await this.stripe.invoices.pay(finalized.id);
            } catch (payErr: unknown) {
              invoiceError = this.errorMessage(payErr, 'Payment failed');
              this.logger.warn(
                `Stripe invoice payment attempt failed for tenant ${tenant.id}: ${invoiceError}`,
              );
            }
          }
        } catch (e: unknown) {
          // Sertleştirme: plan güncellendi ama fatura adımı başarısız olabilir; bilgiyi üst katmana taşıyalım
          invoiceError = this.errorMessage(e, 'Invoice creation failed');
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
      amountDue: invoiceResult?.amount_due ?? null,
      amountPaid: invoiceResult?.amount_paid ?? null,
      currency: invoiceResult?.currency ?? null,
      hostedInvoiceUrl: invoiceResult?.hosted_invoice_url ?? null,
      pdf: invoiceResult?.invoice_pdf ?? null,
    };
  }

  /**
   * Mevcut aboneliğe ilave kullanıcı ekler ve prorasyon ile bir sonraki/önümüzdeki fatura önizlemesini döner.
   * Stripe seat artışlarında ayrı bir ödeme ekranı yerine subscription item quantity güncellenir ve
   * ek ücret proration olarak upcoming invoice'a yansır.
   */
  async addAddonUsersProrated(params: {
    tenantId: string;
    additional: number;
  }) {
    const { tenantId, additional } = params;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeSubscriptionId)
      throw new BadRequestException('No active subscription');
    if (additional <= 0)
      throw new BadRequestException('Additional users must be > 0');

    const sub = await this.stripe.subscriptions.retrieve(
      tenant.stripeSubscriptionId,
      { expand: ['items'] },
    );
    const addonPriceIds = [
      this.priceMap.ADDON_USER.month,
      this.priceMap.ADDON_USER.year,
    ].filter(Boolean);
    let addonItem = sub.items.data.find((it) =>
      addonPriceIds.includes(it.price.id),
    );

    // Interval base item üzerinden tespit
    const baseItem = sub.items.data.find(
      (it) => !addonPriceIds.includes(it.price.id),
    );
    const interval =
      baseItem?.price?.recurring?.interval === 'year' ? 'year' : 'month';
    const addOnPriceId = this.ensurePriceId(
      this.priceMap.ADDON_USER[interval],
      `ADDON_USER.${interval}`,
    );

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
    if (this.isUnlimitedPlan(tenant.subscriptionPlan)) {
      tenant.maxUsers = -1;
    } else {
      const base = this.baseIncludedUsers(tenant.subscriptionPlan);
      tenant.maxUsers = base + newAddonQty;
    }
    await this.tenantRepo.save(tenant);

    // Upcoming invoice içindeki PRORATION satırlarını topla (sadece ek ücretleri göster)
    let upcoming: Stripe.UpcomingInvoice | null = null;
    let prorationTotal: number | null = null;
    try {
      const resp = await this.stripe.invoices.retrieveUpcoming({
        customer: tenant.stripeCustomerId!,
        subscription: tenant.stripeSubscriptionId,
        expand: ['lines'],
      });
      upcoming = resp;
      const lines = resp.lines?.data ?? [];
      const prorationLines = lines.filter((line) => Boolean(line.proration));
      if (prorationLines.length > 0) {
        prorationTotal = prorationLines.reduce(
          (sum, line) => sum + (line.amount ?? 0),
          0,
        );
      } else {
        prorationTotal = 0;
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Stripe upcoming invoice fetch failed while adding addon users for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      success: true,
      newAddonQty,
      maxUsers: tenant.maxUsers,
      upcomingProrationTotal: prorationTotal,
      upcomingCurrency: upcoming?.currency ?? null,
      upcomingNextInvoiceTotal: upcoming?.total ?? null,
      upcomingPeriodEnd: upcoming?.period_end
        ? new Date(upcoming.period_end * 1000).toISOString()
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
    } catch (e: unknown) {
      const msg = this.errorMessage(e, 'Stripe Portal session failed');
      throw new BadRequestException('Portal oturumu oluşturulamadı: ' + msg);
    }
  }

  async listInvoices(tenantId: string) {
    let tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      // Bazı çağrılarda slug gönderilmiş olabilir: slug ile tekrar dene
      tenant = await this.tenantRepo.findOne({ where: { slug: tenantId } });
    }
    if (!tenant) throw new NotFoundException('Tenant not found');
    // Otomatik müşteri oluştur (fatura geçmişi talep edildiğinde) böylece ilk upgrade öncesi bile müşteri kaydı oluşsun
    if (!tenant.stripeCustomerId) {
      try {
        const created = await this.ensureStripeCustomer(tenant);
        tenant.stripeCustomerId = created;
        await this.tenantRepo.save(tenant);
      } catch (error: unknown) {
        this.logger.warn(
          `Stripe customer bootstrap failed during invoice listing for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return { invoices: [] };
      }
    }
    const invoices = await this.stripe.invoices.list({
      customer: tenant.stripeCustomerId,
      limit: 25,
      expand: ['data.payment_intent', 'data.lines'],
    });
    // UI için sadeleştirilmiş veri
    const mapped = invoices.data.map((inv) => {
      const total = inv.total || 0;
      const zero = total === 0;
      // Basit açıklama: sıfır tutarlı ise plan değişimi veya ücretsiz proration olabilir
      let hint: string | null = null;
      if (zero) {
        // İçerikte sadece proration kalemi ve amount=0 ise ekstra vurgula
        const lines = this.extractInvoiceLines(inv);
        const onlyProration =
          lines.length > 0 && lines.every((l) => !!l.proration);
        hint = onlyProration ? 'PLAN_CHANGE_NO_CHARGE' : 'ZERO_TOTAL';
      }
      return {
        id: inv.id,
        number: inv.number,
        status: inv.status,
        currency: inv.currency,
        total, // minor units
        hostedInvoiceUrl: inv.hosted_invoice_url,
        pdf: inv.invoice_pdf,
        created: inv.created
          ? new Date(inv.created * 1000).toISOString()
          : null,
        periodStart: inv.period_start
          ? new Date(inv.period_start * 1000).toISOString()
          : null,
        periodEnd: inv.period_end
          ? new Date(inv.period_end * 1000).toISOString()
          : null,
        attemptCount: inv.attempt_count,
        paid: inv.paid,
        zeroTotal: zero,
        reasonHint: hint,
      };
    });
    return { invoices: mapped };
  }

  /**
   * İlave kullanıcıları hemen faturalandır: qty'yi artır, proration oluştur, sonra anında invoice oluşturup tahsil et.
   */
  async addAddonUsersAndInvoiceNow(params: {
    tenantId: string;
    additional: number;
  }) {
    const { tenantId, additional } = params;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeSubscriptionId)
      throw new BadRequestException('No active subscription');
    if (!tenant.stripeCustomerId)
      throw new BadRequestException('No Stripe customer');
    if (additional <= 0)
      throw new BadRequestException('Additional users must be > 0');

    // 1) Abonelikte add-on miktarını artır (proration oluşsun)
    const sub = await this.stripe.subscriptions.retrieve(
      tenant.stripeSubscriptionId,
      { expand: ['items'] },
    );
    const addonPriceIds = [
      this.priceMap.ADDON_USER.month,
      this.priceMap.ADDON_USER.year,
    ].filter(Boolean);
    let addonItem = sub.items.data.find((it) =>
      addonPriceIds.includes(it.price.id),
    );
    const baseItem = sub.items.data.find(
      (it) => !addonPriceIds.includes(it.price.id),
    );
    const interval: Interval =
      baseItem?.price?.recurring?.interval === 'year' ? 'year' : 'month';
    const addOnPriceId = this.ensurePriceId(
      this.priceMap.ADDON_USER[interval],
      `ADDON_USER.${interval}`,
    );
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
    if (this.isUnlimitedPlan(tenant.subscriptionPlan)) {
      tenant.maxUsers = -1;
    } else {
      const base = this.baseIncludedUsers(tenant.subscriptionPlan);
      tenant.maxUsers = base + newAddonQty;
    }
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
        } catch (error: unknown) {
          this.logger.warn(
            `Stripe immediate payment failed for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (e: unknown) {
      throw new BadRequestException(
        'Anlık faturalandırma başarısız: ' + this.errorMessage(e),
      );
    }

    const amountMinor = this.extractInvoiceAmount(paid);

    return {
      success: true,
      newAddonQty,
      maxUsers: tenant.maxUsers,
      invoiceId: paid?.id ?? null,
      invoiceStatus: paid?.status ?? null,
      amountDue: paid?.amount_due ?? null,
      amountPaid: amountMinor,
      currency: paid?.currency ?? null,
      hostedInvoiceUrl: paid?.hosted_invoice_url ?? null,
      pdf: paid?.invoice_pdf ?? null,
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
      const interval =
        baseItem?.price?.recurring?.interval === 'year' ? 'year' : 'month';
      const addonPriceId = this.priceMap.ADDON_USER[interval];
      if (!addonPriceId) {
        throw new InternalServerErrorException(
          'Add-on price id missing for interval ' + interval,
        );
      }
      addonItem = await this.stripe.subscriptionItems.create({
        subscription: sub.id,
        price: addonPriceId,
        quantity: nextQty,
        proration_behavior: 'create_prorations',
      });
    } else {
      await this.stripe.subscriptionItems.update(addonItem.id, {
        quantity: nextQty,
        proration_behavior: 'create_prorations',
      });
    }

    // Also store seat limit locally
    if (this.isUnlimitedPlan(tenant.subscriptionPlan)) {
      tenant.maxUsers = -1;
    } else {
      const base = this.baseIncludedUsers(tenant.subscriptionPlan);
      tenant.maxUsers = Math.max(base, base + nextQty);
    }
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

  // Abonelik iptalini geri al (period end'de iptal bayrağını kaldır)
  async resumeCancellation(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.stripeSubscriptionId)
      throw new BadRequestException('No active Stripe subscription');
    const updated = await this.stripe.subscriptions.update(
      tenant.stripeSubscriptionId,
      { cancel_at_period_end: false },
    );
    tenant.cancelAtPeriodEnd = false;
    // current_period_end değişmeden kalabilir; yine de güncelleyelim
    if (updated.current_period_end) {
      tenant.subscriptionExpiresAt = new Date(
        updated.current_period_end * 1000,
      );
    }
    await this.tenantRepo.save(tenant);
    return {
      success: true,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: tenant.subscriptionExpiresAt,
    };
  }

  // Called from webhook
  async applySubscriptionUpdateFromStripe(subscription: Stripe.Subscription) {
    const tenantId =
      typeof subscription.metadata?.tenantId === 'string'
        ? subscription.metadata.tenantId
        : undefined;
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
    if (this.isUnlimitedPlan(nextPlan)) {
      tenant.maxUsers = -1;
    } else {
      const base = this.baseIncludedUsers(nextPlan);
      tenant.maxUsers = base + Math.max(0, seats ?? 0);
    }

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
      const expiry =
        tenant.subscriptionExpiresAt instanceof Date
          ? tenant.subscriptionExpiresAt
          : new Date(tenant.subscriptionExpiresAt);
      const at = expiry.toISOString();
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
          plan: tenant.subscriptionPlan || undefined,
          users: tenant.maxUsers || undefined,
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

    // Throttle: son 5 sn içinde sync yapıldıysa hızlı exit
    const now = Date.now();
    const prev = this.lastSyncCheck.get(tenantId) || 0;
    if (now - prev < 5000) {
      return { success: true, updated: false, throttled: true };
    }
    this.lastSyncCheck.set(tenantId, now);

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

  /**
   * Admin için ham abonelik verilerini döndür: subscription items (id, price, quantity) ve hesaplanan koltuk sayısı.
   */
  async getSubscriptionRaw(tenantId: string) {
    let tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      // slug fallback
      tenant = await this.tenantRepo.findOne({ where: { slug: tenantId } });
    }
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Aboneliği seç
    let sub: Stripe.Subscription | null = null;
    if (tenant.stripeSubscriptionId) {
      try {
        sub = (await this.stripe.subscriptions.retrieve(
          tenant.stripeSubscriptionId,
          { expand: ['items'] },
        )) as Stripe.Subscription;
      } catch (error: unknown) {
        this.logger.warn(
          `Stripe subscription retrieve failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        sub = null;
      }
    }
    if (!sub && tenant.stripeCustomerId) {
      const list = await this.stripe.subscriptions.list({
        customer: tenant.stripeCustomerId,
        status: 'all',
        limit: 20,
        expand: ['data.items'],
      });
      if (list.data && list.data.length > 0) {
        const preferred = new Set<Stripe.Subscription.Status>([
          'active',
          'trialing',
          'past_due',
          'unpaid',
          'incomplete',
        ]);
        const sorted = [...list.data].sort(
          (a, b) => (b.created || 0) - (a.created || 0),
        );
        sub = sorted.find((s) => preferred.has(s.status)) || sorted[0] || null;
      }
    }

    if (!sub) {
      return {
        subscriptionId: null,
        status: null,
        interval: null,
        items: [],
        baseIncluded: this.baseIncludedUsers(tenant.subscriptionPlan),
        addonQty: 0,
        computedSeats: this.baseIncludedUsers(tenant.subscriptionPlan),
        plan: tenant.subscriptionPlan,
      };
    }

    const addonPriceIds = [
      this.priceMap.ADDON_USER.month,
      this.priceMap.ADDON_USER.year,
    ].filter(Boolean);
    const items = sub.items.data.map((it) => ({
      id: it.id,
      priceId: it.price.id,
      quantity: it.quantity ?? 0,
      interval: it.price?.recurring?.interval ?? null,
      product:
        typeof it.price.product === 'string'
          ? it.price.product
          : (it.price.product?.id ?? null),
    }));
    const baseItem = sub.items.data.find(
      (it) => !addonPriceIds.includes(it.price.id),
    );
    const addonItem = sub.items.data.find((it) =>
      addonPriceIds.includes(it.price.id),
    );
    const interval =
      baseItem?.price?.recurring?.interval === 'year' ? 'year' : 'month';

    // Planı base price id üzerinden tahmin et
    const basePriceId = baseItem?.price.id || '';
    let plan = tenant.subscriptionPlan;
    if (
      basePriceId === this.priceMap.PRO.month ||
      basePriceId === this.priceMap.PRO.year
    ) {
      plan = SubscriptionPlan.PROFESSIONAL;
    } else if (
      basePriceId === this.priceMap.BUSINESS.month ||
      basePriceId === this.priceMap.BUSINESS.year
    ) {
      plan = SubscriptionPlan.ENTERPRISE;
    }

    const baseIncluded = this.baseIncludedUsers(plan);
    const addonQty = addonItem?.quantity ?? 0;
    const computedSeats = this.isUnlimitedPlan(plan)
      ? -1
      : baseIncluded + Math.max(0, addonQty);

    return {
      subscriptionId: sub.id,
      status: sub.status,
      interval,
      items,
      baseIncluded: this.isUnlimitedPlan(plan) ? -1 : baseIncluded,
      addonQty: this.isUnlimitedPlan(plan) ? -1 : addonQty,
      computedSeats,
      plan,
    };
  }
}

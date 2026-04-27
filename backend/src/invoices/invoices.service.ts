import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, FindOptionsWhere, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { DeepPartial } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Customer } from '../customers/entities/customer.entity';
import { TenantPlanLimitService } from '../common/tenant-plan-limits.service';
import { Sale, SaleStatus } from '../sales/entities/sale.entity';
import { Product } from '../products/entities/product.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceLineItemInput,
  InvoiceStatistics,
  InvoiceSellerSnapshot,
  InvoiceBuyerSnapshot,
} from './dto/invoice.dto';

import {
  EINVOICE_QUEUE,
  EINVOICE_JOB,
} from '../integrations/common/queues/einvoice-queue.constants';
import { ProviderAccountService } from '../integrations/common/services/provider-account.service';
import { PROVIDER_KEYS, ProviderConnectionStatus } from '../integrations/common/types/integration.types';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private linesRepository: Repository<InvoiceLine>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductCategory)
    private categoriesRepository: Repository<ProductCategory>,
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    private dataSource: DataSource,
    @Optional() @InjectQueue(EINVOICE_QUEUE)
    private readonly einvoiceQueue: Queue | null,
    @Optional()
    private readonly providerAccountService: ProviderAccountService | null,
  ) {}

  private normalizeTaxRate(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'boolean') {
      return null;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) {
        return null;
      }
      return Math.round(value * 100) / 100;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric) || numeric < 0) {
        return null;
      }
      return Math.round(numeric * 100) / 100;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return null;
    }
    return Math.round(numeric * 100) / 100;
  }

  private logStockUpdateFailure(
    event: string,
    error: unknown,
    level: 'warn' | 'error' = 'warn',
  ) {
    const message = `${event}: ${error instanceof Error ? error.message : String(error)}`;
    const stack = error instanceof Error ? error.stack : undefined;
    if (level === 'error') {
      this.logger.error(message, stack);
      return;
    }
    this.logger.warn(message);
    if (stack) this.logger.debug(stack);
  }

  private async resolveTaxRate(
    tenantId: string,
    item: InvoiceLineItemInput,
  ): Promise<number> {
    // 1) Satırda açıkça taxRate varsa onu kullan (satır bazlı override)
    const lineRate = this.normalizeTaxRate(item?.taxRate);
    if (lineRate !== null) {
      return lineRate;
    }

    // 2) Ürün üzerinden belirle
    if (item?.productId) {
      const product = await this.productsRepository.findOne({
        where: { id: item.productId, tenantId },
      });
      if (product) {
        // 2a) Ürüne özel override tanımlıysa (kategori KDV'sini ezer)
        const override = this.normalizeTaxRate(product.categoryTaxRateOverride);
        if (override !== null) {
          return override;
        }
        // 2b) Kategori adı belirtilmişse önce alt kategori sonra ana kategori KDV'si
        if (product.category) {
          const category = await this.categoriesRepository.findOne({
            where: { name: product.category, tenantId },
          });
          if (category) {
            const catRate = this.normalizeTaxRate(category.taxRate);
            if (catRate !== null) {
              return catRate;
            }
            if (category.parentId) {
              const parent = await this.categoriesRepository.findOne({
                where: { id: category.parentId, tenantId },
              });
              if (parent) {
                const parentRate = this.normalizeTaxRate(parent.taxRate);
                if (parentRate !== null) {
                  return parentRate;
                }
              }
            }
          }
        }
        // 2c) Eski alan: ürün.taxRate (mevcutsa, son çare)
        const productRate = this.normalizeTaxRate(product.taxRate);
        if (productRate !== null) {
          return productRate;
        }
      }
    }

    // 3) Varsayılan: bilinmiyorsa KDV eklenmesin.
    return 0;
  }

  private buildProductQuantityMap(
    items: (InvoiceLineItemInput | InvoiceLine)[] | null | undefined,
  ): Map<string, number> {
    const map = new Map<string, number>();
    if (!Array.isArray(items)) {
      return map;
    }
    for (const item of items) {
      const pid = item?.productId ? String(item.productId) : '';
      if (!pid) {
        continue;
      }
      const qty = Number(item?.quantity) || 0;
      if (!Number.isFinite(qty) || qty === 0) {
        continue;
      }
      map.set(pid, (map.get(pid) || 0) + qty);
    }
    return map;
  }

  private diffProductQuantities(
    previousMap: Map<string, number>,
    nextMap: Map<string, number>,
  ): Map<string, number> {
    const diff = new Map<string, number>();
    const ids = new Set<string>([
      ...Array.from(previousMap.keys()),
      ...Array.from(nextMap.keys()),
    ]);
    for (const pid of ids) {
      const delta = (previousMap.get(pid) || 0) - (nextMap.get(pid) || 0);
      if (delta !== 0) {
        diff.set(pid, delta);
      }
    }
    return diff;
  }

  private async applyStockAdjustments(
    tenantId: string,
    adjustments: Map<string, number>,
    context: 'update' | 'refund' = 'update',
  ): Promise<void> {
    if (!adjustments || adjustments.size === 0) {
      return;
    }
    for (const [productId, delta] of adjustments.entries()) {
      if (!delta) continue;
      try {
        const product = await this.productsRepository.findOne({
          where: { id: productId, tenantId },
        });
        if (!product) continue;
        const currentStock = Number(product.stock || 0);
        const nextStock = currentStock + delta;
        product.stock = nextStock < 0 ? 0 : nextStock;
        await this.productsRepository.save(product);
      } catch (error) {
        this.logStockUpdateFailure(
          `invoices.${context}.stockAdjustFailed`,
          error,
          'error',
        );
      }
    }
  }

  async create(
    tenantId: string,
    createInvoiceDto: CreateInvoiceDto,
  ): Promise<Invoice> {
    // Plan limiti: Aylık fatura sayısı kontrolü
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Snapshot'ları oluştur — fatura anındaki satıcı/alıcı bilgilerini yakala
    const sellerSnapshot: InvoiceSellerSnapshot = {
      companyName: tenant.companyName ?? null,
      address: tenant.address ?? null,
      tvaNumber: tenant.tvaNumber ?? null,
      siretNumber: tenant.siretNumber ?? null,
      sirenNumber: tenant.sirenNumber ?? null,
      rcsNumber: tenant.rcsNumber ?? null,
      companyType: tenant.companyType ?? null,
      capitalSocial: tenant.capitalSocial ?? null,
    };

    let buyerSnapshot: InvoiceBuyerSnapshot | null = null;
    const customerId = createInvoiceDto.customerId ?? null;
    if (customerId) {
      const customer = await this.customersRepository.findOne({
        where: { id: customerId },
      });
      if (customer) {
        buyerSnapshot = {
          name: customer.name ?? null,
          company: customer.company ?? null,
          address: customer.address ?? null,
          tvaNumber: customer.tvaNumber ?? null,
          siretNumber: customer.siretNumber ?? null,
          sirenNumber: customer.sirenNumber ?? null,
          customerType: customer.customerType ?? null,
          billingAddress: customer.billingAddress ?? null,
        };
      }
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthCount = await this.invoicesRepository.count({
      where: {
        tenantId,
        isVoided: false,
        createdAt: Between(startOfMonth, now),
      },
    });
    if (
      !TenantPlanLimitService.canAddInvoiceThisMonthForTenant(
        currentMonthCount,
        tenant,
      )
    ) {
      const effective = TenantPlanLimitService.getLimitsForTenant(tenant);
      throw new BadRequestException(
        TenantPlanLimitService.errorMessageForWithLimits('invoice', effective),
      );
    }

    // Generate invoice number if not provided - Format: INV-YYYY-MM-XXX
    let invoiceNumber = createInvoiceDto.invoiceNumber;

    if (!invoiceNumber) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `INV-${year}-${month}-`;

      // Find the last invoice number for this month
      const existingInvoices = await this.invoicesRepository.find({
        where: { tenantId },
        order: { invoiceNumber: 'DESC' },
      });

      // Filter invoices from current month and find max sequence
      const currentMonthInvoices = existingInvoices.filter((inv) =>
        inv.invoiceNumber.startsWith(prefix),
      );

      let nextSequence = 1;
      if (currentMonthInvoices.length > 0) {
        // Extract sequence number from last invoice
        const lastInvoiceNumber = currentMonthInvoices[0].invoiceNumber;
        const lastSequence = parseInt(
          lastInvoiceNumber.split('-').pop() || '0',
          10,
        );
        nextSequence = lastSequence + 1;
      }

      invoiceNumber = `${prefix}${String(nextSequence).padStart(3, '0')}`;
    }

    // Calculate total from line items - Her ürün kendi KDV oranıyla
    const rawItems = createInvoiceDto.lineItems ?? createInvoiceDto.items ?? [];
    const items: InvoiceLineItemInput[] = Array.isArray(rawItems)
      ? rawItems
      : [];

    console.log('📊 Backend: Fatura KDV hesaplaması başlıyor:', {
      itemCount: items.length,
      firstItem: items[0],
    });

    // Her ürün için KDV hesapla (Fiyatlar KDV HARİÇ)
    let subtotal = 0; // KDV HARİÇ toplam
    let taxAmount = 0; // KDV tutarı

    const resolvedLines: Array<{
      input: InvoiceLineItemInput;
      effectiveRate: number;
      lineNet: number;
      lineTax: number;
      lineGross: number;
    }> = [];

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const discount = Number(item.discountAmount) || 0;
      const itemNet = qty * price - discount; // KDV HARİÇ
      const effectiveRate = await this.resolveTaxRate(tenantId, item);
      const itemTax = itemNet * (effectiveRate / 100);

      if (item) {
        item.taxRate = effectiveRate;
      }

      console.log('  📌 Item:', {
        product: item.productName || item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemNet,
        taxRate: effectiveRate,
        itemTax,
      });

      resolvedLines.push({
        input: item,
        effectiveRate,
        lineNet: itemNet,
        lineTax: itemTax,
        lineGross: itemNet + itemTax,
      });

      subtotal += itemNet; // KDV HARİÇ toplam
      taxAmount += itemTax; // KDV toplamı
    }

    const discountAmount = Number(createInvoiceDto.discountAmount) || 0;
    const total = subtotal + taxAmount - discountAmount; // KDV DAHİL toplam

    console.log('✅ Backend: Fatura toplamları:', {
      subtotal,
      taxAmount,
      discountAmount,
      total,
    });

    // Invoice + lines tek transaction içinde kaydet
    const saved = await this.dataSource.transaction(async (manager) => {
      const invoicePayload: DeepPartial<Invoice> = {
        ...createInvoiceDto,
        tenantId,
        invoiceNumber,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        sellerSnapshot,
        buyerSnapshot,
      };
      const invoice = manager.create(Invoice, invoicePayload);
      const savedInvoice = await manager.save(Invoice, invoice);

      // Satırları kaydet
      for (let i = 0; i < resolvedLines.length; i++) {
        const { input, effectiveRate, lineNet, lineTax, lineGross } = resolvedLines[i];
        const line = manager.create(InvoiceLine, {
          invoiceId: savedInvoice.id,
          position: i,
          productId: input.productId ?? null,
          productName: input.productName ?? null,
          description: input.description ?? null,
          quantity: Number(input.quantity) || 0,
          unitPrice: Number(input.unitPrice) || 0,
          taxRate: effectiveRate,
          discountAmount: Number(input.discountAmount) || 0,
          lineNet,
          lineTax,
          lineGross,
          unit: (input as Record<string, unknown>)['unit'] as string ?? null,
        });
        await manager.save(InvoiceLine, line);
      }

      return savedInvoice;
    });

    const savedId = saved.id;

    // Load with customer relation
    const result = await this.invoicesRepository.findOne({
      where: { id: savedId },
      relations: ['customer', 'lines'],
    });

    if (!result) {
      throw new NotFoundException('Failed to create invoice');
    }

    // Eğer saleId verildiyse satışla ilişkilendir ve satış durumunu güncelle
    try {
      const saleId = createInvoiceDto.saleId ?? undefined;
      if (saleId) {
        const sale = await this.salesRepository.findOne({
          where: { id: saleId, tenantId },
        });
        if (sale) {
          sale.invoiceId = savedId;
          sale.status = SaleStatus.INVOICED;
          await this.salesRepository.save(sale);
        }
      }
    } catch (error) {
      // Sessizce logla; fatura oluşturma başarıyla tamamlandı
      this.logStockUpdateFailure('invoice.linkedSale', error);
    }

    // Pennylane bağlantısı varsa e-fatura kuyruğuna ekle
    void this.tryEnqueueSubmit(tenantId, result.id);

    return result;
  }

  private async tryEnqueueSubmit(tenantId: string, invoiceId: string): Promise<void> {
    if (!this.einvoiceQueue || !this.providerAccountService) return;
    try {
      const account = await this.providerAccountService.findByTenantAndProvider(
        tenantId,
        PROVIDER_KEYS.PENNYLANE,
      );
      if (account?.connectionStatus !== ProviderConnectionStatus.CONNECTED) return;

      await this.einvoiceQueue.add(
        EINVOICE_JOB.SUBMIT,
        { tenantId, invoiceId },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      );
      this.logger.log(`E-fatura kuyruğuna eklendi invoice=${invoiceId}`);
    } catch (err) {
      // Kuyruk hatası fatura oluşturmayı engellememeli
      this.logger.error(`Kuyruk eklenemedi invoice=${invoiceId}`, err);
    }
  }

  async findAll(tenantId: string): Promise<Invoice[]> {
    return this.invoicesRepository.find({
      where: { tenantId, isVoided: false },
      relations: ['customer', 'lines', 'createdByUser', 'updatedByUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    tenantId: string,
    id: string,
    includeVoided = false,
  ): Promise<Invoice> {
    const whereCondition: FindOptionsWhere<Invoice> = { id, tenantId };
    if (!includeVoided) {
      whereCondition.isVoided = false;
    }

    const invoice = await this.invoicesRepository.findOne({
      where: whereCondition,
      relations: ['customer', 'lines', 'voidedByUser', 'createdByUser', 'updatedByUser'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice #${id} not found`);
    }

    return invoice;
  }

  async update(
    tenantId: string,
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id);
    const wasRefund =
      String(invoice.type || '').toLowerCase() === 'refund' ||
      String(invoice.type || '').toLowerCase() === 'return';
    const previousLines = Array.isArray(invoice.lines) ? invoice.lines : [];
    const previousQuantityMap = this.buildProductQuantityMap(previousLines);
    let stockAdjustments = new Map<string, number>();

    // Recalculate if items are updated
    if (updateInvoiceDto.lineItems || updateInvoiceDto.items) {
      const rawItems =
        updateInvoiceDto.lineItems ?? updateInvoiceDto.items ?? [];
      const items: InvoiceLineItemInput[] = Array.isArray(rawItems)
        ? rawItems
        : [];

      let subtotal = 0;
      let taxAmount = 0;

      const resolvedLines: Array<{
        input: InvoiceLineItemInput;
        effectiveRate: number;
        lineNet: number;
        lineTax: number;
        lineGross: number;
      }> = [];

      for (const item of items) {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        const discount = Number(item.discountAmount) || 0;
        const lineNet = qty * price - discount;
        const effectiveRate = await this.resolveTaxRate(tenantId, item);
        const lineTax = lineNet * (effectiveRate / 100);

        if (item) {
          item.taxRate = effectiveRate;
        }

        resolvedLines.push({
          input: item,
          effectiveRate,
          lineNet,
          lineTax,
          lineGross: lineNet + lineTax,
        });

        subtotal += lineNet;
        taxAmount += lineTax;
      }

      const discountAmount =
        Number(updateInvoiceDto.discountAmount ?? invoice.discountAmount) || 0;
      const total = subtotal + taxAmount - discountAmount;

      updateInvoiceDto.subtotal = subtotal;
      updateInvoiceDto.taxAmount = taxAmount;
      updateInvoiceDto.total = total;

      // Satırları transaction içinde yeniden yaz
      await this.dataSource.transaction(async (manager) => {
        // Eski satırları sil
        await manager.delete(InvoiceLine, { invoiceId: id });

        // Yeni satırları kaydet
        for (let i = 0; i < resolvedLines.length; i++) {
          const { input, effectiveRate, lineNet, lineTax, lineGross } = resolvedLines[i];
          const line = manager.create(InvoiceLine, {
            invoiceId: id,
            position: i,
            productId: input.productId ?? null,
            productName: input.productName ?? null,
            description: input.description ?? null,
            quantity: Number(input.quantity) || 0,
            unitPrice: Number(input.unitPrice) || 0,
            taxRate: effectiveRate,
            discountAmount: Number(input.discountAmount) || 0,
            lineNet,
            lineTax,
            lineGross,
            unit: (input as Record<string, unknown>)['unit'] as string ?? null,
          });
          await manager.save(InvoiceLine, line);
        }
      });

      // Stok farkı hesapla (yeni lines üzerinden)
      const nextLines = await this.linesRepository.find({ where: { invoiceId: id } });
      const nextQuantityMap = this.buildProductQuantityMap(nextLines);
      stockAdjustments = this.diffProductQuantities(
        previousQuantityMap,
        nextQuantityMap,
      );

      // DTO'dan items/lineItems kaldır — entity'de alan yok
      delete updateInvoiceDto.items;
      delete updateInvoiceDto.lineItems;
    }

    Object.assign(invoice, updateInvoiceDto);
    // Lines are managed in the transaction above when lineItems/items are provided.
    // Remove the loaded relation from the entity before save() to prevent
    // TypeORM cascade from trying to update existing lines and nulling invoiceId.
    delete (invoice as any).lines;
    await this.invoicesRepository.save(invoice);

    // İade faturası yapıldığında: stok geri ekle + satış iptal et
    const isNowRefund =
      String(invoice.type || '').toLowerCase() === 'refund' ||
      String(invoice.type || '').toLowerCase() === 'return';
    const isRefundTransition = !wasRefund && isNowRefund;
    if (!wasRefund && isNowRefund) {
      try {
        // Stok geri ekle (normalize lines üzerinden)
        const currentLines = await this.linesRepository.find({ where: { invoiceId: id } });
        for (const line of currentLines) {
          const pid = line.productId;
          const qty = Number(line.quantity) || 0;
          if (!pid) continue;
          try {
            const product = await this.productsRepository.findOne({
              where: { id: pid, tenantId },
            });
            if (!product) continue;
            const delta = qty < 0 ? Math.abs(qty) : qty;
            product.stock = Number(product.stock || 0) + delta;
            await this.productsRepository.save(product);
          } catch (error) {
            this.logStockUpdateFailure(
              'invoices.refund.productAdjustFailed',
              error,
            );
          }
        }
        // Satış iptal et
        if (invoice.saleId) {
          const sale = await this.salesRepository.findOne({
            where: { id: invoice.saleId, tenantId },
          });
          if (sale) {
            sale.status = SaleStatus.REFUNDED;
            await this.salesRepository.save(sale);
          }
        }
      } catch (error) {
        this.logStockUpdateFailure(
          'invoices.refund.stockFlowFailed',
          error,
          'error',
        );
      }
    }

    if (stockAdjustments.size && !isRefundTransition) {
      await this.applyStockAdjustments(tenantId, stockAdjustments, 'update');
    }

    // Reload with lines + customer relation
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const invoice = await this.findOne(tenantId, id);
    await this.invoicesRepository.remove(invoice);
  }

  async voidInvoice(
    tenantId: string,
    id: string,
    userId: string,
    reason?: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id, true);

    if (invoice.isVoided) {
      throw new Error('Invoice is already voided');
    }

    invoice.isVoided = true;
    invoice.voidReason = reason ?? null;
    invoice.voidedAt = new Date();
    invoice.voidedBy = userId;

    await this.invoicesRepository.save(invoice);

    // Void işleminde: stok geri ekle/azalt (kalem miktarının işaretine göre) + satış iptal et
    try {
      // Stok geri ekle (normalize lines üzerinden)
      const lineItems = await this.linesRepository.find({ where: { invoiceId: id } });
      for (const it of lineItems) {
        const pid = it.productId;
        const qty = Number(it.quantity) || 0;
        if (!pid) continue;
        try {
          const product = await this.productsRepository.findOne({
            where: { id: pid, tenantId },
          });
          if (!product) continue;
          // Normal satış faturası (qty>0) void: stok artar
          // İade faturası (qty<0) void: stok azalır (eklenen geri alınır)
          product.stock = Number(product.stock || 0) + qty;
          await this.productsRepository.save(product);
        } catch (error) {
          this.logStockUpdateFailure(
            'invoices.void.productAdjustFailed',
            error,
          );
        }
      }
      // Satış iptal et
      if (invoice.saleId) {
        const sale = await this.salesRepository.findOne({
          where: { id: invoice.saleId, tenantId },
        });
        if (sale) {
          sale.status = 'cancelled' as unknown as SaleStatus;
          await this.salesRepository.save(sale);
        }
      }
    } catch (error) {
      this.logStockUpdateFailure(
        'invoices.void.stockFlowFailed',
        error,
        'error',
      );
    }

    return invoice;
  }

  async restoreInvoice(tenantId: string, id: string): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id, true);

    if (!invoice.isVoided) {
      throw new Error('Invoice is not voided');
    }

    invoice.isVoided = false;
    invoice.voidReason = null;
    invoice.voidedAt = null;
    invoice.voidedBy = null;

    return this.invoicesRepository.save(invoice);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: InvoiceStatus,
  ): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id);
    invoice.status = status;
    return this.invoicesRepository.save(invoice);
  }

  async getStatistics(tenantId: string): Promise<InvoiceStatistics> {
    const invoices = await this.findAll(tenantId);

    const total = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const paid = invoices
      .filter((inv) => inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => sum + Number(inv.total), 0);
    const pending = invoices
      .filter((inv) => inv.status === InvoiceStatus.SENT)
      .reduce((sum, inv) => sum + Number(inv.total), 0);
    const overdue = invoices
      .filter((inv) => inv.status === InvoiceStatus.OVERDUE)
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    return {
      total,
      paid,
      pending,
      overdue,
      count: invoices.length,
    };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, FindOptionsWhere } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantPlanLimitService } from '../common/tenant-plan-limits.service';
import { Sale, SaleStatus } from '../sales/entities/sale.entity';
import { Product } from '../products/entities/product.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceLineItemInput,
  InvoiceStatistics,
} from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductCategory)
    private categoriesRepository: Repository<ProductCategory>,
  ) {}

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
    if (
      item != null &&
      Object.prototype.hasOwnProperty.call(item, 'taxRate') &&
      item.taxRate !== undefined &&
      item.taxRate !== null &&
      `${item.taxRate}`.trim() !== ''
    ) {
      const v = Number(item.taxRate);
      if (Number.isFinite(v) && v >= 0) return v;
    }

    // 2) Ürün üzerinden belirle
    if (item?.productId) {
      const product = await this.productsRepository.findOne({
        where: { id: item.productId, tenantId },
      });
      if (product) {
        // 2a) Ürüne özel override tanımlıysa (kategori KDV'sini ezer)
        if (
          product.categoryTaxRateOverride !== null &&
          product.categoryTaxRateOverride !== undefined
        ) {
          const v = Number(product.categoryTaxRateOverride);
          if (Number.isFinite(v) && v >= 0) return v;
        }
        // 2b) Kategori adı belirtilmişse önce alt kategori sonra ana kategori KDV'si
        if (product.category) {
          const category = await this.categoriesRepository.findOne({
            where: { name: product.category, tenantId },
          });
          if (category) {
            const catRate = Number(category.taxRate);
            if (Number.isFinite(catRate) && catRate >= 0) return catRate;
            if (category.parentId) {
              const parent = await this.categoriesRepository.findOne({
                where: { id: category.parentId, tenantId },
              });
              if (parent) {
                const parentRate = Number(parent.taxRate);
                if (Number.isFinite(parentRate) && parentRate >= 0)
                  return parentRate;
              }
            }
          }
        }
        // 2c) Eski alan: ürün.taxRate (mevcutsa, son çare)
        if (product.taxRate !== undefined && product.taxRate !== null) {
          const v = Number(product.taxRate);
          if (Number.isFinite(v) && v >= 0) return v;
        }
      }
    }

    // 3) Varsayılan: %18
    return 18;
  }

  private buildProductQuantityMap(
    items: InvoiceLineItemInput[] | null | undefined,
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

    for (const item of items) {
      const itemTotal =
        (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0); // KDV HARİÇ
      const effectiveRate = await this.resolveTaxRate(tenantId, item);
      const itemTaxRate = Number(effectiveRate) / 100; // % => oran
      const itemTax = itemTotal * itemTaxRate; // KDV tutarı

      console.log('  📌 Item:', {
        product: item.productName || item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemTotal,
        taxRate: effectiveRate,
        itemTax,
      });

      subtotal += itemTotal; // KDV HARİÇ toplam
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

    const payload: DeepPartial<Invoice> = {
      ...createInvoiceDto,
      tenantId,
      invoiceNumber,
      items,
      subtotal,
      taxAmount,
      discountAmount,
      total,
    };
    const invoice = this.invoicesRepository.create(payload);
    const saved: Invoice = await this.invoicesRepository.save(invoice);
    const savedId = saved.id;

    // Load with customer relation
    const result = await this.invoicesRepository.findOne({
      where: { id: savedId },
      relations: ['customer'],
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

    return result;
  }

  async findAll(tenantId: string): Promise<Invoice[]> {
    return this.invoicesRepository.find({
      where: { tenantId, isVoided: false },
      relations: ['customer', 'createdByUser', 'updatedByUser'],
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
      relations: ['customer', 'voidedByUser', 'createdByUser', 'updatedByUser'],
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
    const previousItems = Array.isArray(invoice.items) ? invoice.items : [];
    const previousQuantityMap = this.buildProductQuantityMap(previousItems);
    let stockAdjustments = new Map<string, number>();

    // Recalculate if items are updated
    if (updateInvoiceDto.lineItems || updateInvoiceDto.items) {
      const rawItems =
        updateInvoiceDto.lineItems ?? updateInvoiceDto.items ?? [];
      const items: InvoiceLineItemInput[] = Array.isArray(rawItems)
        ? rawItems
        : [];

      // Her ürün için KDV hesapla (Fiyatlar KDV HARİÇ)
      let subtotal = 0; // KDV HARİÇ toplam
      let taxAmount = 0; // KDV tutarı

      for (const item of items) {
        const itemTotal =
          (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0); // KDV HARİÇ
        const effectiveRate = await this.resolveTaxRate(tenantId, item);
        const itemTaxRate = Number(effectiveRate) / 100; // % => oran
        const itemTax = itemTotal * itemTaxRate; // KDV tutarı

        subtotal += itemTotal; // KDV HARİÇ toplam
        taxAmount += itemTax; // KDV toplamı
      }

      const discountAmount =
        Number(updateInvoiceDto.discountAmount ?? invoice.discountAmount) || 0;
      const total = subtotal + taxAmount - discountAmount; // KDV DAHİL toplam

      updateInvoiceDto.items = items;
      updateInvoiceDto.subtotal = subtotal;
      updateInvoiceDto.taxAmount = taxAmount;
      updateInvoiceDto.total = total;

      const nextQuantityMap = this.buildProductQuantityMap(items);
      stockAdjustments = this.diffProductQuantities(
        previousQuantityMap,
        nextQuantityMap,
      );
    }

    Object.assign(invoice, updateInvoiceDto);
    await this.invoicesRepository.save(invoice);

    // İade faturası yapıldığında: stok geri ekle + satış iptal et
    const isNowRefund =
      String(invoice.type || '').toLowerCase() === 'refund' ||
      String(invoice.type || '').toLowerCase() === 'return';
    const isRefundTransition = !wasRefund && isNowRefund;
    if (!wasRefund && isNowRefund) {
      try {
        // Stok geri ekle
        const lineItems: InvoiceLineItemInput[] = Array.isArray(invoice.items)
          ? invoice.items
          : [];
        for (const it of lineItems) {
          const pid = it?.productId ? String(it.productId) : '';
          const qty = Number(it?.quantity) || 0;
          if (!pid) continue;
          try {
            const product = await this.productsRepository.findOne({
              where: { id: pid, tenantId },
            });
            if (!product) continue;
            // İade faturasında miktar negatif olabilir; stoğu her durumda artırmalıyız
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

    // Reload with customer relation
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
      // Stok geri ekle
      const lineItems: InvoiceLineItemInput[] = Array.isArray(invoice.items)
        ? invoice.items
        : [];
      for (const it of lineItems) {
        const pid = it?.productId ? String(it.productId) : '';
        const qty = Number(it?.quantity) || 0;
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

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import { Sale, SaleStatus } from './entities/sale.entity';
import { CreateSaleDto, SaleItemDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { ProductCategory } from '../products/entities/product-category.entity';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoriesRepository: Repository<ProductCategory>,
  ) {}

  private logStockOrCustomerFailure(
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
    item: SaleItemDto,
  ): Promise<number> {
    // 1) Satırda açıkça taxRate varsa onu kullan
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
        // 2a) Ürüne özel override
        if (
          product.categoryTaxRateOverride !== null &&
          product.categoryTaxRateOverride !== undefined
        ) {
          const v = Number(product.categoryTaxRateOverride);
          if (Number.isFinite(v) && v >= 0) return v;
        }
        // 2b) Kategori (alt kategori) KDV'si
        if (product.category) {
          const category = await this.categoriesRepository.findOne({
            where: { name: product.category, tenantId },
          });
          if (category) {
            const catRate = Number(category.taxRate);
            if (Number.isFinite(catRate) && catRate >= 0) return catRate;
            // 2c) Alt kategoride yoksa ana kategoriye bak
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
        // 2d) Eski alan: ürün.taxRate
        if (product.taxRate !== undefined && product.taxRate !== null) {
          const v = Number(product.taxRate);
          if (Number.isFinite(v) && v >= 0) return v;
        }
      }
    }
    // 3) Varsayılan %18
    return 18;
  }

  private async generateSaleNumber(tenantId: string, dateStr: string) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `SAL-${year}-${month}-`;

    // Bu tenant ve ay için mevcut en yüksek sırayı bul
    const existing = await this.salesRepository.find({
      where: {
        tenantId,
        saleNumber: Like(`${prefix}%`),
      },
      select: { saleNumber: true },
    });

    let next = 1;
    if (existing.length > 0) {
      const seqs = existing
        .map((s) => Number((s.saleNumber || '').split('-').pop() || 0))
        .filter((n) => Number.isFinite(n));
      if (seqs.length > 0) {
        next = Math.max(...seqs) + 1;
      }
    }
    return `${prefix}${String(next).padStart(3, '0')}`;
  }

  async create(tenantId: string, dto: CreateSaleDto): Promise<Sale> {
    // Idempotency: sourceQuoteId varsa aynı quote için ikinci satış oluşturma
    if (dto.sourceQuoteId) {
      const existing = await this.salesRepository.findOne({
        where: { tenantId, sourceQuoteId: dto.sourceQuoteId },
      });
      if (existing) {
        return existing; // idempotent dönüş
      }
    }
    const items: SaleItemDto[] = Array.isArray(dto.items) ? dto.items : [];

    let subtotal = 0;
    let taxAmount = 0;
    for (const item of items) {
      const itemTotal =
        (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const effectiveRate = await this.resolveTaxRate(tenantId, item);
      // Hesaplanan oranı item.taxRate alanına yaz (frontend eksik gönderdiğinde tutarlılık için)
      if (item.taxRate === undefined || item.taxRate === null) {
        item.taxRate = effectiveRate;
      }
      const itemTaxRate = Number(effectiveRate) / 100;
      const itemTax = itemTotal * itemTaxRate;
      subtotal += itemTotal;
      taxAmount += itemTax;
    }

    const discountAmount = Number(dto.discountAmount) || 0;
    const total = subtotal + taxAmount - discountAmount;

    // Benzersiz satış numarası üretimi: her zaman sunucu tarafında üret
    let saleNumber = await this.generateSaleNumber(tenantId, dto.saleDate);

    let customerId: string | null = dto.customerId ?? null;
    // Otomatik müşteri oluşturma: ID yok ama isim varsa
    if (!customerId && dto.customerName) {
      const emailLc = (dto.customerEmail || '').trim().toLowerCase();
      // Aynı tenant içinde isim veya email eşleşmesi
      const existingCustomer = await this.customerRepository.findOne({
        where: emailLc
          ? { tenantId, email: dto.customerEmail }
          : { tenantId, name: dto.customerName },
      });
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const customerPayload: DeepPartial<Customer> = {
          tenantId,
          name: dto.customerName,
          email: dto.customerEmail || null,
        };
        const created = this.customerRepository.create(customerPayload);
        try {
          const savedCustomer: Customer =
            await this.customerRepository.save(created);
          customerId = savedCustomer.id;
        } catch (error) {
          this.logStockOrCustomerFailure(
            'sales.create.customerSaveFailed',
            error,
          );
          // race veya unique çakışması durumunda yumuşak fallback: tekrar ara
          const fallback = await this.customerRepository.findOne({
            where: { tenantId, name: dto.customerName },
          });
          if (fallback) customerId = fallback.id;
        }
      }
    }

    // save + retry (eşzamanlı çakışmalara karşı dayanıklı)
    for (let attempt = 0; attempt < 3; attempt++) {
      const sale = this.salesRepository.create({
        tenantId,
        saleNumber,
        customerId,
        saleDate: new Date(dto.saleDate),
        items,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        notes: dto.notes ?? null,
        sourceQuoteId: dto.sourceQuoteId ?? null,
        invoiceId: dto.invoiceId ?? null,
        status: SaleStatus.CREATED,
      });

      try {
        const saved = await this.salesRepository.save(sale);

        // Satış kalemlerindeki ürün stoklarını azalt
        try {
          for (const it of items) {
            const pid = it?.productId ? String(it.productId) : '';
            const qty = Number(it?.quantity) || 0;
            if (!pid || qty <= 0) continue;
            try {
              const product = await this.productsRepository.findOne({
                where: { id: pid, tenantId },
              });
              if (!product) continue;
              product.stock = Number(product.stock || 0) - qty;
              await this.productsRepository.save(product);
            } catch (error) {
              this.logStockOrCustomerFailure(
                'sales.create.productAdjustFailed',
                error,
              );
            }
          }
        } catch (error) {
          this.logStockOrCustomerFailure(
            'sales.create.stockAdjustLoopFailed',
            error,
            'error',
          );
        }

        return saved;
      } catch (err) {
        const dbCode =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code?: string }).code ?? '')
            : '';
        const isUniqueViolation =
          dbCode === '23505' ||
          (err instanceof Error &&
            err.message.includes('UNIQUE constraint failed'));
        if (isUniqueViolation) {
          // Yeni numara üret ve tekrar dene
          saleNumber = await this.generateSaleNumber(tenantId, dto.saleDate);
          continue;
        }
        throw err;
      }
    }
    // 3 denemeden sonra hâlâ çakışıyorsa anlamlı mesaj ver
    throw new BadRequestException(
      'Bu ay için oluşturulan satış numarası çakışıyor. Lütfen tekrar deneyin.',
    );
  }

  async findAll(tenantId: string): Promise<Sale[]> {
    return this.salesRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Sale> {
    const sale = await this.salesRepository.findOne({
      where: { id, tenantId },
    });
    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }
    return sale;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateSaleDto,
  ): Promise<Sale> {
    const sale = await this.findOne(tenantId, id);

    // Eğer kalemler veya tutarlar güncelleniyorsa yeniden hesapla
    if (dto.items) {
      const items = dto.items || [];
      let subtotal = 0;
      let taxAmount = 0;
      for (const item of items) {
        const itemTotal =
          (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        const effectiveRate = await this.resolveTaxRate(tenantId, item);
        if (item.taxRate === undefined || item.taxRate === null) {
          item.taxRate = effectiveRate;
        }
        const itemTaxRate = Number(effectiveRate) / 100;
        const itemTax = itemTotal * itemTaxRate;
        subtotal += itemTotal;
        taxAmount += itemTax;
      }
      const discountAmount =
        Number(dto.discountAmount ?? sale.discountAmount) || 0;
      const total = subtotal + taxAmount - discountAmount;
      Object.assign(sale, {
        items,
        subtotal,
        taxAmount,
        discountAmount,
        total,
      });
    }

    Object.assign(sale, dto);
    return this.salesRepository.save(sale);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const sale = await this.findOne(tenantId, id);
    await this.salesRepository.remove(sale);
  }

  async purgeTenant(tenantId: string): Promise<{ deleted: number }> {
    const existing = await this.salesRepository.find({ where: { tenantId } });
    if (existing.length === 0) return { deleted: 0 };
    await this.salesRepository.remove(existing);
    return { deleted: existing.length };
  }
}

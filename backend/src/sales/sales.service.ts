import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Sale, SaleStatus } from './entities/sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

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
    const items = dto.items || [];

    let subtotal = 0;
    let taxAmount = 0;

    items.forEach((item: any) => {
      const itemTotal =
        (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const itemTaxRate = Number(item.taxRate ?? 18) / 100;
      const itemTax = itemTotal * itemTaxRate;
      subtotal += itemTotal;
      taxAmount += itemTax;
    });

    const discountAmount = Number(dto.discountAmount) || 0;
    const total = subtotal + taxAmount - discountAmount;

    // Benzersiz satış numarası üretimi: her zaman sunucu tarafında üret
    let saleNumber = await this.generateSaleNumber(tenantId, dto.saleDate);

    let customerId: string | null = dto.customerId ?? null;
    // Otomatik müşteri oluşturma: ID yok ama isim varsa
    if (!customerId && dto.customerName) {
      const nameLc = dto.customerName.trim().toLowerCase();
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
        const created = this.customerRepository.create({
          tenantId,
          name: dto.customerName,
          email: dto.customerEmail || null,
          isActive: true,
        } as any);
        try {
          const savedCustomer = await this.customerRepository.save(created as any);
          customerId = Array.isArray(savedCustomer) ? savedCustomer[0]?.id : savedCustomer.id;
        } catch (e: any) {
          // race veya unique çakışması durumunda yumuşak fallback: tekrar ara
          const fallback = await this.customerRepository.findOne({
            where: { tenantId, name: dto.customerName },
          });
            if (fallback) customerId = fallback.id;
        }
      }
    }

    // save + retry (eşzamanlı çakışmalara karşı dayanıklı)
    let lastError: any = null;
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
          const saleItems: any[] = Array.isArray(items) ? items : [];
          for (const it of saleItems) {
            const pid = it?.productId ? String(it.productId) : '';
            const qty = Number(it?.quantity) || 0;
            if (!pid || qty <= 0) continue;
            try {
              const product = await this.productsRepository.findOne({ where: { id: pid, tenantId } });
              if (!product) continue;
              product.stock = Number(product.stock || 0) - qty;
              await this.productsRepository.save(product);
            } catch {}
          }
        } catch {}

        return saved;
      } catch (err: any) {
        lastError = err;
        const isUniqueViolation =
          err?.code === '23505' ||
          (typeof err?.message === 'string' && err.message.includes('UNIQUE constraint failed'));
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
      'Bu ay için oluşturulan satış numarası çakışıyor. Lütfen tekrar deneyin.'
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
      items.forEach((item: any) => {
        const itemTotal =
          (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        const itemTaxRate = Number(item.taxRate ?? 18) / 100;
        const itemTax = itemTotal * itemTaxRate;
        subtotal += itemTotal;
        taxAmount += itemTax;
      });
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

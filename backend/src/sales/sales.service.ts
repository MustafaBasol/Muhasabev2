import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Sale, SaleStatus } from './entities/sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
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

    const saleNumber =
      dto.saleNumber || (await this.generateSaleNumber(tenantId, dto.saleDate));

    const sale = this.salesRepository.create({
      tenantId,
      saleNumber,
      customerId: dto.customerId ?? null,
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

    return this.salesRepository.save(sale);
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
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
  ) {}

  async create(tenantId: string, createInvoiceDto: any): Promise<Invoice> {
    // Generate invoice number if not provided
    const invoiceNumber = createInvoiceDto.invoiceNumber || 
      `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    
    // Calculate subtotal from line items
    const items = createInvoiceDto.lineItems || createInvoiceDto.items || [];
    const subtotal = items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
    
    // Calculate total
    const taxAmount = Number(createInvoiceDto.taxAmount) || 0;
    const discountAmount = Number(createInvoiceDto.discountAmount) || 0;
    const total = subtotal + taxAmount - discountAmount;
    
    const invoice = this.invoicesRepository.create({
      ...createInvoiceDto,
      tenantId,
      invoiceNumber,
      items,
      subtotal,
      taxAmount,
      discountAmount,
      total,
    });
    
    const saved = await this.invoicesRepository.save(invoice) as any;
    const savedId = Array.isArray(saved) ? saved[0].id : saved.id;
    
    // Load with customer relation
    const result = await this.invoicesRepository.findOne({
      where: { id: savedId },
      relations: ['customer'],
    });
    
    if (!result) {
      throw new NotFoundException('Failed to create invoice');
    }
    
    return result;
  }

  async findAll(tenantId: string): Promise<Invoice[]> {
    return this.invoicesRepository.find({
      where: { tenantId },
      relations: ['customer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id, tenantId },
      relations: ['customer'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice #${id} not found`);
    }

    return invoice;
  }

  async update(tenantId: string, id: string, updateInvoiceDto: any): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id);
    
    // Recalculate if items are updated
    if (updateInvoiceDto.lineItems || updateInvoiceDto.items) {
      const items = updateInvoiceDto.lineItems || updateInvoiceDto.items || [];
      const subtotal = items.reduce((sum: number, item: any) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        return sum + (quantity * unitPrice);
      }, 0);
      
      const taxAmount = Number(updateInvoiceDto.taxAmount ?? invoice.taxAmount) || 0;
      const discountAmount = Number(updateInvoiceDto.discountAmount ?? invoice.discountAmount) || 0;
      const total = subtotal + taxAmount - discountAmount;
      
      updateInvoiceDto.items = items;
      updateInvoiceDto.subtotal = subtotal;
      updateInvoiceDto.total = total;
    }
    
    Object.assign(invoice, updateInvoiceDto);
    await this.invoicesRepository.save(invoice);
    
    // Reload with customer relation
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const invoice = await this.findOne(tenantId, id);
    await this.invoicesRepository.remove(invoice);
  }

  async updateStatus(tenantId: string, id: string, status: InvoiceStatus): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id);
    invoice.status = status;
    return this.invoicesRepository.save(invoice);
  }

  async getStatistics(tenantId: string) {
    const invoices = await this.findAll(tenantId);
    
    const total = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const paid = invoices.filter(inv => inv.status === InvoiceStatus.PAID).reduce((sum, inv) => sum + Number(inv.total), 0);
    const pending = invoices.filter(inv => inv.status === InvoiceStatus.SENT).reduce((sum, inv) => sum + Number(inv.total), 0);
    const overdue = invoices.filter(inv => inv.status === InvoiceStatus.OVERDUE).reduce((sum, inv) => sum + Number(inv.total), 0);

    return {
      total,
      paid,
      pending,
      overdue,
      count: invoices.length,
    };
  }
}

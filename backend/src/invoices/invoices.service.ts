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
      const currentMonthInvoices = existingInvoices.filter(inv => 
        inv.invoiceNumber.startsWith(prefix)
      );
      
      let nextSequence = 1;
      if (currentMonthInvoices.length > 0) {
        // Extract sequence number from last invoice
        const lastInvoiceNumber = currentMonthInvoices[0].invoiceNumber;
        const lastSequence = parseInt(lastInvoiceNumber.split('-').pop() || '0', 10);
        nextSequence = lastSequence + 1;
      }
      
      invoiceNumber = `${prefix}${String(nextSequence).padStart(3, '0')}`;
    }
    
    // Calculate total from line items - Her ürün kendi KDV oranıyla
    const items = createInvoiceDto.lineItems || createInvoiceDto.items || [];
    const totalWithTax = items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
    
    // Her ürün için KDV hesapla
    let subtotal = 0;
    let taxAmount = 0;
    
    items.forEach((item: any) => {
      const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const itemTaxRate = Number(item.taxRate ?? 18) / 100; // %18 -> 0.18
      const itemSubtotal = itemTotal / (1 + itemTaxRate); // KDV HARİÇ
      const itemTax = itemTotal - itemSubtotal; // KDV tutarı
      
      subtotal += itemSubtotal;
      taxAmount += itemTax;
    });
    
    const discountAmount = Number(createInvoiceDto.discountAmount) || 0;
    const total = totalWithTax - discountAmount; // KDV DAHİL toplam
    
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
      const totalWithTax = items.reduce((sum: number, item: any) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        return sum + (quantity * unitPrice);
      }, 0);
      
      // Her ürün için KDV hesapla
      let subtotal = 0;
      let taxAmount = 0;
      
      items.forEach((item: any) => {
        const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        const itemTaxRate = Number(item.taxRate ?? 18) / 100;
        const itemSubtotal = itemTotal / (1 + itemTaxRate);
        const itemTax = itemTotal - itemSubtotal;
        
        subtotal += itemSubtotal;
        taxAmount += itemTax;
      });
      
      const discountAmount = Number(updateInvoiceDto.discountAmount ?? invoice.discountAmount) || 0;
      const total = totalWithTax - discountAmount;
      
      updateInvoiceDto.items = items;
      updateInvoiceDto.subtotal = subtotal;
      updateInvoiceDto.taxAmount = taxAmount;
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

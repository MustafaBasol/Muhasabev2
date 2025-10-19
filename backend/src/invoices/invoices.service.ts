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

  async create(tenantId: string, createInvoiceDto: any) {
    const invoice = this.invoicesRepository.create({
      ...createInvoiceDto,
      tenantId,
    });
    return this.invoicesRepository.save(invoice);
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
    Object.assign(invoice, updateInvoiceDto);
    return this.invoicesRepository.save(invoice);
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

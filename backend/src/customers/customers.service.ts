import { Injectable, NotFoundException, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantPlanLimitService } from '../common/tenant-plan-limits.service';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async findAll(tenantId: string): Promise<Customer[]> {
    return this.customersRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id, tenantId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async create(createCustomerDto: CreateCustomerDto, tenantId: string): Promise<Customer> {
    // Plan limiti: müşteri ekleme kontrolü
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const currentCount = await this.customersRepository.count({ where: { tenantId } });
    if (!TenantPlanLimitService.canAddCustomer(currentCount, tenant.subscriptionPlan)) {
      throw new BadRequestException(TenantPlanLimitService.errorMessageFor('customer', tenant.subscriptionPlan));
    }

    const customer = this.customersRepository.create({
      ...createCustomerDto,
      tenantId,
    });

    return this.customersRepository.save(customer);
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto, tenantId: string): Promise<Customer> {
    await this.customersRepository.update(
      { id, tenantId },
      updateCustomerDto,
    );
    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const customer = await this.findOne(id, tenantId);
    
    // Bağlı fatura var mı kontrol et
    const relatedInvoices = await this.invoicesRepository.find({
      where: { customerId: id, tenantId },
      take: 5, // İlk 5 faturayı al
    });

    if (relatedInvoices.length > 0) {
      throw new HttpException({
        message: 'Bu müşteri silinemez çünkü bağlı faturalar var',
        relatedInvoices: relatedInvoices.map(i => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          total: i.total,
          status: i.status,
        })),
        count: relatedInvoices.length,
      }, HttpStatus.BAD_REQUEST);
    }

    await this.customersRepository.remove(customer);
  }

  async updateBalance(id: string, amount: number, tenantId: string): Promise<Customer> {
    const customer = await this.findOne(id, tenantId);
    customer.balance = Number(customer.balance) + amount;
    return this.customersRepository.save(customer);
  }
}

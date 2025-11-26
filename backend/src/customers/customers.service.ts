import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
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

  async create(
    createCustomerDto: CreateCustomerDto,
    tenantId: string,
  ): Promise<Customer> {
    // Duplicate by email (case-insensitive, trimmed) per tenant
    const email = (createCustomerDto.email || '').trim();
    if (email) {
      const existing = await this.customersRepository
        .createQueryBuilder('c')
        .where('c.tenantId = :tenantId', { tenantId })
        .andWhere('LOWER(TRIM(c.email)) = LOWER(TRIM(:email))', { email })
        .getOne();
      if (existing) {
        throw new BadRequestException(
          `Bu e-posta (${email}) ile zaten bir müşteri kayıtlı`,
        );
      }
    }
    // Plan limiti: müşteri ekleme kontrolü
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const currentCount = await this.customersRepository.count({
      where: { tenantId },
    });
    if (!TenantPlanLimitService.canAddCustomerForTenant(currentCount, tenant)) {
      const effective = TenantPlanLimitService.getLimitsForTenant(tenant);
      throw new BadRequestException(
        TenantPlanLimitService.errorMessageForWithLimits('customer', effective),
      );
    }

    const customer = this.customersRepository.create({
      ...createCustomerDto,
      tenantId,
    });

    try {
      return await this.customersRepository.save(customer);
    } catch (error) {
      if (this.isUniqueCustomerConstraint(error)) {
        throw new BadRequestException(
          'Bu e-posta ile zaten bir müşteri kayıtlı',
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    tenantId: string,
  ): Promise<Customer> {
    // If email is being updated, enforce duplicate rule per tenant (case-insensitive, trimmed)
    const nextEmail = (updateCustomerDto?.email || '').trim();
    if (nextEmail) {
      const existing = await this.customersRepository
        .createQueryBuilder('c')
        .where('c.tenantId = :tenantId', { tenantId })
        .andWhere('LOWER(TRIM(c.email)) = LOWER(TRIM(:email))', {
          email: nextEmail,
        })
        .andWhere('c.id <> :id', { id })
        .getOne();
      if (existing) {
        throw new BadRequestException(
          `Bu e-posta (${nextEmail}) ile zaten bir müşteri kayıtlı`,
        );
      }
    }

    await this.customersRepository.update({ id, tenantId }, updateCustomerDto);
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
      throw new HttpException(
        {
          message: 'Bu müşteri silinemez çünkü bağlı faturalar var',
          relatedInvoices: relatedInvoices.map((i) => ({
            id: i.id,
            invoiceNumber: i.invoiceNumber,
            total: i.total,
            status: i.status,
          })),
          count: relatedInvoices.length,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.customersRepository.remove(customer);
  }

  async updateBalance(
    id: string,
    amount: number,
    tenantId: string,
  ): Promise<Customer> {
    const customer = await this.findOne(id, tenantId);
    customer.balance = Number(customer.balance) + amount;
    return this.customersRepository.save(customer);
  }

  private isUniqueCustomerConstraint(error: unknown): boolean {
    const { code, errno, message } = this.parseDbError(error);
    if (code === '23505' || errno === '23505') {
      return true;
    }
    if (!message) {
      return false;
    }
    const normalized = message.toLowerCase();
    return normalized.includes('unique') || normalized.includes('duplicate');
  }

  private parseDbError(error: unknown) {
    const result: { code?: string; errno?: string; message?: string } = {};
    if (typeof error === 'object' && error !== null) {
      const record = error as Record<string, unknown>;
      if (typeof record.code === 'string') {
        result.code = record.code;
      } else if (typeof record.code === 'number') {
        result.code = String(record.code);
      }
      if (typeof record.errno === 'string') {
        result.errno = record.errno;
      } else if (typeof record.errno === 'number') {
        result.errno = String(record.errno);
      }
      if (typeof record.message === 'string') {
        result.message = record.message;
      }
    }
    if (!result.message && error instanceof Error) {
      result.message = error.message;
    }
    return result;
  }
}

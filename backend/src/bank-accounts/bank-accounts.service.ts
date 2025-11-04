import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankAccount } from './entities/bank-account.entity';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantPlanLimitService } from '../common/tenant-plan-limits.service';

@Injectable()
export class BankAccountsService {
  constructor(
    @InjectRepository(BankAccount)
    private readonly bankAccountsRepo: Repository<BankAccount>,
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  async create(dto: CreateBankAccountDto, tenantId: string) {
    const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');

    const currentCount = await this.bankAccountsRepo.count({
      where: { tenantId },
    });
    if (!TenantPlanLimitService.canAddBankAccountForTenant(currentCount, tenant)) {
      const effective = TenantPlanLimitService.getLimitsForTenant(tenant);
      throw new BadRequestException(
        TenantPlanLimitService.errorMessageForWithLimits('bankAccount', effective),
      );
    }

    const entity = this.bankAccountsRepo.create({
      tenantId,
      name: dto.name,
      iban: dto.iban,
      bankName: dto.bankName,
      currency: dto.currency ?? 'TRY',
    });
    return this.bankAccountsRepo.save(entity);
  }

  async findAll(tenantId: string) {
    return this.bankAccountsRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }
}

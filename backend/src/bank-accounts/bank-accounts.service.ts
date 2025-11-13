import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger('BankAccountsService');

  async create(dto: CreateBankAccountDto, tenantId: string) {
    const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');

    const currentCount = await this.bankAccountsRepo.count({
      where: { tenantId },
    });
    if (
      !TenantPlanLimitService.canAddBankAccountForTenant(currentCount, tenant)
    ) {
      const effective = TenantPlanLimitService.getLimitsForTenant(tenant);
      throw new BadRequestException(
        TenantPlanLimitService.errorMessageForWithLimits(
          'bankAccount',
          effective,
        ),
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
    try {
      const list = await this.bankAccountsRepo.find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
      });
      return list.map(b => ({ ...b }));
    } catch (e: any) {
      this.logger.error(`findAll failed tenant=${tenantId} err=${e?.message || e}`);
      throw e;
    }
  }

  async update(id: string, dto: Partial<CreateBankAccountDto>, tenantId: string) {
    const entity = await this.bankAccountsRepo.findOne({ where: { id, tenantId } });
    if (!entity) throw new BadRequestException('Bank account not found');
    Object.assign(entity, {
      name: dto.name ?? entity.name,
      iban: dto.iban ?? entity.iban,
      bankName: dto.bankName ?? entity.bankName,
      currency: dto.currency ?? entity.currency,
    });
    try {
      return await this.bankAccountsRepo.save(entity);
    } catch (e: any) {
      this.logger.error(`update failed id=${id} tenant=${tenantId} err=${e?.message || e}`);
      throw e;
    }
  }

  async remove(id: string, tenantId: string) {
    const entity = await this.bankAccountsRepo.findOne({ where: { id, tenantId } });
    if (!entity) throw new BadRequestException('Bank account not found');
    try {
      await this.bankAccountsRepo.remove(entity);
    } catch (e: any) {
      this.logger.error(`remove failed id=${id} tenant=${tenantId} err=${e?.message || e}`);
      throw e;
    }
    return { success: true } as const;
  }
}

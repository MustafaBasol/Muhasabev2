import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not } from 'typeorm';
import { FiscalPeriod } from './entities/fiscal-period.entity';

export interface CreateFiscalPeriodDto {
  name: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface LockPeriodDto {
  lockReason?: string;
}

@Injectable()
export class FiscalPeriodsService {
  constructor(
    @InjectRepository(FiscalPeriod)
    private readonly fiscalPeriodRepository: Repository<FiscalPeriod>,
  ) {}

  async create(createDto: CreateFiscalPeriodDto, tenantId: string): Promise<FiscalPeriod> {
    // Check for overlapping periods
    const overlapping = await this.fiscalPeriodRepository.findOne({
      where: {
        tenantId,
        periodStart: Between(createDto.periodStart, createDto.periodEnd),
      },
    });

    if (overlapping) {
      throw new BadRequestException('Fiscal period overlaps with existing period');
    }

    const period = this.fiscalPeriodRepository.create({
      ...createDto,
      tenantId,
    });

    return this.fiscalPeriodRepository.save(period);
  }

  async findAll(tenantId: string): Promise<FiscalPeriod[]> {
    return this.fiscalPeriodRepository.find({
      where: { tenantId },
      relations: ['lockedByUser'],
      order: { periodStart: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<FiscalPeriod> {
    const period = await this.fiscalPeriodRepository.findOne({
      where: { id, tenantId },
      relations: ['lockedByUser'],
    });

    if (!period) {
      throw new NotFoundException('Fiscal period not found');
    }

    return period;
  }

  async update(id: string, updateDto: Partial<CreateFiscalPeriodDto>, tenantId: string): Promise<FiscalPeriod> {
    const period = await this.findOne(id, tenantId);

    // If dates are being updated, check for overlaps
    if (updateDto.periodStart || updateDto.periodEnd) {
      const startDate = updateDto.periodStart || period.periodStart;
      const endDate = updateDto.periodEnd || period.periodEnd;

      const overlapping = await this.fiscalPeriodRepository.findOne({
        where: {
          tenantId,
          id: Not(id), // Exclude current period
          periodStart: Between(startDate, endDate),
        },
      });

      if (overlapping) {
        throw new BadRequestException('Fiscal period overlaps with existing period');
      }
    }

    Object.assign(period, updateDto);
    return this.fiscalPeriodRepository.save(period);
  }

  async lockPeriod(id: string, lockDto: LockPeriodDto, tenantId: string, userId: string): Promise<FiscalPeriod> {
    const period = await this.findOne(id, tenantId);

    if (period.isLocked) {
      throw new BadRequestException('Period is already locked');
    }

    period.isLocked = true;
    period.lockedAt = new Date();
    period.lockedBy = userId;
    period.lockReason = lockDto.lockReason || null;

    return this.fiscalPeriodRepository.save(period);
  }

  async unlockPeriod(id: string, tenantId: string): Promise<FiscalPeriod> {
    const period = await this.findOne(id, tenantId);

    if (!period.isLocked) {
      throw new BadRequestException('Period is not locked');
    }

    period.isLocked = false;
    period.lockedAt = null;
    period.lockedBy = null;
    period.lockReason = null;

    return this.fiscalPeriodRepository.save(period);
  }

  async isDateInLockedPeriod(date: Date, tenantId: string): Promise<boolean> {
    const period = await this.fiscalPeriodRepository.findOne({
      where: {
        tenantId,
        isLocked: true,
        periodStart: Between(new Date(date.getTime() - 24 * 60 * 60 * 1000), new Date(date.getTime() + 24 * 60 * 60 * 1000)),
      },
    });

    if (period) {
      return date >= period.periodStart && date <= period.periodEnd;
    }

    return false;
  }

  async getLockedPeriodForDate(date: Date, tenantId: string): Promise<FiscalPeriod | null> {
    return this.fiscalPeriodRepository
      .createQueryBuilder('period')
      .where('period.tenantId = :tenantId', { tenantId })
      .andWhere('period.isLocked = :isLocked', { isLocked: true })
      .andWhere(':date BETWEEN period.periodStart AND period.periodEnd', { date })
      .getOne();
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const period = await this.findOne(id, tenantId);

    if (period.isLocked) {
      throw new BadRequestException('Cannot delete a locked period');
    }

    await this.fiscalPeriodRepository.remove(period);
  }
}
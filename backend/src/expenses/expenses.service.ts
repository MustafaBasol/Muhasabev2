import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, FindOptionsWhere } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import {
  Expense,
  ExpenseStatus,
  ExpenseCategory,
} from './entities/expense.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantPlanLimitService } from '../common/tenant-plan-limits.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseStatistics,
} from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async create(
    tenantId: string,
    createExpenseDto: CreateExpenseDto,
  ): Promise<Expense> {
    // Plan limiti: Aylık gider kaydı sayısı kontrolü
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthCount = await this.expensesRepository.count({
      where: {
        tenantId,
        isVoided: false,
        createdAt: Between(startOfMonth, now),
      },
    });
    if (
      !TenantPlanLimitService.canAddExpenseThisMonthForTenant(
        currentMonthCount,
        tenant,
      )
    ) {
      const effective = TenantPlanLimitService.getLimitsForTenant(tenant);
      throw new BadRequestException(
        TenantPlanLimitService.errorMessageForWithLimits('expense', effective),
      );
    }

    // Generate expense number if not provided
    const expenseNumber =
      createExpenseDto.expenseNumber ||
      `EXP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Map 'date' to 'expenseDate' for entity compatibility
    const { date, amount, ...restDto } = createExpenseDto;
    const expenseDate =
      restDto.expenseDate || date || new Date().toISOString().split('T')[0];
    const normalizedAmount = Number(amount ?? 0);
    const payload: DeepPartial<Expense> = {
      ...restDto,
      tenantId,
      expenseNumber,
      expenseDate,
      amount: normalizedAmount,
    };
    const expense = this.expensesRepository.create(payload);
    return this.expensesRepository.save(expense);
  }

  async findAll(tenantId: string): Promise<Expense[]> {
    return this.expensesRepository.find({
      where: { tenantId, isVoided: false },
      relations: ['supplier'],
      order: { expenseDate: 'DESC' },
    });
  }

  async findOne(
    tenantId: string,
    id: string,
    includeVoided = false,
  ): Promise<Expense> {
    const whereCondition: FindOptionsWhere<Expense> = { id, tenantId };
    if (!includeVoided) {
      whereCondition.isVoided = false;
    }

    const expense = await this.expensesRepository.findOne({
      where: whereCondition,
      relations: ['supplier', 'voidedByUser'],
    });

    if (!expense) {
      throw new NotFoundException(`Expense #${id} not found`);
    }

    return expense;
  }

  async update(
    tenantId: string,
    id: string,
    updateExpenseDto: UpdateExpenseDto,
  ): Promise<Expense> {
    console.log('ExpensesService.update called with:', {
      tenantId,
      id,
      updateExpenseDto: JSON.stringify(updateExpenseDto),
    });

    try {
      const expense = await this.findOne(tenantId, id);
      // Map 'date' to 'expenseDate' for entity compatibility
      if (updateExpenseDto.date && !updateExpenseDto.expenseDate) {
        updateExpenseDto.expenseDate = updateExpenseDto.date;
        delete updateExpenseDto.date;
      }

      if (typeof updateExpenseDto.amount !== 'undefined') {
        updateExpenseDto.amount = Number(updateExpenseDto.amount);
      }

      console.log(
        'Processed updateExpenseDto:',
        JSON.stringify(updateExpenseDto),
      );

      Object.assign(expense, updateExpenseDto);
      const savedExpense = await this.expensesRepository.save(expense);
      console.log('Updated expense found:', JSON.stringify(savedExpense));

      return savedExpense;
    } catch (error) {
      console.error('Error in ExpensesService.update:', error);
      throw error;
    }
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const expense = await this.findOne(tenantId, id);
    await this.expensesRepository.remove(expense);
  }

  async voidExpense(
    tenantId: string,
    id: string,
    userId: string,
    reason?: string,
  ): Promise<Expense> {
    const expense = await this.findOne(tenantId, id, true);

    if (expense.isVoided) {
      throw new Error('Expense is already voided');
    }

    expense.isVoided = true;
    expense.voidReason = reason ?? null;
    expense.voidedAt = new Date();
    expense.voidedBy = userId;

    return this.expensesRepository.save(expense);
  }

  async restoreExpense(tenantId: string, id: string): Promise<Expense> {
    const expense = await this.findOne(tenantId, id, true);

    if (!expense.isVoided) {
      throw new Error('Expense is not voided');
    }

    expense.isVoided = false;
    expense.voidReason = null;
    expense.voidedAt = null;
    expense.voidedBy = null;

    return this.expensesRepository.save(expense);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: ExpenseStatus,
  ): Promise<Expense> {
    const expense = await this.findOne(tenantId, id);
    expense.status = status;
    return this.expensesRepository.save(expense);
  }

  async getStatistics(tenantId: string): Promise<ExpenseStatistics> {
    const expenses = await this.findAll(tenantId);

    const total = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const paid = expenses
      .filter((exp) => exp.status === ExpenseStatus.PAID)
      .reduce((sum, exp) => sum + Number(exp.amount), 0);
    const pending = expenses
      .filter((exp) => exp.status === ExpenseStatus.PENDING)
      .reduce((sum, exp) => sum + Number(exp.amount), 0);

    const byCategory = expenses.reduce(
      (acc, exp) => {
        const cat = exp.category;
        acc[cat] = (acc[cat] || 0) + Number(exp.amount);
        return acc;
      },
      {} as Record<ExpenseCategory, number>,
    );

    return {
      total,
      paid,
      pending,
      byCategory,
      count: expenses.length,
    };
  }
}

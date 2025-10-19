import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseStatus, ExpenseCategory } from './entities/expense.entity';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
  ) {}

  async create(tenantId: string, createExpenseDto: any) {
    // Generate expense number if not provided
    const expenseNumber = createExpenseDto.expenseNumber || 
      `EXP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    
    // Map 'date' to 'expenseDate' for entity compatibility
    const expenseDate = createExpenseDto.expenseDate || createExpenseDto.date || new Date().toISOString().split('T')[0];
    
    const expense = this.expensesRepository.create({
      ...createExpenseDto,
      tenantId,
      expenseNumber,
      expenseDate,
    });
    return this.expensesRepository.save(expense);
  }

  async findAll(tenantId: string): Promise<Expense[]> {
    return this.expensesRepository.find({
      where: { tenantId },
      relations: ['supplier'],
      order: { expenseDate: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Expense> {
    const expense = await this.expensesRepository.findOne({
      where: { id, tenantId },
      relations: ['supplier'],
    });

    if (!expense) {
      throw new NotFoundException(`Expense #${id} not found`);
    }

    return expense;
  }

  async update(tenantId: string, id: string, updateExpenseDto: any): Promise<Expense> {
    const expense = await this.findOne(tenantId, id);
    
    // Map 'date' to 'expenseDate' for entity compatibility
    if (updateExpenseDto.date && !updateExpenseDto.expenseDate) {
      updateExpenseDto.expenseDate = updateExpenseDto.date;
      delete updateExpenseDto.date;
    }
    
    Object.assign(expense, updateExpenseDto);
    return this.expensesRepository.save(expense);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const expense = await this.findOne(tenantId, id);
    await this.expensesRepository.remove(expense);
  }

  async updateStatus(tenantId: string, id: string, status: ExpenseStatus): Promise<Expense> {
    const expense = await this.findOne(tenantId, id);
    expense.status = status;
    return this.expensesRepository.save(expense);
  }

  async getStatistics(tenantId: string) {
    const expenses = await this.findAll(tenantId);
    
    const total = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const paid = expenses.filter(exp => exp.status === ExpenseStatus.PAID).reduce((sum, exp) => sum + Number(exp.amount), 0);
    const pending = expenses.filter(exp => exp.status === ExpenseStatus.PENDING).reduce((sum, exp) => sum + Number(exp.amount), 0);
    
    const byCategory = expenses.reduce((acc, exp) => {
      const cat = exp.category;
      acc[cat] = (acc[cat] || 0) + Number(exp.amount);
      return acc;
    }, {} as Record<ExpenseCategory, number>);

    return {
      total,
      paid,
      pending,
      byCategory,
      count: expenses.length,
    };
  }
}

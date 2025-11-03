import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PeriodLockGuard } from '../common/guards/period-lock.guard';
import { ExpensesService } from './expenses.service';
import { ExpenseStatus } from './entities/expense.entity';
import { Audit } from '../audit/audit.interceptor';
import { AuditAction } from '../audit/entities/audit-log.entity';

@ApiTags('expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @UseGuards(PeriodLockGuard)
  @Audit('Expense', AuditAction.CREATE)
  create(@Req() req: any, @Body() createExpenseDto: any) {
    return this.expensesService.create(req.user.tenantId, createExpenseDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.expensesService.findAll(req.user.tenantId);
  }

  @Get('statistics')
  getStatistics(@Req() req: any) {
    return this.expensesService.getStatistics(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.expensesService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @UseGuards(PeriodLockGuard)
  @Audit('Expense', AuditAction.UPDATE)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateExpenseDto: any,
  ) {
    return this.expensesService.update(req.user.tenantId, id, updateExpenseDto);
  }

  @Patch(':id/status')
  @Audit('Expense', AuditAction.UPDATE)
  updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: ExpenseStatus,
  ) {
    return this.expensesService.updateStatus(req.user.tenantId, id, status);
  }

  @Delete(':id')
  @UseGuards(PeriodLockGuard)
  @Audit('Expense', AuditAction.DELETE)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.expensesService.remove(req.user.tenantId, id);
  }

  @Patch(':id/void')
  @Audit('Expense', AuditAction.UPDATE)
  voidExpense(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.expensesService.voidExpense(
      req.user.tenantId,
      id,
      req.user.userId,
      reason,
    );
  }

  @Patch(':id/restore')
  @Audit('Expense', AuditAction.UPDATE)
  restoreExpense(@Req() req: any, @Param('id') id: string) {
    return this.expensesService.restoreExpense(req.user.tenantId, id);
  }
}

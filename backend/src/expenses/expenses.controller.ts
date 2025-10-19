import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExpensesService } from './expenses.service';
import { ExpenseStatus } from './entities/expense.entity';

@ApiTags('expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
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
  update(@Req() req: any, @Param('id') id: string, @Body() updateExpenseDto: any) {
    return this.expensesService.update(req.user.tenantId, id, updateExpenseDto);
  }

  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: ExpenseStatus) {
    return this.expensesService.updateStatus(req.user.tenantId, id, status);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.expensesService.remove(req.user.tenantId, id);
  }
}

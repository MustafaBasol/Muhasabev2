import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeriodLockGuard } from './guards/period-lock.guard';
import { FiscalPeriodsModule } from '../fiscal-periods/fiscal-periods.module';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { TurnstileService } from './turnstile.service';

@Global()
@Module({
  imports: [FiscalPeriodsModule, TypeOrmModule.forFeature([Invoice, Expense])],
  providers: [PeriodLockGuard, TurnstileService],
  exports: [PeriodLockGuard, FiscalPeriodsModule, TypeOrmModule, TurnstileService],
})
export class CommonModule {}

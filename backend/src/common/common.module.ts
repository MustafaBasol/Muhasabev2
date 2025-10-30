import { Module, Global } from '@nestjs/common';
import { PeriodLockGuard } from './guards/period-lock.guard';
import { FiscalPeriodsModule } from '../fiscal-periods/fiscal-periods.module';

@Global()
@Module({
  imports: [FiscalPeriodsModule],
  providers: [PeriodLockGuard],
  exports: [PeriodLockGuard, FiscalPeriodsModule],
})
export class CommonModule {}
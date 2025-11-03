import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiscalPeriodsService } from './fiscal-periods.service';
import { FiscalPeriodsController } from './fiscal-periods.controller';
import { FiscalPeriod } from './entities/fiscal-period.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FiscalPeriod])],
  controllers: [FiscalPeriodsController],
  providers: [FiscalPeriodsService],
  exports: [FiscalPeriodsService],
})
export class FiscalPeriodsModule {}

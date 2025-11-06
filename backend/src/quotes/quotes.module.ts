import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { Quote } from './entities/quote.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Quote, Tenant, BankAccount])],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}

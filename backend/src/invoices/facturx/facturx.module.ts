import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceLine } from '../entities/invoice-line.entity';
import { FacturXService } from './facturx.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLine]),
  ],
  providers: [FacturXService],
  exports: [FacturXService],
})
export class FacturXModule {}

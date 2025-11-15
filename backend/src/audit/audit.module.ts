import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AttributionService } from './attribution.service';
import { Quote } from '../quotes/entities/quote.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Product } from '../products/entities/product.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      Quote,
      Sale,
      Invoice,
      Expense,
      Product,
      Customer,
      Supplier,
    ]),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor, AttributionService],
  exports: [AuditService, AuditInterceptor, AttributionService],
})
export class AuditModule {}

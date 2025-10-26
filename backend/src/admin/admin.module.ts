import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Product } from '../products/entities/product.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { ProductCategory } from '../products/entities/product-category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Tenant,
      Customer,
      Supplier,
      Product,
      ProductCategory,
      Invoice,
      Expense,
    ]),
  ],
  controllers: [AdminController, BackupController],
  providers: [AdminService, BackupService],
  exports: [AdminService, BackupService],
})
export class AdminModule {}
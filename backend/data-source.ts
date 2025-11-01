import { DataSource } from 'typeorm';
import { Tenant } from 'src/tenants/entities/tenant.entity';
import { User } from 'src/users/entities/user.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { Product } from 'src/products/entities/product.entity';
import { ProductCategory } from 'src/products/entities/product-category.entity';
import { Invoice } from 'src/invoices/entities/invoice.entity';

import { Expense } from 'src/expenses/entities/expense.entity';
import { AuditLog } from 'src/audit/entities/audit-log.entity';
import { FiscalPeriod } from 'src/fiscal-periods/entities/fiscal-period.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433'),
  username: process.env.DATABASE_USER || 'moneyflow',
  password: process.env.DATABASE_PASSWORD || 'moneyflow123',
  database: process.env.DATABASE_NAME || 'moneyflow_dev',
  entities: [
    Tenant,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
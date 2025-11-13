import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { SecurityService } from '../common/security.service';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Product } from '../products/entities/product.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Sale } from '../sales/entities/sale.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Invite } from '../organizations/entities/invite.entity';
import { AdminOrganizationsController } from './admin-organizations.controller';
import { EmailModule } from '../email/email.module';
import { PlanLimitsService } from './plan-limits.service';
import { PlanLimitsLoader } from './plan-limits.loader';
import { SuppressionAdminController } from './suppression.controller';
import { BillingModule } from '../billing/billing.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    EmailModule,
    forwardRef(() => OrganizationsModule),
    TypeOrmModule.forFeature([
      User,
      Tenant,
      Customer,
      Supplier,
      Product,
      ProductCategory,
      Invoice,
  Expense,
  Sale,
  BankAccount,
      AuditLog,
      Organization,
      OrganizationMember,
      Invite,
    ]),
    BillingModule,
  ],
  controllers: [
    AdminController,
    BackupController,
    AdminOrganizationsController,
    SuppressionAdminController,
  ],
  providers: [
    AdminService,
    BackupService,
    SecurityService,
    PlanLimitsService,
    PlanLimitsLoader,
  ],
  exports: [AdminService, BackupService, PlanLimitsService],
})
export class AdminModule {}

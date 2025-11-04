import { Module } from '@nestjs/common';
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
import { ProductCategory } from '../products/entities/product-category.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Invite } from '../organizations/entities/invite.entity';
import { AdminOrganizationsController } from './admin-organizations.controller';
import { EmailService } from '../services/email.service';
import { PlanLimitsService } from './plan-limits.service';
import { PlanLimitsLoader } from './plan-limits.loader';

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
      AuditLog,
      Organization,
      OrganizationMember,
      Invite,
    ]),
  ],
  controllers: [
    AdminController,
    BackupController,
    AdminOrganizationsController,
  ],
  providers: [
    AdminService,
    BackupService,
    SecurityService,
    EmailService,
    PlanLimitsService,
    PlanLimitsLoader,
  ],
  exports: [AdminService, BackupService, PlanLimitsService],
})
export class AdminModule {}

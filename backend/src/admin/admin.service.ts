import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  Between,
  FindOptionsWhere,
  FindOptionsSelect,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  Tenant,
  SubscriptionPlan,
  TenantStatus,
} from '../tenants/entities/tenant.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Product } from '../products/entities/product.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Sale } from '../sales/entities/sale.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import { AuditLog, AuditAction } from '../audit/entities/audit-log.entity';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { SecurityService } from '../common/security.service';
import { AdminConfig } from './entities/admin-config.entity';
import { AdminSecurityService } from './admin-security.service';
import { EmailService } from '../services/email.service';
import {
  TenantPlanLimitService,
  TenantPlanOverrides,
} from '../common/tenant-plan-limits.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { Role } from '../common/enums/organization.enum';

const USER_ROLE_SET = new Set<UserRole>(Object.values(UserRole) as UserRole[]);

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && USER_ROLE_SET.has(value as UserRole);

const coerceUserRole = (value?: string): UserRole =>
  value && isUserRole(value) ? value : UserRole.USER;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

type InformationSchemaColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | number | null;
};

type CountRow = { count: string };

type ColumnNameRow = { column_name: string };

type ExistsRow = { exists: boolean | number | string };

type TenantBackupSummary = {
  timestamp: string;
  tenant: {
    id: string;
    name: string;
    plan: SubscriptionPlan;
  };
  counts: {
    users: number;
    customers: number;
    suppliers: number;
    products: number;
    invoices: number;
    expenses: number;
  };
};

const isInformationSchemaColumnRow = (
  value: unknown,
): value is InformationSchemaColumnRow =>
  isRecord(value) &&
  typeof value.table_name === 'string' &&
  typeof value.column_name === 'string' &&
  typeof value.data_type === 'string' &&
  (value.is_nullable === 'YES' || value.is_nullable === 'NO') &&
  (typeof value.column_default === 'string' ||
    typeof value.column_default === 'number' ||
    value.column_default === null);

const isCountRow = (value: unknown): value is CountRow =>
  isRecord(value) && typeof value.count === 'string';

const isColumnNameRow = (value: unknown): value is ColumnNameRow =>
  isRecord(value) && typeof value.column_name === 'string';

const isExistsRow = (value: unknown): value is ExistsRow =>
  isRecord(value) &&
  (typeof value.exists === 'boolean' ||
    typeof value.exists === 'number' ||
    typeof value.exists === 'string');

const parseCountFromRows = (rows: unknown): number => {
  if (!Array.isArray(rows)) {
    return 0;
  }
  const row = rows.find(isCountRow);
  return row ? Number.parseInt(row.count, 10) || 0 : 0;
};

const parseExistsFlag = (rows: unknown): boolean => {
  if (!Array.isArray(rows)) {
    return false;
  }
  const row = rows.find(isExistsRow);
  if (!row) {
    return false;
  }

  const value = row.exists;
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  const normalized = value.toLowerCase();
  return normalized === 't' || normalized === 'true' || normalized === '1';
};

const normalizeRecordRows = (rows: unknown): Record<string, unknown>[] =>
  Array.isArray(rows) ? rows.filter(isRecord) : [];

const extractPlanOverrides = (
  settings: Tenant['settings'],
): TenantPlanOverrides | undefined => {
  if (!isRecord(settings)) {
    return undefined;
  }
  const candidate = settings.planOverrides;
  if (!isRecord(candidate)) {
    return undefined;
  }

  const overrides: TenantPlanOverrides = {};

  if (typeof candidate.maxUsers === 'number') {
    overrides.maxUsers = candidate.maxUsers;
  }
  if (typeof candidate.maxCustomers === 'number') {
    overrides.maxCustomers = candidate.maxCustomers;
  }
  if (typeof candidate.maxSuppliers === 'number') {
    overrides.maxSuppliers = candidate.maxSuppliers;
  }
  if (typeof candidate.maxBankAccounts === 'number') {
    overrides.maxBankAccounts = candidate.maxBankAccounts;
  }

  if (isRecord(candidate.monthly)) {
    overrides.monthly = {};
    if (typeof candidate.monthly.maxInvoices === 'number') {
      overrides.monthly.maxInvoices = candidate.monthly.maxInvoices;
    }
    if (typeof candidate.monthly.maxExpenses === 'number') {
      overrides.monthly.maxExpenses = candidate.monthly.maxExpenses;
    }
    if (overrides.monthly && Object.keys(overrides.monthly).length === 0) {
      delete overrides.monthly;
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
};
import { BillingService } from '../billing/billing.service';

@Injectable()
export class AdminService {
  private activeAdminTokens: Set<string> = new Set();
  private readonly logger = new Logger('AdminService');
  // Basit throttle: aynı tenant için 15 sn içinde tekrar sync tetikleme
  private lastAdminSyncTrigger: Map<string, number> = new Map();
  // Stripe tarafını gereksiz yere sık çağırmamak için hafif kontrol throttling'i
  private lastAdminStripeCheck: Map<string, number> = new Map();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Expense)
    private expenseRepository: Repository<Expense>,
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(BankAccount)
    private bankAccountRepository: Repository<BankAccount>,
    @InjectRepository(ProductCategory)
    private productCategoryRepository: Repository<ProductCategory>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private dataSource: DataSource,
    private securityService: SecurityService,
    private emailService: EmailService,
    private readonly billingService: BillingService,
    @InjectRepository(AdminConfig)
    private adminConfigRepo: Repository<AdminConfig>,
    private readonly adminSecurity: AdminSecurityService,
    @Inject(forwardRef(() => OrganizationsService))
    private readonly organizationsService: OrganizationsService,
  ) {}

  async adminLogin(username: string, password: string, totp?: string) {
    // Güvenli admin kontrolü - environment variables'dan al
    // 1) Öncelik: AdminConfig (DB)
    const cfg = await this.adminConfigRepo.findOne({ where: { id: 1 } });
    if (cfg) {
      const ok = await this.adminSecurity.validateLogin(
        username,
        password,
        totp,
      );
      if (!ok)
        throw new UnauthorizedException(
          'Invalid admin credentials or 2FA code',
        );
    } else {
      // 2) Fallback: Env değişkenleri (eski davranış)
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH; // bcrypt hash
      const adminPasswordPlain = process.env.ADMIN_PASSWORD; // opsiyonel düz şifre (sadece dev)

      if (username !== adminUsername) {
        throw new UnauthorizedException('Invalid admin credentials');
      }

      let isPasswordValid = false;
      if (adminPasswordHash) {
        isPasswordValid = await this.securityService.comparePassword(
          password,
          adminPasswordHash,
        );
      } else if (adminPasswordPlain) {
        isPasswordValid = password === adminPasswordPlain;
        if (!isPasswordValid) {
          throw new UnauthorizedException('Invalid admin credentials');
        }
        console.warn('⚠️ Using ADMIN_PASSWORD (dev only).');
      } else {
        const defaultDevPassword = 'admin123';
        isPasswordValid = password === defaultDevPassword;
        if (!isPasswordValid) {
          throw new UnauthorizedException('Admin credentials not configured');
        }
        console.warn(
          '⚠️ Falling back to default dev credentials (admin/admin123).',
        );
      }
    }

    // Güvenli random token üret
    const adminToken = this.securityService.generateRandomString(32);

    // Token'ı geçici olarak cache'de sakla (Redis kullanılmalı)
    // Şu an basit in-memory cache kullanıyoruz
    this.activeAdminTokens = this.activeAdminTokens || new Set();
    this.activeAdminTokens.add(adminToken);

    // 1 saat sonra token'ı geçersiz kıl
    setTimeout(
      () => {
        this.activeAdminTokens?.delete(adminToken);
      },
      60 * 60 * 1000,
    );

    return {
      success: true,
      message: 'Admin login successful',
      adminToken,
      expiresIn: '1h',
    };
  }

  /**
   * Admin token doğrulama
   */
  isValidAdminToken(token: string): boolean {
    return this.activeAdminTokens.has(token);
  }

  /**
   * Admin token iptal et
   */
  revokeAdminToken(token: string): void {
    this.activeAdminTokens.delete(token);
  }

  async getAllUsers(tenantId?: string) {
    const where: FindOptionsWhere<User> = {};
    if (tenantId) {
      where.tenantId = tenantId;
    }
    const select: FindOptionsSelect<User> = {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      isEmailVerified: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      lastLoginTimeZone: true,
      lastLoginUtcOffsetMinutes: true,
      createdAt: true,
      tenantId: true,
      tenant: {
        id: true,
        name: true,
        slug: true,
        companyName: true,
      },
    };
    return this.userRepository.find({
      where,
      relations: ['tenant'],
      select,
    });
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.isActive = !!isActive;
    await this.userRepository.save(user);
    return { success: true };
  }

  async markUserEmailVerified(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const alreadyVerified = user.isEmailVerified === true;
    if (!alreadyVerified) {
      user.isEmailVerified = true;
      user.emailVerifiedAt = new Date();
      user.emailVerificationToken = undefined;
      user.emailVerificationSentAt = undefined;
      await this.userRepository.save(user);
    }
    return { success: true, alreadyVerified };
  }

  async updateUser(
    userId: string,
    payload: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      role?: string;
    },
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const patch: QueryDeepPartialEntity<User> = {};
    if (payload.firstName !== undefined) patch.firstName = payload.firstName;
    if (payload.lastName !== undefined) patch.lastName = payload.lastName;
    if (payload.email !== undefined) patch.email = payload.email;
    if (payload.role !== undefined) {
      // Normalize and validate against enum
      const allowed = new Set<string>(Object.values(UserRole));
      const nextRole = String(payload.role) as UserRole;
      if (!allowed.has(nextRole)) {
        throw new BadRequestException('Invalid role');
      }
      patch.role = nextRole;
    }

    // Phone alanını tabloya ekleyip güncellemeye çalış (kolon yoksa sessiz geç)
    if (payload.phone !== undefined) {
      try {
        await this.dataSource.query(
          'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(50)',
        );
        await this.dataSource.query(
          'UPDATE "users" SET "phone" = $1 WHERE id = $2',
          [payload.phone, userId],
        );
      } catch (err) {
        // Yumuşak hata: phone kolonu eklenemezse veya yazılamazsa logla ve devam et
        const reason = err instanceof Error ? err.message : String(err);
        console.warn('Phone column update skipped:', reason);
      }
    }

    if (Object.keys(patch).length > 0) {
      await this.userRepository.update(userId, patch);
    }
    return { success: true };
  }

  async updateUserTenant(userId: string, tenantId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await this.userRepository.update(userId, { tenantId: tenant.id });
    return { success: true, userId, tenantId: tenant.id };
  }

  /**
   * Admin: Doğrulamasız kullanıcı ekle/ata
   * - Eğer email mevcutsa kullanıcıyı hedef tenant'a taşır/günceller
   * - Yoksa yeni kullanıcı oluşturur
   * - E-posta doğrulamasını atlar (isEmailVerified=true)
   * - Şifre body.password varsa onu hash’ler, yoksa güçlü geçici bir parola üretir
   * - Plan kullanıcı limiti kontrolü yapar (Stripe koltuk/override ve plan varsayılanları dikkate alınır)
   */
  async addUserToTenant(
    tenantId: string,
    payload: {
      email: string;
      firstName?: string;
      lastName?: string;
      role?: string;
      password?: string;
      autoPassword?: boolean;
      activate?: boolean;
    },
  ) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const currentActiveUsers = await this.userRepository.count({
      where: { tenantId, isActive: true },
    });

    // Efektif kullanıcı limiti: Stripe aboneliği varsa tenant.maxUsers, yoksa plan+override
    let effectiveMaxUsers: number;
    if (tenant.stripeSubscriptionId && Number.isFinite(tenant.maxUsers)) {
      effectiveMaxUsers = Math.max(0, Number(tenant.maxUsers));
    } else {
      const limits = TenantPlanLimitService.getLimitsForTenant(tenant);
      effectiveMaxUsers = limits.maxUsers;
    }

    const canAdd =
      effectiveMaxUsers === -1 || currentActiveUsers < effectiveMaxUsers;
    if (!canAdd) {
      const limits =
        tenant.stripeSubscriptionId && Number.isFinite(tenant.maxUsers)
          ? {
              maxUsers: effectiveMaxUsers,
              monthly: { maxInvoices: -1, maxExpenses: -1 },
              maxCustomers: -1,
              maxSuppliers: -1,
              maxBankAccounts: -1,
            }
          : TenantPlanLimitService.getLimitsForTenant(tenant);
      const msg = TenantPlanLimitService.errorMessageForWithLimits(
        'user',
        limits,
      );
      throw new BadRequestException(
        msg || 'Plan limitine ulaşıldı: Kullanıcı eklenemiyor',
      );
    }

    const email = String(payload.email).trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    const now = new Date();
    let tempPassword: string | undefined;
    let passwordHash: string | undefined;
    if (payload.password && payload.password.length >= 8) {
      passwordHash = await this.securityService.hashPassword(payload.password);
    } else {
      // Otomatik güçlü parola üret
      tempPassword = this.securityService.generateRandomString(12);
      passwordHash = await this.securityService.hashPassword(tempPassword);
    }

    const role = coerceUserRole(payload.role);
    const firstName = payload.firstName || '';
    const lastName = payload.lastName || '';
    const activate = payload.activate !== false; // varsayılan true
    const orgRole = role === UserRole.TENANT_ADMIN ? Role.ADMIN : Role.MEMBER;

    if (user) {
      // Mevcut kullanıcıyı güncelle ve tenant'a ata
      await this.userRepository.update(user.id, {
        tenantId: tenant.id,
        firstName,
        lastName,
        role,
        isActive: activate,
        isEmailVerified: true,
        emailVerifiedAt: now,
        password: passwordHash || user.password,
      });
      await this.ensureTenantOrganizationMembership(
        tenant.id,
        user.id,
        orgRole,
      );
      return {
        success: true,
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        tempPassword,
        updated: true,
      };
    }

    // Yeni kullanıcı oluştur
    const created = this.userRepository.create({
      email,
      password: passwordHash,
      firstName,
      lastName,
      role,
      isActive: activate,
      isEmailVerified: true,
      emailVerifiedAt: now,
      tenantId: tenant.id,
    });
    const savedUser = await this.userRepository.save(created);
    await this.ensureTenantOrganizationMembership(
      tenant.id,
      savedUser.id,
      orgRole,
    );
    return {
      success: true,
      userId: savedUser.id,
      email: savedUser.email,
      tenantId: tenant.id,
      tempPassword,
      created: true,
    };
  }

  private async ensureTenantOrganizationMembership(
    tenantId: string,
    userId: string,
    orgRole: Role,
  ): Promise<void> {
    try {
      await this.organizationsService.attachUserToTenantOrganization(
        tenantId,
        userId,
        { role: orgRole },
      );
    } catch (error) {
      this.logger.warn(
        `ensureTenantOrganizationMembership failed for tenant ${tenantId}, user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async updateTenantBasic(
    tenantId: string,
    payload: { name?: string; companyName?: string },
  ) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (payload.name !== undefined) tenant.name = payload.name;
    if (payload.companyName !== undefined)
      tenant.companyName = payload.companyName;

    await this.tenantRepository.save(tenant);
    return { success: true };
  }

  private normalizeFrontendBaseUrl(value?: string | null): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const tryParse = (candidate: string) => {
      try {
        const parsed = new URL(candidate);
        return parsed.origin;
      } catch {
        return undefined;
      }
    };
    return (
      tryParse(trimmed) ||
      (trimmed.startsWith('http') ? undefined : tryParse(`https://${trimmed}`))
    );
  }

  private detectAdminCodespaceFrontendOrigin(): string | undefined {
    const name = process.env.CODESPACE_NAME;
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
    if (name && domain) {
      const port =
        process.env.CODESPACE_FRONTEND_PORT ||
        process.env.FRONTEND_PORT ||
        process.env.VITE_PORT ||
        '5174';
      return `https://${name}-${port}.${domain}`;
    }
    return undefined;
  }

  private resolveAdminFrontendBaseUrl(): string {
    const candidates = [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_PUBLIC_URL,
      process.env.APP_PUBLIC_URL,
      process.env.APP_URL,
    ];
    for (const candidate of candidates) {
      const normalized = this.normalizeFrontendBaseUrl(candidate);
      if (normalized) {
        return normalized;
      }
    }
    const codespaceOrigin = this.detectAdminCodespaceFrontendOrigin();
    if (codespaceOrigin) {
      return codespaceOrigin;
    }
    return 'http://localhost:5174';
  }

  async sendPasswordReset(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Gerçek reset token üret ve DB'de sakla
    const token = this.securityService.generateRandomString(24);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.userRepository.update(user.id, {
      passwordResetToken: token,
      passwordResetExpiresAt: expiresAt,
    });
    const frontendBase = this.resolveAdminFrontendBaseUrl();
    const resetLink = `${frontendBase}/#reset-password?token=${token}`;

    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `<p>Hello ${user.firstName || ''} ${user.lastName || ''},</p>
             <p>You can reset your password using the secure link below:</p>
             <p><a href="${resetLink}">${resetLink}</a></p>
             <p>This link will expire in one hour.</p>`,
    });

    return { success: true, message: 'Password reset email sent' };
  }

  async getAllTenants(filters?: {
    status?: TenantStatus;
    plan?: SubscriptionPlan;
    startFrom?: string;
    startTo?: string;
  }) {
    const qb = this.tenantRepository
      .createQueryBuilder('tenant')
      .leftJoinAndSelect('tenant.users', 'user');

    if (filters?.status) {
      qb.andWhere('tenant.status = :status', { status: filters.status });
    }
    if (filters?.plan) {
      qb.andWhere('tenant.subscriptionPlan = :plan', { plan: filters.plan });
    }
    if (filters?.startFrom) {
      const from = new Date(filters.startFrom);
      if (isNaN(from.getTime()))
        throw new BadRequestException('Invalid startFrom date');
      qb.andWhere('tenant.createdAt >= :from', { from });
    }
    if (filters?.startTo) {
      const to = new Date(filters.startTo);
      if (isNaN(to.getTime()))
        throw new BadRequestException('Invalid startTo date');
      qb.andWhere('tenant.createdAt <= :to', { to });
    }

    const tenants = await qb.orderBy('tenant.createdAt', 'DESC').getMany();

    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const [
          customerCount,
          supplierCount,
          productCount,
          invoiceCount,
          expenseCount,
        ] = await Promise.all([
          this.customerRepository.count({ where: { tenantId: tenant.id } }),
          this.supplierRepository.count({ where: { tenantId: tenant.id } }),
          this.productRepository.count({ where: { tenantId: tenant.id } }),
          this.invoiceRepository.count({ where: { tenantId: tenant.id } }),
          this.expenseRepository.count({ where: { tenantId: tenant.id } }),
        ]);

        return {
          ...tenant,
          stats: {
            customers: customerCount,
            suppliers: supplierCount,
            products: productCount,
            invoices: invoiceCount,
            expenses: expenseCount,
            users: tenant.users?.length || 0,
          },
        };
      }),
    );

    return tenantsWithStats;
  }

  async getUserData(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tenant'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.getTenantData(user.tenantId);
  }

  async getTenantData(tenantId: string) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ['users'],
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [
      customers,
      suppliers,
      products,
      productCategories,
      invoices,
      expenses,
    ] = await Promise.all([
      this.customerRepository.find({ where: { tenantId } }),
      this.supplierRepository.find({ where: { tenantId } }),
      this.productRepository.find({ where: { tenantId } }),
      this.productCategoryRepository.find({ where: { tenantId } }),
      this.invoiceRepository.find({
        where: { tenantId },
        relations: ['customer'],
      }),
      this.expenseRepository.find({
        where: { tenantId },
        relations: ['supplier'],
      }),
    ]);

    return {
      tenant,
      data: {
        customers,
        suppliers,
        products,
        productCategories,
        invoices,
        expenses,
      },
      stats: {
        customers: customers.length,
        suppliers: suppliers.length,
        products: products.length,
        productCategories: productCategories.length,
        invoices: invoices.length,
        expenses: expenses.length,
        users: tenant.users?.length || 0,
      },
    };
  }

  // Consolidated overview for a tenant: users, limits, usage, org members & invites
  async getTenantOverview(tenantId: string) {
    const base = await this.getTenantLimits(tenantId); // includes tenant, limits, usage

    // Users
    const users = await this.userRepository.find({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        lastLoginTimeZone: true,
        lastLoginUtcOffsetMinutes: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' as const },
    });

    // Organization members and invites (if organizations feature is used)
    let organizations: Record<string, unknown>[] = [];
    let invites: Record<string, unknown>[] = [];
    try {
      const orgs: unknown = await this.dataSource.query(
        'SELECT o.* FROM organizations o ORDER BY o."createdAt" DESC LIMIT 20',
      );
      organizations = normalizeRecordRows(orgs);
      // Davetleri tenant'a göre filtrele: OWNER üyesinin tenantId'si bu tenant olan organizasyonların davetleri
      const inv: unknown = await this.dataSource.query(
        `
        SELECT i.*, o.name as "organizationName"
        FROM invites i
        JOIN organizations o ON o.id = i."organizationId"
        JOIN organization_members m ON m."organizationId" = i."organizationId" AND m.role = 'OWNER'
        JOIN users u ON u.id = m."userId"
        WHERE u."tenantId" = $1
        ORDER BY i."createdAt" DESC
        LIMIT 200
        `,
        [tenantId],
      );
      invites = normalizeRecordRows(inv);
    } catch {
      // organizations veya invites tabloları yoksa sessizce geç
    }

    return {
      success: true,
      tenant: base.tenant,
      limits: base.limits,
      usage: base.usage,
      users,
      organizations,
      invites,
    };
  }

  async updateTenantSubscription(
    tenantId: string,
    payload: {
      plan?: SubscriptionPlan;
      status?: TenantStatus;
      nextBillingAt?: string;
      cancel?: boolean;
    },
  ) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (payload.cancel) {
      tenant.status = TenantStatus.SUSPENDED;
      tenant.subscriptionExpiresAt = new Date();
    }
    if (payload.plan) {
      const oldPlan = tenant.subscriptionPlan;
      tenant.subscriptionPlan = payload.plan;

      // Plan değiştiğinde tüm limitleri yeni planın varsayılan değerlerine sıfırla
      if (oldPlan !== payload.plan) {
        console.log(`[Admin] Plan değişikliği: ${oldPlan} -> ${payload.plan}`);

        // maxUsers değerini planın varsayılanıyla güncelle
        if (
          payload.plan === SubscriptionPlan.PROFESSIONAL ||
          payload.plan === SubscriptionPlan.BASIC
        ) {
          tenant.maxUsers = 3;
          console.log(`[Admin] maxUsers = 3 (PROFESSIONAL/BASIC)`);
        } else if (payload.plan === SubscriptionPlan.ENTERPRISE) {
          tenant.maxUsers = 10;
          console.log(`[Admin] maxUsers = 10 (ENTERPRISE)`);
        } else if (payload.plan === SubscriptionPlan.FREE) {
          tenant.maxUsers = 1;
          console.log(`[Admin] maxUsers = 1 (FREE)`);
        }

        // Manuel plan değişikliği yapıldığında Stripe entegrasyonunu temizle
        // Böylece Stripe'dan gelen bilgiler database bilgisini ezmez
        if (tenant.stripeSubscriptionId || tenant.stripeCustomerId) {
          console.log(
            `[Admin] Stripe entegrasyonu temizleniyor (stripeCustomerId: ${tenant.stripeCustomerId}, stripeSubscriptionId: ${tenant.stripeSubscriptionId})`,
          );
          tenant.stripeSubscriptionId = null;
          tenant.stripeCustomerId = null;
          tenant.billingInterval = null;
          // Ödeme planı tarihi - FREE için null, diğerleri için 1 yıl sonra
          if (payload.plan === SubscriptionPlan.FREE) {
            tenant.subscriptionExpiresAt = null;
            tenant.status = TenantStatus.ACTIVE;
          } else {
            // Ücretli planlarda 1 yıl süre ver
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            tenant.subscriptionExpiresAt = nextYear;
            tenant.status = TenantStatus.ACTIVE;
          }
        }

        // Tenant'a özel override'ları temizle (artık varsayılan plan limitleri geçerli olacak)
        if (isRecord(tenant.settings) && 'planOverrides' in tenant.settings) {
          const settings = { ...tenant.settings } as Record<string, unknown>;
          delete settings.planOverrides;
          tenant.settings = settings;
          console.log(`[Admin] planOverrides temizlendi`);
        }

        // Plan düşürme: aktif kullanıcı sayısı yeni limite göre fazla ise uyarı durumu ayarla
        try {
          const activeUsers = await this.userRepository.count({
            where: { tenantId: tenant.id, isActive: true },
          });
          const maxAllowed = Math.max(0, Number(tenant.maxUsers || 0));
          const excess = activeUsers - maxAllowed;
          if (excess > 0) {
            // 7 gün süre ver
            const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            tenant.requiredUserReduction = excess;
            tenant.downgradePendingUntil = deadline;
            console.log(
              `[Admin] Plan düşürme beklemede: aktif=${activeUsers} > limit=${maxAllowed}, reduction=${excess}, deadline=${deadline.toISOString()}`,
            );
          } else {
            // Fazla yoksa alanları temizle
            tenant.requiredUserReduction = null;
            tenant.downgradePendingUntil = null;
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          console.warn('Plan düşürme değerlendirmesi yapılamadı:', reason);
        }
      }
    }
    if (payload.status) {
      tenant.status = payload.status;
    }
    if (payload.nextBillingAt) {
      const dt = new Date(payload.nextBillingAt);
      if (isNaN(dt.getTime()))
        throw new BadRequestException('Invalid nextBillingAt');
      tenant.subscriptionExpiresAt = dt;
    }

    await this.tenantRepository.save(tenant);
    console.log(
      `[Admin] Tenant kaydedildi - ID: ${tenant.id}, Plan: ${tenant.subscriptionPlan}, maxUsers: ${tenant.maxUsers}`,
    );
    return { success: true };
  }

  async getAllTables() {
    const query = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name NOT LIKE 'pg_%'
      AND table_name != 'migrations'
      ORDER BY table_name, ordinal_position
    `;

    const columnsResult: unknown = await this.dataSource.query(query);
    const columns = Array.isArray(columnsResult)
      ? columnsResult.filter(isInformationSchemaColumnRow)
      : [];

    // Tabloları grupla (tip güvenli)
    type TableInfo = {
      name: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        default: string | number | null;
      }>;
      recordCount?: number;
    };

    const tables: Record<string, TableInfo> = {};
    for (const col of columns) {
      if (!tables[col.table_name]) {
        tables[col.table_name] = {
          name: col.table_name,
          columns: [],
        };
      }
      tables[col.table_name].columns.push({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        default: col.column_default,
      });
    }

    // Her tablo için kayıt sayısını al
    const tableList = Object.values(tables);
    for (const table of tableList) {
      try {
        const countResult: unknown = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM "${table.name}"`,
        );
        table.recordCount = parseCountFromRows(countResult);
      } catch (error) {
        table.recordCount = 0;
      }
    }

    return tableList;
  }

  async getTableData(
    tableName: string,
    tenantId?: string,
    limit = 100,
    offset = 0,
  ) {
    // Güvenlik kontrolü - sadece belirli tablolara erişim
    const allowedTables = [
      'users',
      'tenants',
      'customers',
      'suppliers',
      'products',
      'product_categories',
      'invoices',
      'expenses',
    ];

    if (!allowedTables.includes(tableName)) {
      throw new UnauthorizedException('Access to this table is not allowed');
    }

    let query = `SELECT * FROM "${tableName}"`;
    const params: Array<string | number> = [];

    let includeTenantFilter = false;
    if (tenantId && tableName !== 'tenants') {
      includeTenantFilter = await this.tableHasTenantIdColumn(tableName);
    }

    if (includeTenantFilter && tenantId) {
      query += ` WHERE "tenantId" = $1`;
      params.push(tenantId);
    }

    const limitPlaceholder = params.length + 1;
    const offsetPlaceholder = params.length + 2;
    query += ` ORDER BY "createdAt" DESC LIMIT $${limitPlaceholder} OFFSET $${offsetPlaceholder}`;
    params.push(limit, offset);

    const dataResult: unknown = await this.dataSource.query(query, params);
    const data = normalizeRecordRows(dataResult);

    // Toplam kayıt sayısını al
    let countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const countParams: Array<string | number> = [];

    if (includeTenantFilter && tenantId) {
      countQuery += ` WHERE "tenantId" = $1`;
      countParams.push(tenantId);
    }

    const countResult: unknown = await this.dataSource.query(
      countQuery,
      countParams,
    );
    const totalCount = parseCountFromRows(countResult);

    return {
      tableName,
      data,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    };
  }

  private async tableHasTenantIdColumn(tableName: string): Promise<boolean> {
    const rows: unknown = await this.dataSource.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'tenantId'
      `,
      [tableName],
    );

    if (!Array.isArray(rows)) {
      return false;
    }

    return rows.some(
      (row) => isColumnNameRow(row) && row.column_name === 'tenantId',
    );
  }

  // Data Retention Methods

  async getRetentionConfig() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'retention.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      const configRaw: unknown = JSON.parse(configData);
      const config = isRecord(configRaw) ? configRaw : {};

      return {
        success: true,
        config,
        configPath,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: 'Failed to load retention configuration: ' + reason,
      };
    }
  }

  async getRetentionStatus() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 274); // 9 months for logs

      // Get audit logs eligible for purge
      const eligibleAuditLogs = await this.auditLogRepository
        .createQueryBuilder('audit')
        .where('audit.createdAt < :cutoffDate', { cutoffDate })
        .getCount();

      // Get expired tenants
      const expiredTenants = await this.tenantRepository
        .createQueryBuilder('tenant')
        .where('tenant.status IN (:...statuses)', {
          statuses: ['expired', 'suspended'],
        })
        .andWhere('tenant.updatedAt < :cutoffDate', {
          cutoffDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        })
        .getCount();

      // Check if backup directory exists and count files
      let backupFileCount = 0;
      try {
        const backupDir = path.join(process.cwd(), 'backups');

        if (fs.existsSync(backupDir)) {
          const files = fs.readdirSync(backupDir);
          const cutoffDateBackup = new Date();
          cutoffDateBackup.setDate(cutoffDateBackup.getDate() - 30); // 30 days

          backupFileCount = files.filter((file) => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            return stats.mtime < cutoffDateBackup;
          }).length;
        }
      } catch {
        // Ignore errors
      }

      return {
        success: true,
        statistics: {
          eligibleAuditLogs,
          expiredTenants,
          expiredBackupFiles: backupFileCount,
          totalEligibleRecords:
            eligibleAuditLogs + expiredTenants + backupFileCount,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: 'Failed to get retention status: ' + reason,
      };
    }
  }

  async getRetentionHistory(limit = 50, offset = 0) {
    try {
      // Get retention-related audit logs
      const history = await this.auditLogRepository
        .createQueryBuilder('audit')
        .where('audit.entity = :entity', { entity: 'data_retention' })
        .orderBy('audit.createdAt', 'DESC')
        .limit(limit)
        .offset(offset)
        .getMany();

      const totalCount = await this.auditLogRepository
        .createQueryBuilder('audit')
        .where('audit.entity = :entity', { entity: 'data_retention' })
        .getCount();

      return {
        success: true,
        history: history.map((log) => ({
          id: log.id,
          timestamp: log.createdAt,
          action: log.action,
          details: log.diff,
          ip: log.ip,
          userAgent: log.userAgent,
        })),
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: 'Failed to get retention history: ' + reason,
      };
    }
  }

  async executeRetentionDryRun() {
    return new Promise((resolve) => {
      const scriptPath = path.join(
        process.cwd(),
        'scripts',
        'data-retention.ts',
      );

      // Execute the retention script in dry-run mode
      const child = spawn(
        'npx',
        ['ts-node', '-r', 'tsconfig-paths/register', scriptPath],
        {
          cwd: process.cwd(),
          stdio: 'pipe',
        },
      );

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (chunk: Buffer | string) => {
        output += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      });

      child.stderr?.on('data', (chunk: Buffer | string) => {
        errorOutput +=
          typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output,
            message: 'Dry-run completed successfully',
            timestamp: new Date().toISOString(),
          });
        } else {
          resolve({
            success: false,
            error: errorOutput || 'Dry-run failed',
            output,
            exitCode: code,
          });
        }
      });

      child.on('error', (error) => {
        const reason = error instanceof Error ? error.message : String(error);
        resolve({
          success: false,
          error: 'Failed to execute retention script: ' + reason,
        });
      });
    });
  }

  async executeRetention() {
    return new Promise((resolve) => {
      const scriptPath = path.join(
        process.cwd(),
        'scripts',
        'data-retention.ts',
      );

      // Execute the retention script in live mode
      const child = spawn(
        'npx',
        [
          'ts-node',
          '-r',
          'tsconfig-paths/register',
          scriptPath,
          '--execute',
          '--force',
        ],
        {
          cwd: process.cwd(),
          stdio: 'pipe',
        },
      );

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (chunk: Buffer | string) => {
        output += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      });

      child.stderr?.on('data', (chunk: Buffer | string) => {
        errorOutput +=
          typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output,
            message: 'Live purge completed successfully',
            timestamp: new Date().toISOString(),
          });
        } else {
          resolve({
            success: false,
            error: errorOutput || 'Live purge failed',
            output,
            exitCode: code,
          });
        }
      });

      child.on('error', (error) => {
        const reason = error instanceof Error ? error.message : String(error);
        resolve({
          success: false,
          error: 'Failed to execute retention script: ' + reason,
        });
      });
    });
  }

  // === Tenant bazlı plan limitleri: oku/güncelle ===
  async getTenantLimits(tenantId: string) {
    let tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    // UI yanlışlıkla slug gönderebilir; slug ile de dene
    if (!tenant) {
      tenant = await this.tenantRepository.findOne({
        where: { slug: tenantId },
      });
    }
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Usage stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [
      usersCount,
      customersCount,
      suppliersCount,
      bankAccountsCount,
      invoicesThisMonth,
      expensesThisMonth,
    ] = await Promise.all([
      // Yalnız aktif kullanıcıları say: UI tarafıyla tutarlılık
      this.userRepository.count({ where: { tenantId, isActive: true } }),
      this.customerRepository.count({ where: { tenantId } }),
      this.supplierRepository.count({ where: { tenantId } }),
      // bank accounts table/entity name is bank_accounts
      this.dataSource
        .query(
          'SELECT COUNT(*)::int AS count FROM "bank_accounts" WHERE "tenantId" = $1',
          [tenantId],
        )
        .then((rows) => parseCountFromRows(rows))
        .catch(() => 0),
      this.invoiceRepository
        .count({
          where: {
            tenantId,
            isVoided: false,
            createdAt: Between(startOfMonth, now),
          },
        })
        .catch(() => 0),
      this.expenseRepository
        .count({
          where: {
            tenantId,
            isVoided: false,
            createdAt: Between(startOfMonth, now),
          },
        })
        .catch(() => 0),
    ]);

    // Limits - BEFORE effective overrides with tenant.maxUsers (sync tanılama için)
    const defaultLimitsBefore = TenantPlanLimitService.getLimits(
      tenant.subscriptionPlan,
    );
    const overrides = extractPlanOverrides(tenant.settings) ?? null;
    const effectiveBefore = TenantPlanLimitService.mergeWithOverrides(
      defaultLimitsBefore,
      overrides,
    );

    // Otomatik senkron koşulları (ADMIN_SYNC planı)
    const stripeCustomerExists = !!tenant.stripeCustomerId;
    const tenantHasSub = !!tenant.stripeSubscriptionId;
    const tenantMaxVal = Math.max(0, Number(tenant.maxUsers ?? 0));
    const effBeforeMax = Math.max(0, Number(effectiveBefore.maxUsers ?? 0));
    let needSync =
      stripeCustomerExists &&
      (!tenantHasSub ||
        usersCount > tenantMaxVal ||
        effBeforeMax < tenantMaxVal);

    // Ek kural: Webhook kaçırıldıysa Stripe üzerinde koltuk sayısı/plan değişmiş olabilir.
    // Çok sık çağrılmaması için 60sn'de bir Stripe abonelik özetini kontrol edelim.
    if (!needSync && stripeCustomerExists) {
      const nowMs = Date.now();
      const lastCheck = this.lastAdminStripeCheck.get(tenant.id) || 0;
      const withinCheckThrottle = nowMs - lastCheck < 60_000; // 60s
      if (!withinCheckThrottle) {
        this.lastAdminStripeCheck.set(tenant.id, nowMs);
        try {
          const raw = await this.billingService.getSubscriptionRaw(tenant.id);
          if (raw && raw.subscriptionId) {
            const remoteSeats = Math.max(0, Number(raw.computedSeats ?? 0));
            const localBase = Math.max(
              0,
              Number(tenant.maxUsers ?? effectiveBefore.maxUsers ?? 0),
            );
            const planMismatch =
              !!raw.plan && raw.plan !== tenant.subscriptionPlan;
            const seatMismatch = remoteSeats > 0 && remoteSeats !== localBase;
            if (planMismatch || seatMismatch) {
              const mismatchLog = {
                tag: 'ADMIN_SYNC',
                tenantId,
                reason: planMismatch ? 'plan-mismatch' : 'seats-mismatch',
                observed: {
                  remoteSeats,
                  localBase,
                  remotePlan: raw.plan,
                  localPlan: tenant.subscriptionPlan,
                },
              };
              this.logger.verbose(JSON.stringify(mismatchLog));
              needSync = true;
            }
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.debug(
            `stripe raw check failed tenant=${tenant.id} ${reason}`,
          );
        }
      }
    }

    if (needSync) {
      const nowMs = Date.now();
      const last = this.lastAdminSyncTrigger.get(tenant.id) || 0;
      const withinThrottle = nowMs - last < 15_000; // 15s throttle
      if (!withinThrottle) {
        // Structured log: trigger
        const triggerLog = {
          tag: 'ADMIN_SYNC',
          tenantId,
          reason: !tenantHasSub
            ? 'missing-sub'
            : usersCount > tenantMaxVal
              ? 'mismatch-usage'
              : 'mismatch-effective-or-remote',
          before: {
            maxUsers: tenant.maxUsers ?? null,
            usageUsers: usersCount,
            effectiveMax: effBeforeMax,
            stripeCustomerId: tenant.stripeCustomerId,
            stripeSubscriptionId: tenant.stripeSubscriptionId,
          },
        };
        this.logger.verbose(JSON.stringify(triggerLog));
        this.lastAdminSyncTrigger.set(tenant.id, nowMs);
        try {
          await this.billingService.syncFromStripe(tenant.id);
          tenant = await this.tenantRepository.findOne({
            where: { id: tenantId },
          });
          const successLog = {
            tag: 'ADMIN_SYNC',
            tenantId,
            status: 'success',
            after: {
              maxUsers: tenant?.maxUsers ?? null,
              stripeSubscriptionId: tenant?.stripeSubscriptionId ?? null,
            },
          };
          this.logger.verbose(JSON.stringify(successLog));
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          const errorLog = {
            tag: 'ADMIN_SYNC',
            tenantId,
            status: 'error',
            message: reason,
          };
          this.logger.warn(JSON.stringify(errorLog));
        }
      }
    }

    // Limits - AFTER: tenant.maxUsers ile efektif değeri belirle (UI için)
    if (!tenant) throw new NotFoundException('Tenant not found');
    const defaultLimits = TenantPlanLimitService.getLimits(
      tenant.subscriptionPlan,
    );
    const effective = TenantPlanLimitService.mergeWithOverrides(
      defaultLimits,
      overrides,
    );
    // Seat bazlı maxUsers gerçek değerini yansıt (Stripe addon + base dahil)
    // Kural:
    // - Eğer tenant Stripe aboneliğine sahipse, efektif limit Stripe koltuk sayısıdır (tenant.maxUsers)
    //   Böylece global plan varsayılan/override'ları (örn. PRO=10) Stripe'ın daha düşük koltuklarına baskın çıkmaz.
    // - Stripe yoksa önceki mantık geçerli kalır (plan varsayılanları ve olası tenant.maxUsers birlikte değerlendirilir).
    const tenantMax =
      typeof tenant.maxUsers === 'number' && Number.isFinite(tenant.maxUsers)
        ? tenant.maxUsers
        : undefined;
    const effMax = effective.maxUsers;
    if (tenant.stripeSubscriptionId && typeof tenantMax === 'number') {
      effective.maxUsers = tenantMax;
    } else if (tenantMax !== undefined) {
      effective.maxUsers = Math.max(effMax ?? 0, tenantMax);
    }

    // Plan düşürme alanlarını güncelle/temizle: kullanım limit altına indiyse cleanup
    try {
      const effMaxUsers = effective.maxUsers;
      if (
        typeof tenant.requiredUserReduction === 'number' &&
        typeof effMaxUsers === 'number'
      ) {
        const remaining = Math.max(0, usersCount - effMaxUsers);
        if (remaining <= 0) {
          tenant.requiredUserReduction = null;
          tenant.downgradePendingUntil = null;
          await this.tenantRepository.save(tenant);
        } else if (tenant.requiredUserReduction !== remaining) {
          tenant.requiredUserReduction = remaining;
          await this.tenantRepository.save(tenant);
        }
      }
    } catch (error) {
      this.logger.warn(
        `AdminService cleanup requiredUserReduction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        companyName: tenant.companyName,
        subscriptionPlan: tenant.subscriptionPlan,
        status: tenant.status,
        maxUsers: tenant.maxUsers,
        stripeCustomerId: tenant.stripeCustomerId,
        stripeSubscriptionId: tenant.stripeSubscriptionId,
        downgradePendingUntil: tenant.downgradePendingUntil ?? null,
        requiredUserReduction: tenant.requiredUserReduction ?? null,
      },
      limits: {
        default: defaultLimits,
        overrides: overrides,
        effective,
      },
      usage: {
        users: usersCount,
        customers: customersCount,
        suppliers: suppliersCount,
        bankAccounts: bankAccountsCount,
        monthly: {
          invoices: invoicesThisMonth,
          expenses: expensesThisMonth,
        },
      },
    };
  }

  /**
   * Plan düşürme son tarihi geçmişse fazla aktif kullanıcıları (tenant_admin ve super_admin hariç)
   * rastgele seçip pasifleştirir. Sayı, limit aşımına göre belirlenir.
   */
  async enforceTenantDowngrade(tenantId: string) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const deadline = tenant.downgradePendingUntil;
    const required = Number(tenant.requiredUserReduction ?? 0);
    if (!deadline || required <= 0) {
      return { success: true, enforced: 0, message: 'No enforcement needed' };
    }
    const now = new Date();
    if (deadline > now) {
      const remainsMs = deadline.getTime() - now.getTime();
      return {
        success: true,
        enforced: 0,
        message: `Deadline not reached (${Math.ceil(remainsMs / 1000)}s remaining)`,
      };
    }

    // Mevcut aktif kullanıcılar ve efektif limit
    const activeUsers = await this.userRepository.find({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        role: true,
      },
      order: { createdAt: 'DESC' as const },
    });
    const base = await this.getTenantLimits(tenantId);
    const effMax = Math.max(0, Number(base?.limits?.effective?.maxUsers ?? 0));
    const over = Math.max(0, (base?.usage?.users ?? 0) - effMax);
    if (over <= 0) {
      // Temizle
      tenant.requiredUserReduction = null;
      tenant.downgradePendingUntil = null;
      await this.tenantRepository.save(tenant);
      return { success: true, enforced: 0, message: 'Already within limits' };
    }

    // Hariç tutulacak roller
    const excluded = new Set<UserRole>([
      UserRole.TENANT_ADMIN,
      UserRole.SUPER_ADMIN,
    ]);
    const candidates = activeUsers.filter((user) => !excluded.has(user.role));
    if (candidates.length === 0) {
      return {
        success: false,
        enforced: 0,
        message: 'No eligible users to deactivate',
      };
    }
    // Rastgele seçim
    const need = Math.min(over, candidates.length);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const toDeactivate = candidates.slice(0, need);
    const ids = toDeactivate.map((u) => u.id);
    await this.userRepository
      .createQueryBuilder()
      .update('users')
      .set({ isActive: false })
      .where('id IN (:...ids)', { ids })
      .execute();

    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          tenantId,
          entity: 'plan_downgrade',
          entityId: tenantId,
          action: AuditAction.UPDATE,
          diff: { autoDeactivated: ids, count: ids.length },
        }),
      );
    } catch (error) {
      this.logger.warn(
        `AdminService enforceTenantDowngrade audit log failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // Kalan fazlalığa göre alanları güncelle/temizle
    const newBase = await this.getTenantLimits(tenantId);
    const newOver = Math.max(
      0,
      (newBase?.usage?.users ?? 0) -
        Math.max(0, Number(newBase?.limits?.effective?.maxUsers ?? 0)),
    );
    tenant.requiredUserReduction = newOver > 0 ? newOver : null;
    tenant.downgradePendingUntil = newOver > 0 ? deadline : null;
    await this.tenantRepository.save(tenant);

    return { success: true, enforced: ids.length };
  }

  async updateTenantLimits(
    tenantId: string,
    patch: {
      maxUsers?: number;
      maxCustomers?: number;
      maxSuppliers?: number;
      maxBankAccounts?: number;
      monthly?: { maxInvoices?: number; maxExpenses?: number };
      __clearAll?: boolean;
      __clear?: string[]; // dotted paths supported, e.g., 'monthly.maxInvoices'
    },
  ) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const settings: Record<string, unknown> = isRecord(tenant.settings)
      ? { ...tenant.settings }
      : {};
    const currentOverrides = (settings.planOverrides ||
      {}) as TenantPlanOverrides;
    let nextOverrides: TenantPlanOverrides = { ...currentOverrides };
    if (currentOverrides.monthly) {
      nextOverrides.monthly = { ...currentOverrides.monthly };
    }

    // helper
    const deleteByPath = (obj: TenantPlanOverrides, dotted: string) => {
      if (!obj || !dotted) return;
      const parts = dotted.split('.');
      if (parts.length === 1) {
        delete obj[parts[0] as keyof TenantPlanOverrides];
        return;
      }
      const last = parts.pop()!;
      let ref: unknown = obj;
      for (const p of parts) {
        if (!isRecord(ref) || !isRecord(ref[p])) {
          return;
        }
        ref = ref[p];
      }
      if (isRecord(ref)) {
        delete ref[last];
      }
    };

    // clear all
    if (patch.__clearAll) {
      nextOverrides = {};
    }

    // clear specific
    const clearList = patch.__clear;
    if (Array.isArray(clearList)) {
      for (const key of clearList) deleteByPath(nextOverrides, key);
      if (
        nextOverrides.monthly &&
        Object.keys(nextOverrides.monthly).length === 0
      ) {
        delete nextOverrides.monthly;
      }
    }

    // apply values; null means clear
    type NumericOverrideKey =
      | 'maxUsers'
      | 'maxCustomers'
      | 'maxSuppliers'
      | 'maxBankAccounts';
    const applyNumber = (
      key: NumericOverrideKey,
      value: number | null | undefined,
    ) => {
      if (value === undefined) return;
      if (value === null) {
        delete nextOverrides[key];
        return;
      }
      nextOverrides[key] = value;
    };
    applyNumber('maxUsers', patch.maxUsers);
    applyNumber('maxCustomers', patch.maxCustomers);
    applyNumber('maxSuppliers', patch.maxSuppliers);
    applyNumber('maxBankAccounts', patch.maxBankAccounts);

    if (patch.monthly !== undefined) {
      if (patch.monthly === null) {
        delete nextOverrides.monthly;
      } else {
        nextOverrides.monthly = { ...(nextOverrides.monthly || {}) };
        const m = patch.monthly;
        if (m?.maxInvoices === null) {
          if (nextOverrides.monthly) delete nextOverrides.monthly.maxInvoices;
        } else if (m?.maxInvoices !== undefined) {
          nextOverrides.monthly.maxInvoices = m.maxInvoices;
        }
        if (m?.maxExpenses === null) {
          if (nextOverrides.monthly) delete nextOverrides.monthly.maxExpenses;
        } else if (m?.maxExpenses !== undefined) {
          nextOverrides.monthly.maxExpenses = m.maxExpenses;
        }
        if (
          nextOverrides.monthly &&
          Object.keys(nextOverrides.monthly).length === 0
        ) {
          delete nextOverrides.monthly;
        }
      }
    }
    settings.planOverrides = nextOverrides;
    tenant.settings = settings;
    await this.tenantRepository.save(tenant);

    return this.getTenantLimits(tenantId);
  }

  /**
   * Tenant silme (hesap silme) işlemi.
   * Opsiyonel olarak önce yedek alır, sonra tüm ilişkili verileri siler.
   * hard=true ise geri dönüşü olmayan fiziksel silme yapılır.
   * Aksi halde tenant kaydı status=SUSPENDED + isPendingDeletion işareti ile soft silinir.
   */
  async deleteTenant(
    tenantId: string,
    opts: { hard?: boolean; backupBefore?: boolean } = {},
  ) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // İsteğe bağlı: önce hızlı bir JSON backup (temel veri - minimal)
    let backupSummary: TenantBackupSummary | null = null;
    if (opts.backupBefore) {
      try {
        const users = await this.userRepository.find({
          where: { tenantId },
          select: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'],
        });
        const customers = await this.customerRepository.find({
          where: { tenantId },
          select: ['id', 'name', 'email'],
        });
        const suppliers = await this.supplierRepository.find({
          where: { tenantId },
          select: ['id', 'name', 'email'],
        });
        const products = await this.productRepository.find({
          where: { tenantId },
          select: ['id', 'name', 'price', 'stock'],
        });
        const invoices = await this.invoiceRepository.find({
          where: { tenantId },
          select: ['id', 'invoiceNumber', 'total', 'createdAt'],
        });
        const expenses = await this.expenseRepository.find({
          where: { tenantId },
          select: ['id', 'expenseNumber', 'amount', 'createdAt'],
        });
        backupSummary = {
          timestamp: new Date().toISOString(),
          tenant: {
            id: tenant.id,
            name: tenant.name,
            plan: tenant.subscriptionPlan,
          },
          counts: {
            users: users.length,
            customers: customers.length,
            suppliers: suppliers.length,
            products: products.length,
            invoices: invoices.length,
            expenses: expenses.length,
          },
        };
      } catch (error) {
        // Backup başarısız olsa da silme devam edebilir; sadece logla
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error('Pre-delete backup failed:', reason);
      }
    }

    if (opts.hard) {
      // Fiziksel silme: Bazı tablolar onDelete CASCADE değil (invoices/expenses gibi).
      // Güvenli sıra ile bağlı verileri temizleyip tenant'ı kaldır.
      // Ön kontrol: opsiyonel tablolar mevcut mu?
      const hasTable = async (table: string): Promise<boolean> => {
        const rows: unknown = await this.dataSource.query(
          "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists",
          [table],
        );
        return parseExistsFlag(rows);
      };
      const [hasQuotesTable, hasAuditLogsTable] = await Promise.all([
        hasTable('quotes'),
        hasTable('audit_logs'),
      ]);

      await this.dataSource.transaction(async (manager) => {
        // Satışlar -> Faturalar -> Giderler -> Banka Hesapları -> Ürünler -> Kategoriler -> Müşteriler -> Tedarikçiler -> Kullanıcılar -> Audit loglar -> Tenant
        await manager
          .createQueryBuilder()
          .delete()
          .from('sales')
          .where('"tenantId" = :tenantId', { tenantId })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from('invoices')
          .where('"tenantId" = :tenantId', { tenantId })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from('expenses')
          .where('"tenantId" = :tenantId', { tenantId })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from('bank_accounts')
          .where('"tenantId" = :tenantId', { tenantId })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from('products')
          .where('"tenantId" = :tenantId', { tenantId })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from('product_categories')
          .where('"tenantId" = :tenantId', { tenantId })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from('customers')
          .where('"tenantId" = :tenantId', { tenantId })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from('suppliers')
          .where('"tenantId" = :tenantId', { tenantId })
          .execute();

        // Quotes ve audit_logs olası bağımlılıklar (tablo varsa sil)
        if (hasQuotesTable) {
          await manager
            .createQueryBuilder()
            .delete()
            .from('quotes')
            .where('"tenantId" = :tenantId', { tenantId })
            .execute();
        }

        if (hasAuditLogsTable) {
          await manager
            .createQueryBuilder()
            .delete()
            .from('audit_logs')
            .where('"tenantId" = :tenantId', { tenantId })
            .execute();
        }

        // Kullanıcılar (bazı ortamlarda CASCADE olabilir, yine de güvenli temizle)
        await manager
          .createQueryBuilder()
          .delete()
          .from('users')
          .where('"tenantId" = :tenantId', { tenantId })
          .execute();

        // Son olarak tenant kaydını kaldır
        await manager
          .createQueryBuilder()
          .delete()
          .from('tenants')
          .where('id = :tenantId', { tenantId })
          .execute();
      });
      // Hard delete sonrası audit_log tablosu tenant FK'sine bağlı olduğundan
      // kayıt eklemiyoruz (FK hatası oluşur veya hemen silinir). Sistem logu yeterli.
      return { success: true, hard: true, backup: backupSummary };
    }

    // Soft delete mantığı: status=SUSPENDED ve settings.flag
    tenant.status = TenantStatus.SUSPENDED;
    tenant.settings = {
      ...(tenant.settings || {}),
      deletionRequestedAt: new Date().toISOString(),
      isPendingDeletion: true,
    };
    await this.tenantRepository.save(tenant);
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        tenantId,
        entity: 'tenant',
        entityId: tenantId,
        action: AuditAction.UPDATE,
        diff: { softDelete: true },
      }),
    );
    return { success: true, hard: false, backup: backupSummary };
  }

  /**
   * Kullanıcı silme. hard=true ise fiziksel silme; aksi halde isActive=false ile soft.
   */
  async deleteUser(userId: string, opts: { hard?: boolean } = {}) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (opts.hard) {
      await this.userRepository.remove(user);
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          tenantId: user.tenantId,
          entity: 'user',
          entityId: userId,
          action: AuditAction.DELETE,
          diff: { hard: true },
        }),
      );
      return { success: true, hard: true };
    }

    user.isActive = false;
    await this.userRepository.save(user);
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        tenantId: user.tenantId,
        entity: 'user',
        entityId: userId,
        action: AuditAction.UPDATE,
        diff: { softDelete: true },
      }),
    );
    return { success: true, hard: false };
  }

  /**
   * Tüm aktif JWT oturumlarını geçersiz kılmak için kullanıcının tokenVersion değerini artırır.
   * Mevcut token'lar (payload içindeki eski tokenVersion) artık doğrulamadan geçmez.
   */
  async revokeAllUserSessions(userId: string) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      const next = (user.tokenVersion ?? 0) + 1;
      await this.userRepository.update(userId, { tokenVersion: next });
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          tenantId: user.tenantId,
          entity: 'user',
          entityId: userId,
          action: AuditAction.UPDATE,
          diff: { revokeSessions: true, newTokenVersion: next },
        }),
      );
      return { success: true, newTokenVersion: next };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `revokeAllUserSessions failed userId=${userId} msg=${reason}`,
      );
      return { success: false, error: reason };
    }
  }

  /**
   * DEV AMAÇLI: Bir tenant içindeki demo/veri temizliği.
   * Production ortamında çalışması engellenir.
   * Sıra: satışlar -> faturalar -> giderler -> bank hesapları -> ürünler -> kategoriler -> müşteriler -> tedarikçiler
   * (cascading ilişkiler göz önüne alınarak daha bağımlı olanlar önce silinir)
   */
  async purgeTenantDemo(tenantId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Purge is disabled in production');
    }
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const summary: Record<string, number> = {
      sales: 0,
      invoices: 0,
      expenses: 0,
      bankAccounts: 0,
      products: 0,
      productCategories: 0,
      customers: 0,
      suppliers: 0,
    };

    await this.dataSource.transaction(async (manager) => {
      const sales = await manager.find(Sale, { where: { tenantId } });
      if (sales.length) {
        summary.sales = sales.length;
        await manager.remove(Sale, sales);
      }
      const invoices = await manager.find(Invoice, { where: { tenantId } });
      if (invoices.length) {
        summary.invoices = invoices.length;
        await manager.remove(Invoice, invoices);
      }
      const expenses = await manager.find(Expense, { where: { tenantId } });
      if (expenses.length) {
        summary.expenses = expenses.length;
        await manager.remove(Expense, expenses);
      }
      const bankAccounts = await manager.find(BankAccount, {
        where: { tenantId },
      });
      if (bankAccounts.length) {
        summary.bankAccounts = bankAccounts.length;
        await manager.remove(BankAccount, bankAccounts);
      }
      const products = await manager.find(Product, { where: { tenantId } });
      if (products.length) {
        summary.products = products.length;
        await manager.remove(Product, products);
      }
      const productCategories = await manager.find(ProductCategory, {
        where: { tenantId },
      });
      if (productCategories.length) {
        summary.productCategories = productCategories.length;
        await manager.remove(ProductCategory, productCategories);
      }
      const customers = await manager.find(Customer, { where: { tenantId } });
      if (customers.length) {
        summary.customers = customers.length;
        await manager.remove(Customer, customers);
      }
      const suppliers = await manager.find(Supplier, { where: { tenantId } });
      if (suppliers.length) {
        summary.suppliers = suppliers.length;
        await manager.remove(Supplier, suppliers);
      }
    });

    // Audit log kaydı (hafif)
    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          tenantId,
          entity: 'tenant_demo_purge',
          entityId: tenantId,
          action: AuditAction.DELETE,
          diff: summary,
        }),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn('Purge audit log failed: ' + reason);
    }

    return { success: true, summary };
  }
}

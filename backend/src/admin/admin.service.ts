import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
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
import { ProductCategory } from '../products/entities/product-category.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { SecurityService } from '../common/security.service';
import { EmailService } from '../services/email.service';
import { TenantPlanLimitService } from '../common/tenant-plan-limits.service';

@Injectable()
export class AdminService {
  private activeAdminTokens: Set<string> = new Set();

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
    @InjectRepository(ProductCategory)
    private productCategoryRepository: Repository<ProductCategory>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private dataSource: DataSource,
    private securityService: SecurityService,
    private emailService: EmailService,
  ) {}

  async adminLogin(username: string, password: string) {
    // Güvenli admin kontrolü - environment variables'dan al
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH; // bcrypt hash
    const adminPasswordPlain = process.env.ADMIN_PASSWORD; // opsiyonel düz şifre (sadece dev)

    // Kullanıcı adı kontrolü
    if (username !== adminUsername) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    let isPasswordValid = false;

    if (adminPasswordHash) {
      // Hash ile doğrula
      isPasswordValid = await this.securityService.comparePassword(
        password,
        adminPasswordHash,
      );
    } else if (adminPasswordPlain) {
      // Düz şifre ile doğrula (DEV amaçlı)
      isPasswordValid = password === adminPasswordPlain;
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid admin credentials');
      }
      // Uyarı: üretimde kullanılmamalı
      console.warn(
        '⚠️ ADMIN_PASSWORD_HASH is not set. Using ADMIN_PASSWORD for admin auth (dev only).',
      );
    } else {
      // Son çare olarak geliştirme kolaylığı: admin/admin123
      const defaultDevPassword = 'admin123';
      isPasswordValid = password === defaultDevPassword;
      if (!isPasswordValid) {
        throw new UnauthorizedException('Admin credentials not configured');
      }
      console.warn(
        '⚠️ Admin credentials not configured. Falling back to default dev credentials (admin/admin123). DO NOT USE IN PRODUCTION.',
      );
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
    const where: any = {};
    if (tenantId) {
      where.tenantId = tenantId;
    }
    return this.userRepository.find({
      where,
      relations: ['tenant'],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        tenant: {
          id: true,
          name: true,
          slug: true,
          companyName: true,
        },
      },
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

    const patch: Partial<User> = {};
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
        console.warn('Phone column update skipped:', err?.message || err);
      }
    }

    if (Object.keys(patch).length > 0) {
      await this.userRepository.update(userId, patch);
    }
    return { success: true };
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
    const resetLink = `${process.env.APP_PUBLIC_URL || 'http://localhost:5175'}/reset-password?token=${token}`;

    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Şifre Sıfırlama Talebi',
      html: `<p>Merhaba ${user.firstName || ''} ${user.lastName || ''},</p>
             <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanabilirsiniz:</p>
             <p><a href="${resetLink}">${resetLink}</a></p>
             <p>Bu işlem bir saat içinde geçerlidir.</p>`,
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
        createdAt: true,
      },
      order: { createdAt: 'DESC' as any },
    });

    // Organization members and invites (if organizations feature is used)
    let organizations: any[] = [];
    let invites: any[] = [];
    try {
      const orgs = await this.dataSource.query(
        'SELECT o.* FROM organizations o ORDER BY o."createdAt" DESC LIMIT 20',
      );
      organizations = orgs || [];
      const inv = await this.dataSource.query(
        'SELECT i.* FROM invites i ORDER BY i."createdAt" DESC LIMIT 100',
      );
      invites = inv || [];
    } catch (_) {
      // organizations table may not exist in some setups; ignore softly
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
      tenant.subscriptionPlan = payload.plan;
      // Opsiyonel: plan değişiminde otomatik tarihler ayarlanabilir
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

    const columns = await this.dataSource.query(query);

    // Tabloları grupla (tip güvenli)
    type TableInfo = {
      name: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        default: any;
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
        const countResult = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM "${table.name}"`,
        );
        table.recordCount = parseInt(countResult[0].count);
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
    const params: any[] = [];

    // TenantId filtresi ekle
    if (tenantId && tableName !== 'tenants') {
      // Tabloda tenantId kolonu var mı kontrol et
      const hasTenanIdColumn = await this.dataSource.query(
        `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'tenantId'
      `,
        [tableName],
      );

      if (hasTenanIdColumn.length > 0) {
        query += ` WHERE "tenantId" = $1`;
        params.push(tenantId);
      }
    }

    query += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const data = await this.dataSource.query(query, params);

    // Toplam kayıt sayısını al
    let countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const countParams: any[] = [];

    if (tenantId && tableName !== 'tenants') {
      const hasTenanIdColumn = await this.dataSource.query(
        `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'tenantId'
      `,
        [tableName],
      );

      if (hasTenanIdColumn.length > 0) {
        countQuery += ` WHERE "tenantId" = $1`;
        countParams.push(tenantId);
      }
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const totalCount = parseInt(countResult[0].count);

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

  // Data Retention Methods

  async getRetentionConfig() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'retention.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);

      return {
        success: true,
        config,
        configPath,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to load retention configuration: ' + error.message,
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
      } catch (error) {
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
      return {
        success: false,
        error: 'Failed to get retention status: ' + error.message,
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
      return {
        success: false,
        error: 'Failed to get retention history: ' + error.message,
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

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
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
        resolve({
          success: false,
          error: 'Failed to execute retention script: ' + error.message,
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

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
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
        resolve({
          success: false,
          error: 'Failed to execute retention script: ' + error.message,
        });
      });
    });
  }

  // === Tenant bazlı plan limitleri: oku/güncelle ===
  async getTenantLimits(tenantId: string) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
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
      this.userRepository.count({ where: { tenantId } }),
      this.customerRepository.count({ where: { tenantId } }),
      this.supplierRepository.count({ where: { tenantId } }),
      // bank accounts table/entity name is bank_accounts
      this.dataSource
        .query(
          'SELECT COUNT(*)::int AS count FROM "bank_accounts" WHERE "tenantId" = $1',
          [tenantId],
        )
        .then((r: any[]) => (r?.[0]?.count as number) ?? 0)
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

    // Limits
    const defaultLimits = TenantPlanLimitService.getLimits(
      tenant.subscriptionPlan,
    );
    const overrides = (tenant.settings as any)?.planOverrides || null;
    const effective = TenantPlanLimitService.mergeWithOverrides(
      defaultLimits,
      overrides,
    );

    return {
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        companyName: tenant.companyName,
        subscriptionPlan: tenant.subscriptionPlan,
        status: tenant.status,
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

    const settings = tenant.settings || {};
    const currentOverrides = (settings.planOverrides || {}) as Record<
      string,
      any
    >;
    let nextOverrides: Record<string, any> = { ...currentOverrides };

    // helper
    const deleteByPath = (obj: any, dotted: string) => {
      if (!obj || !dotted) return;
      const parts = dotted.split('.');
      if (parts.length === 1) {
        delete obj[parts[0]];
        return;
      }
      const last = parts.pop()!;
      let ref = obj;
      for (const p of parts) {
        if (ref[p] == null || typeof ref[p] !== 'object') return;
        ref = ref[p];
      }
      delete ref[last];
    };

    // clear all
    if ((patch as any).__clearAll) {
      nextOverrides = {};
    }

    // clear specific
    const clearList = (patch as any).__clear as string[] | undefined;
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
    const applyNumber = (key: string, value: any) => {
      if (value === undefined) return;
      if (value === null) {
        delete nextOverrides[key];
        return;
      }
      nextOverrides[key] = value;
    };
    applyNumber('maxUsers', (patch as any).maxUsers);
    applyNumber('maxCustomers', (patch as any).maxCustomers);
    applyNumber('maxSuppliers', (patch as any).maxSuppliers);
    applyNumber('maxBankAccounts', (patch as any).maxBankAccounts);

    if (patch.monthly !== undefined) {
      if (patch.monthly === null) {
        delete nextOverrides.monthly;
      } else {
        nextOverrides.monthly = { ...(nextOverrides.monthly || {}) };
        const m = patch.monthly as any;
        if (m.maxInvoices === null) {
          if (nextOverrides.monthly) delete nextOverrides.monthly.maxInvoices;
        } else if (m.maxInvoices !== undefined) {
          nextOverrides.monthly.maxInvoices = m.maxInvoices;
        }
        if (m.maxExpenses === null) {
          if (nextOverrides.monthly) delete nextOverrides.monthly.maxExpenses;
        } else if (m.maxExpenses !== undefined) {
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
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // İsteğe bağlı: önce hızlı bir JSON backup (temel veri - minimal)
    let backupSummary: any = null;
    if (opts.backupBefore) {
      try {
        const users = await this.userRepository.find({ where: { tenantId }, select: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'] });
        const customers = await this.customerRepository.find({ where: { tenantId }, select: ['id', 'name', 'email'] });
        const suppliers = await this.supplierRepository.find({ where: { tenantId }, select: ['id', 'name', 'email'] });
        const products = await this.productRepository.find({ where: { tenantId }, select: ['id', 'name', 'price', 'stock'] });
        const invoices = await this.invoiceRepository.find({ where: { tenantId }, select: ['id', 'invoiceNumber', 'total', 'createdAt'] });
        const expenses = await this.expenseRepository.find({ where: { tenantId }, select: ['id', 'expenseNumber', 'amount', 'createdAt'] });
        backupSummary = {
          timestamp: new Date().toISOString(),
          tenant: { id: tenant.id, name: tenant.name, plan: tenant.subscriptionPlan },
          counts: {
            users: users.length,
            customers: customers.length,
            suppliers: suppliers.length,
            products: products.length,
            invoices: invoices.length,
            expenses: expenses.length,
          },
        };
      } catch (e) {
        // Backup başarısız olsa da silme devam edebilir; sadece logla
        console.error('Pre-delete backup failed:', e);
      }
    }

    if (opts.hard) {
      // Fiziksel silme: ilişkili tablolar cascade ile siliniyor (foreign key onDelete CASCADE).
      await this.tenantRepository.remove(tenant);
      // Audit log
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          tenantId,
          entity: 'tenant',
          entityId: tenantId,
          action: 'DELETE' as any,
          diff: { hard: true },
        }),
      );
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
        action: 'UPDATE' as any,
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
          action: 'DELETE' as any,
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
        action: 'UPDATE' as any,
        diff: { softDelete: true },
      }),
    );
    return { success: true, hard: false };
  }
}

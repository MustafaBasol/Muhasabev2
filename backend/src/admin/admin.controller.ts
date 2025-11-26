import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
  Patch,
  Delete,
  Logger,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  SubscriptionPlan,
  TenantStatus,
} from '../tenants/entities/tenant.entity';
import { UserRole } from '../users/entities/user.entity';
import { PlanLimitsService } from './plan-limits.service';
import { BillingService } from '../billing/billing.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import type { AdminHeaderMap } from './utils/admin-token.util';
import { resolveAdminHeaders } from './utils/admin-token.util';
import type { TenantPlanLimits } from '../common/tenant-plan-limits.service';

type UsersServiceShim = {
  incrementTokenVersion?: (userId: string) => Promise<void>;
};

const isUsersServiceShim = (value: unknown): value is UsersServiceShim =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as UsersServiceShim).incrementTokenVersion === 'function';

type ExportableAdminUser = Awaited<
  ReturnType<AdminService['getAllUsers']>
>[number];

type CsvPrimitive = string | number | boolean | Date | null | undefined;

type TenantLimitsSummary = {
  tenant: Record<string, unknown>;
  limits?: {
    effective?: TenantPlanLimits | Record<string, unknown>;
    [key: string]: unknown;
  };
  usage?: {
    users?: number | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const serializeCsvValue = (value: CsvPrimitive): string => {
  if (value == null) {
    return '';
  }

  const serialized =
    value instanceof Date ? value.toISOString() : String(value);

  if (/[",\n]/.test(serialized)) {
    return '"' + serialized.replace(/"/g, '""') + '"';
  }
  return serialized;
};

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly planLimitsService: PlanLimitsService,
    private readonly billingService: BillingService,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  private readonly logger = new Logger('AdminController');

  private resolveAdminToken(headers?: AdminHeaderMap): string {
    const { adminToken } = resolveAdminHeaders(headers);
    if (!adminToken) {
      throw new UnauthorizedException('Admin token required');
    }
    return adminToken;
  }

  private checkAdminAuth(headers?: AdminHeaderMap) {
    const adminToken = this.resolveAdminToken(headers);

    // AdminService'den token doğrulama
    if (!this.adminService.isValidAdminToken(adminToken)) {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Admin logged in successfully' })
  async adminLogin(
    @Body() loginDto: { username: string; password: string; totp?: string },
  ) {
    return this.adminService.adminLogin(
      loginDto.username,
      loginDto.password,
      loginDto.totp,
    );
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users (optionally filtered by tenant)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async getAllUsers(
    @Headers() headers: AdminHeaderMap,
    @Query('tenantId') tenantId?: string,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getAllUsers(tenantId);
  }

  @Get('users/export-csv')
  @ApiOperation({
    summary: 'Export users as CSV (optionally filtered by tenant)',
  })
  @ApiResponse({ status: 200, description: 'CSV file stream' })
  async exportUsersCsv(
    @Headers() headers: AdminHeaderMap,
    @Res() res: Response,
    @Query('tenantId') tenantId?: string,
  ) {
    this.checkAdminAuth(headers);
    const users = await this.adminService.getAllUsers(tenantId);

    const headersRow = [
      'ID',
      'Ad',
      'Soyad',
      'Ad Soyad',
      'E-posta',
      'Rol',
      'Aktif mi',
      'Kayıt Tarihi',
      'Son Giriş',
      'Son Giriş TZ',
      'Son Giriş UTC Dakika',
      'Tenant ID',
      'Tenant Adı',
      'Tenant Şirket',
      'Tenant Slug',
    ];
    const rows = users.map((user: ExportableAdminUser) => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const createdAt = user.createdAt
        ? new Date(user.createdAt).toISOString()
        : '';
      const lastLoginAt = user.lastLoginAt
        ? new Date(user.lastLoginAt).toISOString()
        : '';
      const timeZone = user.lastLoginTimeZone || '';
      const utcOffset = user.lastLoginUtcOffsetMinutes ?? '';
      return [
        user.id,
        user.firstName || '',
        user.lastName || '',
        fullName,
        user.email || '',
        user.role || '',
        user.isActive ? 'true' : 'false',
        createdAt,
        lastLoginAt,
        timeZone,
        utcOffset,
        user.tenantId || user.tenant?.id || '',
        user.tenant?.name || '',
        user.tenant?.companyName || '',
        user.tenant?.slug || '',
      ]
        .map(serializeCsvValue)
        .join(',');
    });

    const csv = '\uFEFF' + [headersRow.join(','), ...rows].join('\n');
    const filename = tenantId ? `users_${tenantId}.csv` : 'users.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Get all tenants with optional filters' })
  @ApiResponse({ status: 200, description: 'List of tenants' })
  async getAllTenants(
    @Headers() headers: AdminHeaderMap,
    @Query('status') status?: TenantStatus,
    @Query('plan') plan?: SubscriptionPlan,
    @Query('startFrom') startFrom?: string,
    @Query('startTo') startTo?: string,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getAllTenants({
      status,
      plan,
      startFrom,
      startTo,
    });
  }

  @Patch('users/:userId/status')
  @ApiOperation({ summary: 'Update user active status' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() body: { isActive: boolean },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.updateUserStatus(userId, body.isActive);
  }

  @Post('users/:userId/verify')
  @ApiOperation({ summary: 'Mark user email as verified' })
  @ApiResponse({
    status: 200,
    description: 'User email verification status updated',
  })
  async markUserVerified(
    @Param('userId') userId: string,
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.markUserEmailVerified(userId);
  }

  @Patch('users/:userId')
  @ApiOperation({
    summary: 'Update user profile (firstName, lastName, email, phone)',
  })
  @ApiResponse({ status: 200, description: 'User updated' })
  async updateUser(
    @Param('userId') userId: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      role?: UserRole;
    },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.updateUser(userId, body);
  }

  @Post('users/:userId/password-reset')
  @ApiOperation({ summary: 'Send password reset email to user' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent (simulated)',
  })
  async sendPasswordReset(
    @Param('userId') userId: string,
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.sendPasswordReset(userId);
  }

  @Patch('users/:userId/tenant')
  @ApiOperation({ summary: 'Update user tenantId (admin only)' })
  @ApiResponse({ status: 200, description: 'User tenant updated' })
  async updateUserTenant(
    @Param('userId') userId: string,
    @Body() body: { tenantId: string },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    if (!body?.tenantId) {
      throw new UnauthorizedException('tenantId is required');
    }
    return this.adminService.updateUserTenant(userId, body.tenantId);
  }

  @Get('user/:userId/data')
  @ApiOperation({ summary: 'Get all data for a specific user' })
  @ApiResponse({ status: 200, description: 'User data' })
  async getUserData(
    @Param('userId') userId: string,
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getUserData(userId);
  }

  @Get('tenant/:tenantId/data')
  @ApiOperation({ summary: 'Get all data for a specific tenant' })
  @ApiResponse({ status: 200, description: 'Tenant data' })
  async getTenantData(
    @Param('tenantId') tenantId: string,
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getTenantData(tenantId);
  }

  @Patch('tenant/:tenantId/subscription')
  @ApiOperation({ summary: 'Update tenant subscription (plan/status/billing)' })
  @ApiResponse({ status: 200, description: 'Subscription updated' })
  async updateTenantSubscription(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      plan?: SubscriptionPlan;
      status?: TenantStatus;
      nextBillingAt?: string;
      cancel?: boolean;
    },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.updateTenantSubscription(tenantId, body);
  }

  @Get('tables')
  @ApiOperation({ summary: 'Get all table information' })
  @ApiResponse({ status: 200, description: 'Database table information' })
  async getAllTables(@Headers() headers: AdminHeaderMap) {
    this.checkAdminAuth(headers);
    return this.adminService.getAllTables();
  }

  @Get('table/:tableName')
  @ApiOperation({ summary: 'Get data from specific table' })
  @ApiResponse({ status: 200, description: 'Table data' })
  async getTableData(
    @Param('tableName') tableName: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Headers() headers?: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getTableData(tableName, tenantId, limit, offset);
  }

  @Get('retention/config')
  @ApiOperation({ summary: 'Get data retention configuration' })
  @ApiResponse({ status: 200, description: 'Retention configuration' })
  async getRetentionConfig(@Headers() headers: AdminHeaderMap) {
    this.checkAdminAuth(headers);
    return this.adminService.getRetentionConfig();
  }

  @Get('retention/status')
  @ApiOperation({ summary: 'Get retention job status and statistics' })
  @ApiResponse({ status: 200, description: 'Retention status and stats' })
  async getRetentionStatus(@Headers() headers: AdminHeaderMap) {
    this.checkAdminAuth(headers);
    return this.adminService.getRetentionStatus();
  }

  @Get('retention/history')
  @ApiOperation({ summary: 'Get retention job execution history' })
  @ApiResponse({ status: 200, description: 'Retention job history' })
  async getRetentionHistory(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Headers() headers?: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getRetentionHistory(limit, offset);
  }

  @Post('retention/dry-run')
  @ApiOperation({ summary: 'Execute retention job in dry-run mode' })
  @ApiResponse({ status: 200, description: 'Dry-run results' })
  async executeRetentionDryRun(@Headers() headers: AdminHeaderMap) {
    this.checkAdminAuth(headers);
    return this.adminService.executeRetentionDryRun();
  }

  @Post('retention/execute')
  @ApiOperation({ summary: 'Execute retention job (live purge)' })
  @ApiResponse({ status: 200, description: 'Live purge results' })
  async executeRetention(
    @Headers() headers: AdminHeaderMap,
    @Body() body: { confirm?: boolean },
  ) {
    this.checkAdminAuth(headers);
    if (!body.confirm) {
      throw new UnauthorizedException('Confirmation required for live purge');
    }
    return this.adminService.executeRetention();
  }

  // === Plan Limitleri Yönetimi ===
  @Get('plan-limits')
  @ApiOperation({ summary: 'Mevcut plan limitlerini getir (runtime)' })
  @ApiResponse({ status: 200, description: 'Plan limits' })
  async getPlanLimits(@Headers() headers: AdminHeaderMap) {
    this.checkAdminAuth(headers);
    const current = this.planLimitsService.getCurrentLimits();
    return { success: true, limits: current };
  }

  @Patch('plan-limits/:plan')
  @ApiOperation({ summary: 'Belirli bir plan için limitleri güncelle' })
  @ApiResponse({ status: 200, description: 'Updated plan limits' })
  async updatePlanLimits(
    @Param('plan') planParam: string,
    @Body()
    body: {
      maxUsers?: number;
      maxCustomers?: number;
      maxSuppliers?: number;
      maxBankAccounts?: number;
      monthly?: { maxInvoices?: number; maxExpenses?: number };
    },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    const plan = (planParam || '').toLowerCase() as SubscriptionPlan;
    if (!Object.values(SubscriptionPlan).includes(plan)) {
      throw new UnauthorizedException('Invalid plan');
    }
    const updated = this.planLimitsService.updatePlanLimits(plan, body);
    return { success: true, plan, limits: updated };
  }

  // === Tenant Bazlı Limit Overrides ===
  @Get('tenant/:tenantId/limits')
  @ApiOperation({
    summary:
      'Belirli bir tenant için limitleri (default+override+effective) ve kullanım istatistiklerini getir',
  })
  @ApiResponse({ status: 200, description: 'Tenant limits and usage' })
  async getTenantLimits(
    @Param('tenantId') tenantId: string,
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getTenantLimits(tenantId);
  }

  @Patch('tenant/:tenantId/limits')
  @ApiOperation({
    summary: 'Belirli bir tenant için limit override değerlerini güncelle',
  })
  @ApiResponse({ status: 200, description: 'Updated tenant limits' })
  async updateTenantLimits(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      maxUsers?: number;
      maxCustomers?: number;
      maxSuppliers?: number;
      maxBankAccounts?: number;
      monthly?: { maxInvoices?: number; maxExpenses?: number };
      __clearAll?: boolean;
      __clear?: string[];
    },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.updateTenantLimits(tenantId, body);
  }

  // === Tenant Konsol (tek bakışta) ===
  @Get('tenant/:tenantId/overview')
  @ApiOperation({
    summary:
      'Tek ekranda tenant özeti: kullanıcılar, limitler, kullanım, organizasyonlar, davetler',
  })
  @ApiResponse({ status: 200, description: 'Tenant overview' })
  async getTenantOverview(
    @Param('tenantId') tenantId: string,
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getTenantOverview(tenantId);
  }

  // Opsiyonel: Stripe subscription ham bilgileri
  @Get('tenant/:tenantId/subscription-raw')
  @ApiOperation({
    summary: 'Get raw Stripe subscription items and computed seats',
  })
  @ApiResponse({ status: 200, description: 'Subscription raw details' })
  async getSubscriptionRaw(
    @Param('tenantId') tenantId: string,
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.billingService.getSubscriptionRaw(tenantId);
  }

  @Patch('tenant/:tenantId')
  @ApiOperation({ summary: 'Update tenant basic fields (name/companyName)' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  async updateTenantBasic(
    @Param('tenantId') tenantId: string,
    @Body() body: { name?: string; companyName?: string },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.updateTenantBasic(tenantId, body);
  }

  @Post('tenant/:tenantId/enforce-downgrade')
  @ApiOperation({
    summary:
      'Enforce plan downgrade by randomly deactivating excess users after deadline',
  })
  @ApiResponse({ status: 200, description: 'Enforcement result' })
  async enforceTenantDowngrade(
    @Param('tenantId') tenantId: string,
    @Body() body: { confirm?: boolean },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    if (!body?.confirm) {
      throw new UnauthorizedException('Confirmation required');
    }
    return this.adminService.enforceTenantDowngrade(tenantId);
  }

  // === Tenant faturaları (Stripe) ===
  @Get('tenant/:tenantId/invoices')
  @ApiOperation({ summary: 'List Stripe invoices for a tenant (admin)' })
  @ApiResponse({ status: 200, description: 'Tenant invoices' })
  async listTenantInvoices(
    @Param('tenantId') tenantId: string,
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      this.logger.warn(`invoices: tenant not found id=${tenantId}`);
      return { invoices: [] };
    }
    try {
      let res = await this.billingService.listInvoices(tenant.id);
      let source: 'admin' | 'admin-sync' | 'user-fallback' = 'admin';
      let count = res?.invoices?.length ?? 0;
      this.logger.debug(
        `invoices: tenant=${tenant.id} stripeCustomerId=${tenant.stripeCustomerId} count=${count}`,
      );
      // Reconciler: müşteri var ve fatura sayısı 0 ise Stripe ile senkron tetikle, sonra tekrar dene
      if (tenant.stripeCustomerId && count === 0) {
        this.logger.verbose(
          JSON.stringify({
            tag: 'ADMIN_SYNC',
            tenantId: tenant.id,
            reason: 'invoice-empty',
          }),
        );
        try {
          await this.billingService.syncFromStripe(tenant.id);
          res = await this.billingService.listInvoices(tenant.id);
          count = res?.invoices?.length ?? 0;
          source = 'admin-sync';
          this.logger.verbose(
            JSON.stringify({
              tag: 'ADMIN_SYNC',
              tenantId: tenant.id,
              status: 'success',
              invoiceCount: count,
            }),
          );
        } catch (e: unknown) {
          this.logger.warn(
            JSON.stringify({
              tag: 'ADMIN_SYNC',
              tenantId: tenant.id,
              status: 'error',
              message: e instanceof Error ? e.message : String(e),
            }),
          );
        }
      }
      return { ...res, source };
    } catch (e: unknown) {
      this.logger.error(
        `invoices: error tenant=${tenant.id} msg=${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return { invoices: [] };
    }
  }

  @Get('tenant/:tenantId/debug')
  @ApiOperation({ summary: 'Debug tenant billing + limits' })
  async debugTenant(
    @Param('tenantId') tenantId: string,
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return { found: false };
    // Use adminService for counts to avoid duplicating logic
    try {
      const base = (await this.adminService.getTenantLimits(
        tenantId,
      )) as TenantLimitsSummary;
      const inv = await this.billingService
        .listInvoices(tenant.id)
        .catch(() => ({ invoices: [] }));
      return {
        found: true,
        tenant: base.tenant,
        effectiveMaxUsers: base?.limits?.effective?.maxUsers ?? null,
        usageUsers: base?.usage?.users ?? null,
        stripeCustomerId:
          base.tenant.stripeCustomerId ?? tenant.stripeCustomerId,
        stripeSubscriptionId:
          base.tenant.stripeSubscriptionId ?? tenant.stripeSubscriptionId,
        invoiceCount: inv?.invoices?.length ?? 0,
        invoiceSample: (inv?.invoices || []).slice(0, 1),
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`debugTenant error id=${tenantId} ${message}`);
      return { found: true, error: message };
    }
  }

  // === Tenant Delete (Account Removal) ===
  @Patch('tenant/:tenantId/delete')
  @ApiOperation({ summary: 'Delete tenant account (soft or hard)' })
  @ApiResponse({ status: 200, description: 'Tenant deletion result' })
  async deleteTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: { confirm?: boolean; hard?: boolean; backupBefore?: boolean },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    if (!body?.confirm) {
      throw new UnauthorizedException('Confirmation required');
    }
    return this.adminService.deleteTenant(tenantId, {
      hard: !!body?.hard,
      backupBefore: !!body?.backupBefore,
    });
  }

  // === Add user to tenant (no email verification) ===
  @Post('tenant/:tenantId/users')
  @ApiOperation({
    summary: 'Create or attach a user to a tenant without email verification',
  })
  @ApiResponse({ status: 200, description: 'User created/attached' })
  async addUserToTenant(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      email: string;
      firstName?: string;
      lastName?: string;
      role?: string;
      password?: string;
      autoPassword?: boolean;
      activate?: boolean;
    },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    if (!body?.email) {
      throw new UnauthorizedException('email is required');
    }
    return this.adminService.addUserToTenant(tenantId, body);
  }

  // === Demo Purge (DEV only) ===
  @Delete('tenant/:tenantId/purge-demo')
  @ApiOperation({ summary: 'Purge ALL demo data for a tenant (dev only)' })
  @ApiResponse({ status: 200, description: 'Purge result summary' })
  async purgeTenantDemo(
    @Param('tenantId') tenantId: string,
    @Body() body: { confirm?: boolean },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    if (!body?.confirm) {
      throw new UnauthorizedException('Confirmation required');
    }
    return this.adminService.purgeTenantDemo(tenantId);
  }

  // === User Delete ===
  @Delete('users/:userId')
  @ApiOperation({ summary: 'Delete user (soft or hard)' })
  @ApiResponse({ status: 200, description: 'User deletion result' })
  async deleteUser(
    @Param('userId') userId: string,
    @Body() body: { confirm?: boolean; hard?: boolean },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    if (!body.confirm) {
      throw new UnauthorizedException('Confirmation required');
    }
    return this.adminService.deleteUser(userId, { hard: body?.hard });
  }

  // === Revoke All Active JWT Sessions for User ===
  @Post('users/:userId/revoke-sessions')
  @ApiOperation({ summary: 'Invalidate all active JWT tokens for a user' })
  @ApiResponse({ status: 200, description: 'All sessions revoked' })
  async revokeUserSessions(
    @Param('userId') userId: string,
    @Body() body: { confirm?: boolean },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    if (!body?.confirm) {
      throw new UnauthorizedException('Confirmation required');
    }
    // Increment tokenVersion via adminService -> usersService fallback
    const updated = await this.adminService.revokeAllUserSessions(userId);
    if (!updated?.success) {
      try {
        const usersService = (this.adminService as { usersService?: unknown })
          .usersService;
        if (isUsersServiceShim(usersService)) {
          await usersService.incrementTokenVersion?.(userId);
        }
      } catch (error: unknown) {
        this.logger.warn(
          `AdminController revokeUserSessions fallback failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return { success: true };
  }
}

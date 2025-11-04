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
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  SubscriptionPlan,
  TenantStatus,
} from '../tenants/entities/tenant.entity';
import { UserRole } from '../users/entities/user.entity';
import { PlanLimitsService } from './plan-limits.service';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly planLimitsService: PlanLimitsService,
  ) {}

  private checkAdminAuth(headers: any) {
    const adminToken = headers['admin-token'];
    if (!adminToken) {
      throw new UnauthorizedException('Admin token required');
    }

    // AdminService'den token doğrulama
    if (!this.adminService.isValidAdminToken(adminToken)) {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Admin logged in successfully' })
  async adminLogin(@Body() loginDto: { username: string; password: string }) {
    return this.adminService.adminLogin(loginDto.username, loginDto.password);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users (optionally filtered by tenant)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async getAllUsers(
    @Headers() headers: any,
    @Query('tenantId') tenantId?: string,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getAllUsers(tenantId);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Get all tenants with optional filters' })
  @ApiResponse({ status: 200, description: 'List of tenants' })
  async getAllTenants(
    @Headers() headers: any,
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
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.updateUserStatus(userId, body.isActive);
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
    @Headers() headers: any,
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
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.sendPasswordReset(userId);
  }

  @Get('user/:userId/data')
  @ApiOperation({ summary: 'Get all data for a specific user' })
  @ApiResponse({ status: 200, description: 'User data' })
  async getUserData(@Param('userId') userId: string, @Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.adminService.getUserData(userId);
  }

  @Get('tenant/:tenantId/data')
  @ApiOperation({ summary: 'Get all data for a specific tenant' })
  @ApiResponse({ status: 200, description: 'Tenant data' })
  async getTenantData(
    @Param('tenantId') tenantId: string,
    @Headers() headers: any,
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
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.updateTenantSubscription(tenantId, body);
  }

  @Get('tables')
  @ApiOperation({ summary: 'Get all table information' })
  @ApiResponse({ status: 200, description: 'Database table information' })
  async getAllTables(@Headers() headers: any) {
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
    @Headers() headers?: any,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getTableData(tableName, tenantId, limit, offset);
  }

  @Get('retention/config')
  @ApiOperation({ summary: 'Get data retention configuration' })
  @ApiResponse({ status: 200, description: 'Retention configuration' })
  async getRetentionConfig(@Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.adminService.getRetentionConfig();
  }

  @Get('retention/status')
  @ApiOperation({ summary: 'Get retention job status and statistics' })
  @ApiResponse({ status: 200, description: 'Retention status and stats' })
  async getRetentionStatus(@Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.adminService.getRetentionStatus();
  }

  @Get('retention/history')
  @ApiOperation({ summary: 'Get retention job execution history' })
  @ApiResponse({ status: 200, description: 'Retention job history' })
  async getRetentionHistory(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Headers() headers?: any,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getRetentionHistory(limit, offset);
  }

  @Post('retention/dry-run')
  @ApiOperation({ summary: 'Execute retention job in dry-run mode' })
  @ApiResponse({ status: 200, description: 'Dry-run results' })
  async executeRetentionDryRun(@Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.adminService.executeRetentionDryRun();
  }

  @Post('retention/execute')
  @ApiOperation({ summary: 'Execute retention job (live purge)' })
  @ApiResponse({ status: 200, description: 'Live purge results' })
  async executeRetention(
    @Headers() headers: any,
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
  async getPlanLimits(@Headers() headers: any) {
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
    @Headers() headers: any,
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
  @ApiOperation({ summary: 'Belirli bir tenant için limitleri (default+override+effective) ve kullanım istatistiklerini getir' })
  @ApiResponse({ status: 200, description: 'Tenant limits and usage' })
  async getTenantLimits(
    @Param('tenantId') tenantId: string,
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getTenantLimits(tenantId);
  }

  @Patch('tenant/:tenantId/limits')
  @ApiOperation({ summary: 'Belirli bir tenant için limit override değerlerini güncelle' })
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
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.updateTenantLimits(tenantId, body);
  }

  // === Tenant Konsol (tek bakışta) ===
  @Get('tenant/:tenantId/overview')
  @ApiOperation({ summary: 'Tek ekranda tenant özeti: kullanıcılar, limitler, kullanım, organizasyonlar, davetler' })
  @ApiResponse({ status: 200, description: 'Tenant overview' })
  async getTenantOverview(
    @Param('tenantId') tenantId: string,
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getTenantOverview(tenantId);
  }

  @Patch('tenant/:tenantId')
  @ApiOperation({ summary: 'Update tenant basic fields (name/companyName)' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  async updateTenantBasic(
    @Param('tenantId') tenantId: string,
    @Body() body: { name?: string; companyName?: string },
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.updateTenantBasic(tenantId, body);
  }
}

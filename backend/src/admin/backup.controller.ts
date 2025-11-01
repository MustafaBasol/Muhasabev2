import { Controller, Get, Post, Delete, Param, Query, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { BackupService, BackupMetadata } from './backup.service';
import { AdminService } from './admin.service';

@Controller('admin/backups')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly adminService: AdminService,
  ) {}

  private checkAdminAuth(headers: any) {
    const adminToken = headers['admin-token'];
    if (!adminToken) {
      throw new UnauthorizedException('Admin token required');
    }
    if (!this.adminService.isValidAdminToken(adminToken)) {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }

  /**
   * Tüm backup'ları listele
   */
  @Get()
  async listBackups(@Query('type') type?: 'system' | 'user' | 'tenant', @Headers() headers?: any) {
    this.checkAdminAuth(headers);
    return this.backupService.listBackups(type);
  }

  /**
   * Belirli bir kullanıcının backup'larını listele
   */
  @Get('user/:userId')
  async listUserBackups(@Param('userId') userId: string, @Headers() headers?: any) {
    this.checkAdminAuth(headers);
    return this.backupService.listUserBackups(userId);
  }

  /**
   * Sistem bazlı backup al (tüm sistem)
   */
  @Post('system')
  async createSystemBackup(@Body('description') description?: string, @Headers() headers?: any) {
    this.checkAdminAuth(headers);
    return this.backupService.createSystemBackup(description);
  }

  /**
   * Kullanıcı bazlı backup al
   */
  @Post('user/:userId')
  async createUserBackup(
    @Param('userId') userId: string,
    @Body('description') description?: string,
    @Headers() headers?: any,
  ) {
    this.checkAdminAuth(headers);
    return this.backupService.createUserBackup(userId, description);
  }

  /**
   * Tenant bazlı backup al
   */
  @Post('tenant/:tenantId')
  async createTenantBackup(
    @Param('tenantId') tenantId: string,
    @Body('description') description?: string,
    @Headers() headers?: any,
  ) {
    this.checkAdminAuth(headers);
    return this.backupService.createTenantBackup(tenantId, description);
  }

  /**
   * Sistem bazlı restore (tüm sistem belirli tarihe geri döner)
   */
  @Post('restore/system/:backupId')
  async restoreSystem(
    @Param('backupId') backupId: string,
    @Body('confirm') confirm: boolean,
    @Headers() headers?: any,
  ) {
    this.checkAdminAuth(headers);
    if (!confirm) {
      throw new Error('Sistem geri yüklemesi için confirm: true gerekli');
    }
    return this.backupService.restoreSystemBackup(backupId);
  }

  /**
   * Kullanıcı bazlı restore (sadece bu kullanıcının verileri geri yüklenir)
   */
  @Post('restore/user/:userId/:backupId')
  async restoreUser(
    @Param('userId') userId: string,
    @Param('backupId') backupId: string,
    @Body('confirm') confirm: boolean,
    @Headers() headers?: any,
  ) {
    this.checkAdminAuth(headers);
    if (!confirm) {
      throw new Error('Kullanıcı geri yüklemesi için confirm: true gerekli');
    }
    return this.backupService.restoreUserBackup(userId, backupId);
  }

  /**
   * Tenant bazlı restore (tenant ve tüm kullanıcıları)
   */
  @Post('restore/tenant/:tenantId/:backupId')
  async restoreTenant(
    @Param('tenantId') tenantId: string,
    @Param('backupId') backupId: string,
    @Body('confirm') confirm: boolean,
    @Headers() headers?: any,
  ) {
    this.checkAdminAuth(headers);
    if (!confirm) {
      throw new Error('Tenant geri yüklemesi için confirm: true gerekli');
    }
    return this.backupService.restoreTenantBackup(tenantId, backupId);
  }

  /**
   * Backup sil
   */
  @Delete(':backupId')
  async deleteBackup(@Param('backupId') backupId: string, @Headers() headers?: any) {
    this.checkAdminAuth(headers);
    return this.backupService.deleteBackup(backupId);
  }

  /**
   * Eski backup'ları otomatik temizle (30 günden eski)
   */
  @Post('cleanup')
  async cleanupOldBackups(@Headers() headers?: any) {
    this.checkAdminAuth(headers);
    return this.backupService.cleanupOldBackups();
  }

  /**
   * Backup istatistikleri
   */
  @Get('statistics')
  async getStatistics(@Headers() headers?: any) {
    this.checkAdminAuth(headers);
    return this.backupService.getStatistics();
  }
}

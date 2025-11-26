import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminSecurityService } from './admin-security.service';
import type { AdminHeaderMap } from './utils/admin-token.util';
import { resolveAdminHeaders } from './utils/admin-token.util';

@Controller('admin/security')
export class AdminSecurityController {
  constructor(private readonly svc: AdminSecurityService) {}

  private checkAdmin(headers?: AdminHeaderMap) {
    const { adminToken } = resolveAdminHeaders(headers);
    if (!adminToken) {
      throw new UnauthorizedException('Admin token gerekli');
    }
    // Basit doğrulama: Admin token varlığı diğer controller’larda kontrol ediliyor.
    // Burada ekstra bir servis yok; AdminController benzeri hafif kontrol yeterli.
  }

  @Get('config')
  async getConfig(@Headers() headers: AdminHeaderMap) {
    this.checkAdmin(headers);
    return this.svc.getConfig();
  }

  @Post('credentials')
  async updateCredentials(
    @Body()
    body: {
      currentPassword: string;
      newUsername?: string;
      newPassword?: string;
    },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdmin(headers);
    return this.svc.updateCredentials(
      body.currentPassword,
      body.newUsername,
      body.newPassword,
    );
  }

  @Post('2fa/setup')
  async setup2FA(@Headers() headers: AdminHeaderMap) {
    this.checkAdmin(headers);
    return this.svc.begin2FASetup();
  }

  @Post('2fa/verify')
  async verify2FA(
    @Body() body: { token: string },
    @Headers() headers: AdminHeaderMap,
  ) {
    this.checkAdmin(headers);
    return this.svc.verify2FA(body.token);
  }

  @Post('2fa/disable')
  async disable2FA(@Headers() headers: AdminHeaderMap) {
    this.checkAdmin(headers);
    return this.svc.disable2FA();
  }
}

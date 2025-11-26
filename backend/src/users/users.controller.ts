import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import type { UpdateNotificationPreferencesDto } from './users.service';
import {
  Enable2FADto,
  Verify2FADto,
  Disable2FADto,
} from './dto/enable-2fa.dto';
import { TwoFactorSecretResponse } from '../common/two-factor.service';
import { JwtService } from '@nestjs/jwt';
import type { User as UserEntity } from './entities/user.entity';

type ProfileUpdateDto = {
  name?: string;
  firstName?: string;
  lastName?: string;
};

type PasswordChangeDto = {
  currentPassword?: string;
  newPassword?: string;
};

type DeleteRequestDto = {
  confirmPassword?: string;
};

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Mevcut kullanıcının profilini getir
   */
  @Get('me')
  async getProfile(@Request() req: AuthenticatedRequest) {
    return this.usersService.findOne(req.user.id);
  }

  /**
   * Mevcut kullanıcının profilini güncelle
   */
  @Put('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() updateData: ProfileUpdateDto,
  ) {
    const userId = req.user.id;

    const filteredData: Partial<Pick<UserEntity, 'firstName' | 'lastName'>> =
      {};

    const providedName = updateData?.name?.trim();
    if (providedName) {
      const nameParts = providedName.split(' ');
      filteredData.firstName = nameParts[0] || req.user.firstName;
      filteredData.lastName = nameParts.slice(1).join(' ') || req.user.lastName;
    }

    if (typeof updateData?.firstName === 'string') {
      filteredData.firstName = updateData.firstName.trim();
    }
    if (typeof updateData?.lastName === 'string') {
      filteredData.lastName = updateData.lastName.trim();
    }

    // Boş update engelle
    if (Object.keys(filteredData).length === 0) {
      return this.usersService.findOne(userId);
    }

    return this.usersService.update(userId, filteredData);
  }

  /**
   * Get current user's notification preferences
   */
  @Get('me/notification-preferences')
  async getNotificationPreferences(@Request() req: AuthenticatedRequest) {
    const user = await this.usersService.findOne(req.user.id);
    return user.notificationPreferences || {};
  }

  /**
   * Update current user's notification preferences
   */
  @Put('me/notification-preferences')
  @HttpCode(HttpStatus.OK)
  async updateNotificationPreferences(
    @Request() req: AuthenticatedRequest,
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    const userId = req.user.id;
    return this.usersService.updateNotificationPreferences(userId, body);
  }

  /**
   * Mevcut kullanıcının şifresini değiştir
   */
  @Put('me/password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() body: PasswordChangeDto,
  ) {
    const userId = req.user.id;
    const { currentPassword, newPassword } = body || {};
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('currentPassword ve newPassword zorunlu');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('Yeni şifre en az 8 karakter olmalı');
    }
    const user = await this.usersService.findOne(userId);
    const valid = await this.usersService.validatePassword(
      user,
      currentPassword,
    );
    if (!valid) {
      throw new UnauthorizedException('Mevcut şifre hatalı');
    }
    await this.usersService.update(userId, { password: newPassword });
    return { success: true };
  }

  /**
   * GDPR: Export user's personal data
   */
  @Get('me/export')
  async exportData(@Request() req: AuthenticatedRequest, @Res() res: Response) {
    try {
      const userId = req.user.id;
      const zipBuffer = await this.usersService.exportUserData(userId);

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="my_data_export.zip"',
        'Content-Length': zipBuffer.length.toString(),
      });

      res.send(zipBuffer);
    } catch (error: unknown) {
      console.error('Data export error:', error);
      res.status(500).json({
        error: 'Data export failed',
        message: error instanceof Error ? error.message : 'Unexpected error',
      });
    }
  }

  /**
   * GDPR: Request account deletion
   */
  @Post('me/delete')
  @HttpCode(HttpStatus.OK)
  async requestDeletion(
    @Request() req: AuthenticatedRequest,
    @Body() _deleteRequest: DeleteRequestDto,
  ) {
    const userId = req.user.id;

    // In production, you might want to verify password
    // const isPasswordValid = await this.usersService.verifyPassword(userId, deleteRequest.confirmPassword);
    // if (!isPasswordValid) {
    //   throw new UnauthorizedException('Password verification required');
    // }

    await this.usersService.requestAccountDeletion(userId);

    return {
      message:
        'Account deletion has been scheduled. You will receive a confirmation email.',
      status: 'pending_deletion',
      deletionDate: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(), // 30 days from now
    };
  }

  /**
   * 2FA kurulumu başlatır
   */
  @Post('2fa/setup')
  async setupTwoFactor(
    @Request() req: AuthenticatedRequest,
  ): Promise<TwoFactorSecretResponse> {
    return this.usersService.setupTwoFactor(req.user.id);
  }

  /**
   * 2FA'yı aktif eder
   */
  @Post('2fa/enable')
  async enableTwoFactor(
    @Request() req: AuthenticatedRequest,
    @Body() dto: Enable2FADto,
  ): Promise<{ message: string; backupCodes: string[] }> {
    return this.usersService.enableTwoFactor(req.user.id, dto);
  }

  /**
   * 2FA token doğrular
   */
  @Post('2fa/verify')
  async verifyTwoFactor(
    @Request() req: AuthenticatedRequest,
    @Body() dto: Verify2FADto,
  ): Promise<{ valid: boolean }> {
    const valid = await this.usersService.verifyTwoFactor(req.user.id, dto);
    return { valid };
  }

  /**
   * 2FA'yı deaktif eder
   */
  @Post('2fa/disable')
  async disableTwoFactor(
    @Request() req: AuthenticatedRequest,
    @Body() dto: Disable2FADto,
  ): Promise<{ message: string }> {
    return this.usersService.disableTwoFactor(req.user.id, dto);
  }

  /**
   * 2FA durumunu kontrol eder
   */
  @Get('2fa/status')
  async getTwoFactorStatus(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ enabled: boolean; backupCodesCount: number }> {
    return this.usersService.getTwoFactorStatus(req.user.id);
  }

  /**
   * 2FA yedek kodlarını yeniden oluşturur
   */
  @Post('2fa/backup-codes/regenerate')
  async regenerateBackupCodes(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ backupCodes: string[]; count: number }> {
    return this.usersService.regenerateTwoFactorBackupCodes(req.user.id);
  }

  /**
   * Tüm oturumları sonlandır: tokenVersion artır ve mevcut istemci için yeni token döndür
   */
  @Post('sessions/terminate-all')
  @HttpCode(HttpStatus.OK)
  async terminateAllSessions(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ token: string }> {
    const userId = req.user.id;
    const updated = await this.usersService.incrementTokenVersion(userId);
    // Mevcut oturum devam etsin diye yeni bir token ver
    const payload = {
      sub: updated.id,
      email: updated.email,
      role: updated.role,
      tenantId: updated.tenantId,
      tokenVersion: updated.tokenVersion ?? 0,
    };
    return { token: this.jwtService.sign(payload) };
  }
}

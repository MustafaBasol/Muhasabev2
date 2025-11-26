import {
  Controller,
  Get,
  Put,
  Body,
  Headers,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SiteSettingsService } from './site-settings.service';
import { SiteSettings } from './entities/site-settings.entity';
import { AdminService } from '../admin/admin.service';
import type { AdminHeaderMap } from '../admin/utils/admin-token.util';
import { resolveAdminHeaders } from '../admin/utils/admin-token.util';

@ApiTags('site-settings')
@Controller('site-settings')
export class SiteSettingsController {
  constructor(
    private readonly siteSettingsService: SiteSettingsService,
    private readonly adminService: AdminService,
  ) {}

  private checkAdminAuth(headers?: AdminHeaderMap) {
    const { adminToken } = resolveAdminHeaders(headers);
    const correctToken = process.env.ADMIN_TOKEN || 'admin123';
    const ok =
      !!adminToken &&
      (this.adminService.isValidAdminToken(adminToken) ||
        adminToken === correctToken);
    if (!ok) throw new UnauthorizedException('Admin authentication required');
  }

  @Get()
  @ApiOperation({
    summary: 'Get site settings (public - for injecting meta tags)',
  })
  @ApiResponse({
    status: 200,
    description: 'Site settings retrieved',
    type: SiteSettings,
  })
  async getSettings(): Promise<SiteSettings> {
    try {
      return await this.siteSettingsService.getSettings();
    } catch (error) {
      console.error('SiteSettingsController.getSettings error:', error);
      throw error;
    }
  }

  @Put()
  @ApiOperation({ summary: 'Update site settings (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Settings updated',
    type: SiteSettings,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateSettings(
    @Body() updates: Partial<SiteSettings>,
    @Headers() headers: AdminHeaderMap,
  ): Promise<SiteSettings> {
    this.checkAdminAuth(headers);

    // Remove id, createdAt, updatedAt from updates to prevent user manipulation
    const safeUpdates = this.stripImmutableFields(updates);

    return this.siteSettingsService.updateSettings(safeUpdates);
  }

  private stripImmutableFields(
    updates: Partial<SiteSettings>,
  ): Partial<SiteSettings> {
    if (!updates || typeof updates !== 'object') {
      throw new InternalServerErrorException('Invalid settings payload');
    }
    const { id, createdAt, updatedAt, ...rest } = updates;
    void id;
    void createdAt;
    void updatedAt;
    return rest;
  }
}

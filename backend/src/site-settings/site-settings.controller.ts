import { Controller, Get, Put, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SiteSettingsService } from './site-settings.service';
import { SiteSettings } from './entities/site-settings.entity';

@ApiTags('site-settings')
@Controller('site-settings')
export class SiteSettingsController {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  private checkAdminAuth(headers: any) {
    const adminToken = headers['admin-token'];
    const correctToken = process.env.ADMIN_TOKEN || 'admin123';
    
    if (!adminToken || adminToken !== correctToken) {
      throw new UnauthorizedException('Admin authentication required');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get site settings (public - for injecting meta tags)' })
  @ApiResponse({ status: 200, description: 'Site settings retrieved', type: SiteSettings })
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
  @ApiResponse({ status: 200, description: 'Settings updated', type: SiteSettings })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateSettings(
    @Body() updates: Partial<SiteSettings>,
    @Headers() headers: any,
  ): Promise<SiteSettings> {
    this.checkAdminAuth(headers);
    
    // Remove id, createdAt, updatedAt from updates to prevent user manipulation
    const { id, createdAt, updatedAt, ...safeUpdates } = updates as any;
    
    return this.siteSettingsService.updateSettings(safeUpdates);
  }
}

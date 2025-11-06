import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { TenantsService } from './tenants.service';
import type { UpdateTenantDto } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('my-tenant')
  @ApiOperation({ summary: "Get current user's tenant" })
  async getMyTenant(@User() user: any) {
    return this.tenantsService.findOne(user.tenantId);
  }

  @Patch('my-tenant')
  @ApiOperation({ summary: "Update current user's tenant" })
  async updateMyTenant(
    @Body() updateTenantDto: UpdateTenantDto,
    @User() user: any,
  ) {
    // Yalnızca TENANT sahibi (tenant_admin) şirket adını/kimliğini değiştirebilir
    const isOwner = user?.role === UserRole.TENANT_ADMIN;

    // Sahip değilse, kimlik alanlarını sessizce düşür (403 yerine görsel deneyim)
    // Yalnız güvenli alanları topla ve undefined değerleri ayıkla
    const allowedKeys: (keyof UpdateTenantDto)[] = [
      'companyName',
      'email',
      'phone',
      'address',
      'taxNumber',
      'website',
      'taxOffice',
      'mersisNumber',
      'kepAddress',
      'siretNumber',
      'sirenNumber',
      'apeCode',
      'tvaNumber',
      'rcsNumber',
      'steuernummer',
      'umsatzsteuerID',
      'handelsregisternummer',
      'geschaeftsfuehrer',
      'einNumber',
      'taxId',
      'businessLicenseNumber',
      'stateOfIncorporation',
      'name',
      'settings',
    ];

    const sanitize = (dto: UpdateTenantDto): any => {
      const out: any = {};
      for (const k of allowedKeys) {
        const v = (dto as any)[k];
        if (typeof v !== 'undefined') {
          out[k] = v;
        }
      }
      // settings.brand içindeki undefined değerleri de temizle
      if (out.settings && typeof out.settings === 'object') {
        try {
          out.settings = JSON.parse(JSON.stringify(out.settings));
        } catch {}
      }
      // Logo boyutu için güvenli bir üst sınır uygula (yaklaşık 5MB karakter limit)
      const logo = out?.settings?.brand?.logoDataUrl;
      if (logo && typeof logo === 'string' && logo.length > 5_000_000) {
        throw new BadRequestException(
          'Logo çok büyük. Lütfen 5MB altında bir logo yükleyin.',
        );
      }
      return out;
    };

    if (!isOwner && updateTenantDto) {
      const clone: any = sanitize(updateTenantDto);
      if (Object.prototype.hasOwnProperty.call(clone, 'name')) {
        delete clone.name;
      }
      if (Object.prototype.hasOwnProperty.call(clone, 'companyName')) {
        delete clone.companyName;
      }
      return this.tenantsService.update(user.tenantId, clone);
    }

    return this.tenantsService.update(user.tenantId, sanitize(updateTenantDto));
  }
}

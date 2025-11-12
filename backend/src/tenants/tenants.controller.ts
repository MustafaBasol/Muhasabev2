import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { TenantsService } from './tenants.service';
import { SubscriptionPlan } from './entities/tenant.entity';
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

  // === Subscription management for tenant owners (mocked integration) ===
  @Patch('my-tenant/subscription')
  @ApiOperation({
    summary: 'Update subscription (plan/users) for current tenant',
  })
  async updateMySubscription(
    @Body()
    body: {
      plan?: SubscriptionPlan;
      users?: number; // desired max users
      billing?: 'monthly' | 'yearly';
      cancel?: boolean;
      cancelAtPeriodEnd?: boolean; // dönem sonunda iptal et
    },
    @User() user: any,
  ) {
    const isOwner = user?.role === UserRole.TENANT_ADMIN;
    if (!isOwner) {
      throw new BadRequestException(
        'Only tenant owners can manage subscription',
      );
    }

    const tenantId = user.tenantId;
    let updated = await this.tenantsService.findOne(tenantId);

    // Dönem sonunda iptal isteği (yalnızca aktif abonelikler için anlamlı)
    if (body?.cancelAtPeriodEnd) {
      updated = await this.tenantsService.setCancelAtPeriodEnd(tenantId, true);
    }

    // Anında iptal (hemen Free'a düşür)
    if (body?.cancel) {
      updated = await this.tenantsService.updateSubscription(
        tenantId,
        SubscriptionPlan.FREE,
      );
      return { success: true, tenant: updated };
    }

    // Plan değişimi veya billing değişimi: basit expiration hesapla
    if (body?.plan || body?.billing) {
      let expiresAt: Date | undefined;
      const billing = body?.billing || 'monthly';
      if (body?.plan && body.plan !== SubscriptionPlan.FREE) {
        expiresAt = new Date();
        if (billing === 'yearly') {
          expiresAt.setDate(expiresAt.getDate() + 365);
        } else {
          expiresAt.setDate(expiresAt.getDate() + 30);
        }
      }
      if (body?.plan) {
        updated = await this.tenantsService.updateSubscription(
          tenantId,
          body.plan,
          expiresAt,
        );
      } else if (expiresAt) {
        // yalnız billing değiştiyse sadece expiration güncelle
        updated = await this.tenantsService.update(tenantId, {
          subscriptionExpiresAt: expiresAt,
          cancelAtPeriodEnd: false,
        });
      }
    }

    if (typeof body?.users === 'number' && body.users > 0) {
      updated = await this.tenantsService.updateMaxUsers(tenantId, body.users);
    }

    // Her durumda plan limitlerini son kez uygula (özellikle downgrade sonrası 4->1 gibi)
    updated = await this.tenantsService.enforcePlanLimits(tenantId);

    return { success: true, tenant: updated };
  }

  @Get('my-tenant/subscription/history')
  @ApiOperation({ summary: 'Get mock subscription history' })
  async getMySubscriptionHistory(@User() user: any) {
    const tenant = await this.tenantsService.findOne(user.tenantId);
    // Basit mock event listesi
    const events: any[] = [];
    if (tenant.subscriptionPlan) {
      events.push({
        type: 'plan.current',
        plan: tenant.subscriptionPlan,
        at: tenant.updatedAt,
        users: tenant.maxUsers,
      });
    }
    if (tenant.subscriptionExpiresAt) {
      events.push({
        type: 'plan.renewal_due',
        at: tenant.subscriptionExpiresAt,
      });
    }
    if (tenant.cancelAtPeriodEnd) {
      events.push({ type: 'cancel.at_period_end', at: tenant.updatedAt });
    }
    return { success: true, events };
  }
}

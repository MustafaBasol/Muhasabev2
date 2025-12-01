import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '../users/entities/user.entity';
import { TenantsService } from './tenants.service';
import { SubscriptionPlan } from './entities/tenant.entity';
import type { UpdateTenantDto } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';
import type { CurrentUser } from '../common/decorators/user.decorator';

const TENANT_UPDATE_KEYS = [
  'companyName',
  'email',
  'phone',
  'address',
  'taxNumber',
  'website',
  'currency',
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
] as const;

type TenantUpdateKey = (typeof TENANT_UPDATE_KEYS)[number];
type SanitizedTenantUpdate = Partial<Pick<UpdateTenantDto, TenantUpdateKey>>;

type TenantHistoryEvent =
  | {
      type: 'plan.current';
      plan: SubscriptionPlan | null;
      at: Date | null;
      users: number | null;
    }
  | { type: 'plan.renewal_due'; at: Date | null }
  | { type: 'cancel.at_period_end'; at: Date | null };

const LOGO_CHARACTER_LIMIT = 5_000_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractLogoDataUrl = (
  settings?: Record<string, unknown>,
): string | null => {
  if (!isRecord(settings)) return null;
  const brandRaw = settings.brand;
  if (!isRecord(brandRaw)) return null;
  const logo = brandRaw.logoDataUrl;
  return typeof logo === 'string' ? logo : null;
};

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantsController {
  private readonly logger = new Logger(TenantsController.name);

  constructor(private readonly tenantsService: TenantsService) {}

  @Get('my-tenant')
  @ApiOperation({ summary: "Get current user's tenant" })
  async getMyTenant(@User() user: CurrentUser) {
    const tenantId = this.ensureTenantId(user);
    return this.tenantsService.findOne(tenantId);
  }

  @Patch('my-tenant')
  @ApiOperation({ summary: "Update current user's tenant" })
  async updateMyTenant(
    @Body() updateTenantDto: UpdateTenantDto,
    @User() user: CurrentUser,
  ) {
    const tenantId = this.ensureTenantId(user);
    // Yalnızca TENANT sahibi (tenant_admin) şirket adını/kimliğini değiştirebilir
    const isOwner = user?.role === UserRole.TENANT_ADMIN;

    // Sahip değilse, kimlik alanlarını sessizce düşür (403 yerine görsel deneyim)
    // Yalnız güvenli alanları topla ve undefined değerleri ayıkla
    const sanitize = (dto: UpdateTenantDto): SanitizedTenantUpdate => {
      const sanitized = Object.fromEntries(
        TENANT_UPDATE_KEYS.flatMap((key) => {
          const value = dto[key];
          return typeof value === 'undefined' ? [] : ([[key, value]] as const);
        }),
      ) as SanitizedTenantUpdate;

      if ('settings' in sanitized) {
        if (!isRecord(sanitized.settings)) {
          delete sanitized.settings;
        } else {
          try {
            sanitized.settings = JSON.parse(
              JSON.stringify(sanitized.settings),
            ) as Record<string, unknown>;
          } catch (error) {
            this.logger.warn(
              `TenantsController sanitize settings failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            delete sanitized.settings;
          }
        }
      }

      const logoDataUrl = extractLogoDataUrl(sanitized.settings);
      if (
        typeof logoDataUrl === 'string' &&
        logoDataUrl.length > LOGO_CHARACTER_LIMIT
      ) {
        throw new BadRequestException(
          'Logo çok büyük. Lütfen 5MB altında bir logo yükleyin.',
        );
      }

      return sanitized;
    };

    if (!isOwner && updateTenantDto) {
      const clone = sanitize(updateTenantDto);
      if (Object.prototype.hasOwnProperty.call(clone, 'name')) {
        delete clone.name;
      }
      if (Object.prototype.hasOwnProperty.call(clone, 'companyName')) {
        delete clone.companyName;
      }
      return this.tenantsService.update(tenantId, clone);
    }

    return this.tenantsService.update(tenantId, sanitize(updateTenantDto));
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
    @User() user: CurrentUser,
  ) {
    const tenantId = this.ensureTenantId(user);
    const isOwner = user.role === UserRole.TENANT_ADMIN;
    if (!isOwner) {
      throw new BadRequestException(
        'Only tenant owners can manage subscription',
      );
    }

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
  async getMySubscriptionHistory(@User() user: CurrentUser) {
    const tenantId = this.ensureTenantId(user);
    const tenant = await this.tenantsService.findOne(tenantId);
    // Basit mock event listesi
    const events: TenantHistoryEvent[] = [];
    if (tenant.subscriptionPlan) {
      events.push({
        type: 'plan.current',
        plan: tenant.subscriptionPlan,
        at: tenant.updatedAt ?? null,
        users: tenant.maxUsers ?? null,
      });
    }
    if (tenant.subscriptionExpiresAt) {
      events.push({
        type: 'plan.renewal_due',
        at: tenant.subscriptionExpiresAt,
      });
    }
    if (tenant.cancelAtPeriodEnd) {
      events.push({
        type: 'cancel.at_period_end',
        at: tenant.updatedAt ?? null,
      });
    }
    return { success: true, events };
  }

  private ensureTenantId(user: CurrentUser): string {
    if (!user || !user.tenantId) {
      throw new BadRequestException('Tenant bilgisi bulunamadı.');
    }
    return String(user.tenantId);
  }
}

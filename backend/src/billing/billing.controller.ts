import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import type { UpgradeStatusSummary } from './billing.service';
import { SubscriptionPlan } from '../tenants/entities/tenant.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';
import type { CurrentUser } from '../common/decorators/user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  async createCheckout(
    @Body()
    body: {
      tenantId: string;
      plan: SubscriptionPlan | string;
      interval: 'month' | 'year';
      seats?: number;
      successUrl: string;
      cancelUrl: string;
    },
    @User() user: CurrentUser,
  ) {
    const customerEmail = this.resolveCustomerEmail(user);
    return this.billing.createCheckoutSession({ ...body, customerEmail });
  }

  @Get(':tenantId/portal')
  async portal(
    @Param('tenantId') tenantId: string,
    @Query('returnUrl') returnUrl: string,
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, tenantId);
    // Basit yetki kontrolü: kendi tenant'ı dışında erişemez
    return this.billing.createPortalSession(tenantId, returnUrl);
  }

  @Post(':tenantId/seats')
  async updateSeats(
    @Param('tenantId') tenantId: string,
    @Body() body: { seats: number; billNow?: boolean },
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, tenantId);
    return this.billing.updateSeats(tenantId, body.seats);
  }

  @Post(':tenantId/cancel')
  async cancelAtPeriodEnd(
    @Param('tenantId') tenantId: string,
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, tenantId);
    return this.billing.cancelAtPeriodEnd(tenantId);
  }

  // Aboneliği yeniden başlat (cancel_at_period_end = false)
  @Post(':tenantId/resume')
  async resume(@Param('tenantId') tenantId: string, @User() user: CurrentUser) {
    this.assertTenantAccess(user, tenantId);
    return this.billing.resumeCancellation(tenantId);
  }

  @Get(':tenantId/invoices')
  async invoices(
    @Param('tenantId') tenantId: string,
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, tenantId);
    return this.billing.listInvoices(tenantId);
  }

  @Get(':tenantId/history')
  async history(
    @Param('tenantId') tenantId: string,
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, tenantId);
    return this.billing.listHistory(tenantId);
  }

  // Upgrade durumunu hızlı sorgulama (plan güncellendi mi? son ücretli fatura?)
  @Get(':tenantId/upgrade-status')
  async upgradeStatus(
    @Param('tenantId') tenantId: string,
    @User() user: CurrentUser,
  ): Promise<UpgradeStatusSummary> {
    this.assertTenantAccess(user, tenantId);
    return this.billing.getUpgradeStatus(tenantId);
  }

  @Post(':tenantId/sync')
  async manualSync(
    @Param('tenantId') tenantId: string,
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, tenantId);
    return this.billing.syncFromStripe(tenantId);
  }

  // Plan / interval güncellemesi: mevcut aboneliği yerinde değiştir (proration uygular)
  @Post(':tenantId/plan-update')
  async planUpdate(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      plan: SubscriptionPlan | string;
      interval: 'month' | 'year';
      seats?: number;
      chargeNow?: boolean;
      interactive?: boolean;
      idempotencyKey?: string;
    },
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, tenantId);
    return this.billing.updatePlanAndInterval({
      tenantId,
      plan: body.plan,
      interval: body.interval,
      seats: body.seats,
      chargeNow: body.chargeNow ?? true,
      interactive: body.interactive ?? true,
      idempotencyKey: body.idempotencyKey,
    });
  }

  // İlave kullanıcılar için proration ile add-on artırma
  @Post(':tenantId/addon/checkout')
  async addonCheckout(
    @Param('tenantId') tenantId: string,
    @Body()
    body: { additional: number; successUrl?: string; cancelUrl?: string },
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, tenantId);
    return this.billing.addAddonUsersProrated({
      tenantId,
      additional: body.additional,
    });
  }

  // İlave kullanıcıları anında faturalandır ve tahsil et
  @Post(':tenantId/addon/charge')
  async addonCharge(
    @Param('tenantId') tenantId: string,
    @Body() body: { additional: number },
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, tenantId);
    return this.billing.addAddonUsersAndInvoiceNow({
      tenantId,
      additional: body.additional,
    });
  }

  // Alternatif route (tenantId body'de) - 404 durumunda frontend fallback için
  @Post('addon/charge')
  async addonChargeAlt(
    @Body() body: { tenantId: string; additional: number },
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, body?.tenantId);
    return this.billing.addAddonUsersAndInvoiceNow({
      tenantId: body.tenantId,
      additional: body.additional,
    });
  }

  @Post('addon/prorate')
  async addonProrateAlt(
    @Body() body: { tenantId: string; additional: number },
    @User() user: CurrentUser,
  ) {
    this.assertTenantAccess(user, body?.tenantId);
    return this.billing.addAddonUsersProrated({
      tenantId: body.tenantId,
      additional: body.additional,
    });
  }

  private resolveCustomerEmail(user?: CurrentUser) {
    const email = typeof user?.email === 'string' ? user.email.trim() : '';
    return email.length > 0 ? email : undefined;
  }

  private assertTenantAccess(user: CurrentUser | undefined, tenantId?: string) {
    const normalizedTenantId = tenantId?.trim();
    if (!user?.tenantId || !normalizedTenantId) {
      throw new ForbiddenException();
    }
    if (user.tenantId !== normalizedTenantId) {
      throw new ForbiddenException();
    }
  }
}

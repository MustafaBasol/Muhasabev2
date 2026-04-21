import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PennylaneOAuthService } from './services/pennylane-oauth.service';
import { PennylaneSubmitService } from './services/pennylane-submit.service';
import { PennylaneStatusSyncService } from './services/pennylane-status-sync.service';

interface AuthenticatedRequest extends Request {
  user?: { tenantId: string };
}

/**
 * PennylaneController
 *
 * Endpointler:
 *   GET  /integrations/pennylane/oauth/authorize   → Pennylane auth URL'ine yönlendir
 *   GET  /integrations/pennylane/oauth/callback    → Code → token exchange
 *   POST /integrations/pennylane/invoices/submit   → Fatura gönder
 *   POST /integrations/pennylane/sync              → Durum senkronizasyonu
 */
@Controller('integrations/pennylane')
export class PennylaneController {
  private readonly logger = new Logger(PennylaneController.name);

  constructor(
    private readonly oauthService: PennylaneOAuthService,
    private readonly submitService: PennylaneSubmitService,
    private readonly syncService: PennylaneStatusSyncService,
  ) {}

  // ─── OAuth: Step 1 — Yönlendirme ─────────────────────────────────────────

  @Get('oauth/authorize')
  authorize(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ): void {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant bulunamadı.');

    const clientId = process.env.PENNYLANE_CLIENT_ID;
    const redirectUri = process.env.PENNYLANE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new BadRequestException('Pennylane OAuth yapılandırması eksik.');
    }

    const url = this.oauthService.getAuthorizationUrl(clientId, redirectUri, tenantId);
    res.redirect(url);
  }

  // ─── OAuth: Step 2 — Callback ─────────────────────────────────────────────

  @Get('oauth/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') tenantId: string,
    @Query('error') error?: string,
    @Res() res?: Response,
  ): Promise<object | void> {
    if (error) {
      this.logger.warn(`OAuth hatası: ${error} (tenant=${tenantId})`);
      if (res) return res.redirect(`/settings/integrations?error=${encodeURIComponent(error)}`);
    }

    if (!code || !tenantId) {
      throw new BadRequestException('code ve state (tenantId) zorunludur.');
    }

    const clientId = process.env.PENNYLANE_CLIENT_ID ?? '';
    const clientSecret = process.env.PENNYLANE_CLIENT_SECRET ?? '';
    const redirectUri = process.env.PENNYLANE_REDIRECT_URI ?? '';

    await this.oauthService.handleCallback({ code, tenantId, clientId, clientSecret, redirectUri });

    if (res) {
      return res.redirect('/settings/integrations?connected=pennylane');
    }
    return { ok: true, message: 'Pennylane bağlantısı kuruldu.' };
  }

  // ─── Invoice Submit ────────────────────────────────────────────────────────

  @Post('invoices/submit')
  @HttpCode(HttpStatus.OK)
  async submitInvoice(
    @Req() req: AuthenticatedRequest,
    @Body() body: { invoiceId: string },
  ): Promise<object> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant bulunamadı.');
    if (!body.invoiceId) throw new BadRequestException('invoiceId zorunludur.');

    const result = await this.submitService.submitInvoice(tenantId, body.invoiceId);
    return { ok: true, ...result };
  }

  // ─── Status Sync ──────────────────────────────────────────────────────────

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync(@Req() req: AuthenticatedRequest): Promise<object> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant bulunamadı.');

    const result = await this.syncService.syncForTenant(tenantId);
    return { ok: true, ...result };
  }
}

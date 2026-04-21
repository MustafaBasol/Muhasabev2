import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PennylaneOAuthService } from './services/pennylane-oauth.service';
import { PennylaneSubmitService } from './services/pennylane-submit.service';
import { PennylaneStatusSyncService } from './services/pennylane-status-sync.service';
import { PennylaneApiClient } from './services/pennylane-api.client';

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
    private readonly apiClient: PennylaneApiClient,
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
      const frontendUrl = process.env.FRONTEND_URL ?? '';
      if (res) return res.redirect(`${frontendUrl}/settings/integrations?error=${encodeURIComponent(error)}`);
    }

    if (!code || !tenantId) {
      throw new BadRequestException('code ve state (tenantId) zorunludur.');
    }

    const clientId = process.env.PENNYLANE_CLIENT_ID ?? '';
    const clientSecret = process.env.PENNYLANE_CLIENT_SECRET ?? '';
    const redirectUri = process.env.PENNYLANE_REDIRECT_URI ?? '';

    await this.oauthService.handleCallback({ code, tenantId, clientId, clientSecret, redirectUri });

    const frontendUrl = process.env.FRONTEND_URL ?? '';
    if (res) {
      return res.redirect(`${frontendUrl}/settings/integrations?connected=pennylane`);
    }
    return { ok: true, message: 'Pennylane bağlantısı kuruldu.' };
  }

  // ─── Status & Disconnect ──────────────────────────────────────────────────

  @Get('status')
  async getStatus(@Req() req: AuthenticatedRequest): Promise<object> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant bulunamadı.');
    return this.oauthService.getConnectionStatus(tenantId);
  }

  // ─── Bağlantı Doğrulama (/me) ────────────────────────────────────────────

  /**
   * Pennylane /me endpoint'ini çağırarak mevcut token'ın geçerli olduğunu doğrular.
   * Docs: "call the /me endpoint to verify your setup is correct"
   */
  @Get('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Req() req: AuthenticatedRequest): Promise<object> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant bulunamadı.');

    const clientId = process.env.PENNYLANE_CLIENT_ID ?? '';
    const clientSecret = process.env.PENNYLANE_CLIENT_SECRET ?? '';

    try {
      const token = await this.oauthService.getValidAccessToken(tenantId, clientId, clientSecret);
      const me = await this.apiClient.verifyConnection(token);
      return { ok: true, email: me.email, role: me.role };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
      throw new InternalServerErrorException(`Pennylane bağlantısı doğrulanamadı: ${message}`);
    }
  }

  @Delete('disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Req() req: AuthenticatedRequest): Promise<object> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant bulunamadı.');
    await this.oauthService.disconnect(tenantId);
    return { ok: true, message: 'Pennylane bağlantısı kesildi.' };
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

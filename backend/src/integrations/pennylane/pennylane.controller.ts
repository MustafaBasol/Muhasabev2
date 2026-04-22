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
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PennylaneOAuthService } from './services/pennylane-oauth.service';
import { PennylaneSubmitService } from './services/pennylane-submit.service';
import { PennylaneStatusSyncService } from './services/pennylane-status-sync.service';
import { PennylaneApiClient } from './services/pennylane-api.client';
import { PennylaneIncomingInvoiceService } from './services/pennylane-incoming-invoice.service';

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
    private readonly incomingService: PennylaneIncomingInvoiceService,
  ) {}

  // ─── OAuth: Step 1 — URL döndür (frontend yönlendirir) ──────────────────

  @Get('oauth/authorize')
  @UseGuards(JwtAuthGuard)
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

  /**
   * Tarayıcı navigasyonu JWT göndermediği için bu endpoint URL'yi JSON olarak döner.
   * Frontend authenticated çağrıyla URL'yi alır, sonra window.location.href ile yönlendirir.
   */
  @Get('oauth/authorize-url')
  @UseGuards(JwtAuthGuard)
  getAuthorizeUrl(@Req() req: AuthenticatedRequest): object {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant bulunamadı.');

    const clientId = process.env.PENNYLANE_CLIENT_ID;
    const redirectUri = process.env.PENNYLANE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new BadRequestException('Pennylane OAuth yapılandırması eksik.');
    }

    const url = this.oauthService.getAuthorizationUrl(clientId, redirectUri, tenantId);
    return { url };
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(@Req() req: AuthenticatedRequest): Promise<object> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant bulunamadı.');
    await this.oauthService.disconnect(tenantId);
    return { ok: true, message: 'Pennylane bağlantısı kesildi.' };
  }

  // ─── Invoice Submit ────────────────────────────────────────────────────────

  @Post('invoices/submit')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sync(@Req() req: AuthenticatedRequest): Promise<object> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant bulunamadı.');

    const result = await this.syncService.syncForTenant(tenantId);
    return { ok: true, ...result };
  }

  // ─── Gelen E-Fatura (Incoming Sync) ─────────────────────────────────────────

  /**
   * POST /integrations/pennylane/incoming/sync
   *
   * Pennylane'deki tedarikçi faturalarını çeker ve
   * Comptario'da gider kaydı olarak oluşturur.
   */
  @Post('incoming/sync')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async syncIncoming(@Req() req: AuthenticatedRequest): Promise<object> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant bulunamadı.');

    try {
      const result = await this.incomingService.syncIncomingInvoices(tenantId);
      return { ok: true, ...result };
    } catch (err) {
      this.logger.error(`Gelen e-fatura sync hatası: ${(err as Error).message}`);
      throw new InternalServerErrorException('Gelen fatura senkronizasyonu başarısız.');
    }
  }
}

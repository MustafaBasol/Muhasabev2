import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { ChorusProOAuthService } from './services/chorus-pro-oauth.service';
import { ChorusProSubmitService } from './services/chorus-pro-submit.service';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

/**
 * ChorusProController
 *
 * Endpointler:
 *   POST   /integrations/chorus-pro/connect       → Tenant credentials bağla
 *   DELETE /integrations/chorus-pro/connect       → Bağlantıyı kes
 *   GET    /integrations/chorus-pro/status        → Bağlantı durumu sorgula
 *   POST   /integrations/chorus-pro/invoices/submit   → Fatura gönder
 *   POST   /integrations/chorus-pro/invoices/sync     → Durum senkronizasyonu
 */
@ApiTags('integrations/chorus-pro')
@Controller('integrations/chorus-pro')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChorusProController {
  private readonly logger = new Logger(ChorusProController.name);

  constructor(
    private readonly oauthService: ChorusProOAuthService,
    private readonly submitService: ChorusProSubmitService,
  ) {}

  // ─── Bağlantı yönetimi ─────────────────────────────────────────────────────

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      pisteClientId: string;
      pisteClientSecret: string;
      siret: string;
    },
  ): Promise<{ message: string }> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException();

    if (!body.pisteClientId || !body.pisteClientSecret || !body.siret) {
      throw new BadRequestException(
        'pisteClientId, pisteClientSecret ve siret zorunludur.',
      );
    }

    await this.oauthService.connect({
      tenantId,
      pisteClientId: body.pisteClientId,
      pisteClientSecret: body.pisteClientSecret,
      siret: body.siret,
    });

    return { message: 'Chorus Pro başarıyla bağlandı.' };
  }

  @Delete('connect')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException();

    await this.oauthService.disconnect(tenantId);
    return { message: 'Chorus Pro bağlantısı kesildi.' };
  }

  @Get('status')
  async getStatus(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ connected: boolean; siret?: string }> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException();
    return this.oauthService.getConnectionStatus(tenantId);
  }

  // ─── Fatura işlemleri ──────────────────────────────────────────────────────

  @Post('invoices/submit')
  @HttpCode(HttpStatus.OK)
  async submitInvoice(
    @Req() req: AuthenticatedRequest,
    @Body('invoiceId') invoiceId: string,
  ): Promise<object> {
    if (!invoiceId) throw new BadRequestException('invoiceId zorunludur.');
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException();

    const result = await this.submitService.submitInvoice(tenantId, invoiceId);
    return result;
  }

  @Post('invoices/sync')
  @HttpCode(HttpStatus.OK)
  async syncStatus(
    @Req() req: AuthenticatedRequest,
    @Body('invoiceId') invoiceId: string,
  ): Promise<object> {
    if (!invoiceId) throw new BadRequestException('invoiceId zorunludur.');
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException();

    const result = await this.submitService.syncInvoiceStatus(tenantId, invoiceId);
    return result;
  }
}

import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRole } from '../../users/entities/user.entity';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { IopoleApiClient } from './services/iopole-api.client';
import { IopoleSyncService } from './services/iopole-sync.service';

@Controller('e-invoicing/iopole')
@UseGuards(JwtAuthGuard)
export class IopoleController {
  private readonly logger = new Logger(IopoleController.name);
  private static readonly MAX_LIMIT = 200;
  private static readonly ALLOWED_EXPANDS = new Set([
    'businessData',
    'lastStatusData',
  ]);

  constructor(
    private readonly apiClient: IopoleApiClient,
    private readonly syncService: IopoleSyncService,
  ) {}

  private assertSyncAccess(req: AuthenticatedRequest): void {
    const role = req.user?.role;
    const isAdminRole =
      role === UserRole.SUPER_ADMIN || role === UserRole.TENANT_ADMIN;

    if (!isAdminRole) {
      throw new ForbiddenException('Iopole sync route yetkisi yok.');
    }

    if (
      process.env.NODE_ENV === 'production' &&
      process.env.IOPOLE_DEBUG_ROUTES_ENABLED !== 'true'
    ) {
      throw new ForbiddenException('Iopole sync route kapalı.');
    }
  }

  private parseOffset(offset?: string): number {
    const normalizedOffset = Number(offset ?? 0);

    if (!Number.isInteger(normalizedOffset) || normalizedOffset < 0) {
      throw new BadRequestException('offset 0 veya daha büyük bir tamsayı olmalıdır.');
    }

    return normalizedOffset;
  }

  private parseLimit(limit?: string): number {
    const normalizedLimit = Number(limit ?? 50);

    if (!Number.isInteger(normalizedLimit) || normalizedLimit <= 0) {
      throw new BadRequestException('limit pozitif bir tamsayı olmalıdır.');
    }

    if (normalizedLimit > IopoleController.MAX_LIMIT) {
      throw new BadRequestException(`limit en fazla ${IopoleController.MAX_LIMIT} olabilir.`);
    }

    return normalizedLimit;
  }

  private parseExpand(expand?: string | string[]): string[] | undefined {
    if (!expand) {
      return undefined;
    }

    const values = Array.isArray(expand) ? expand : [expand];
    const sanitized = values.flatMap((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    );

    for (const entry of sanitized) {
      if (!IopoleController.ALLOWED_EXPANDS.has(entry)) {
        throw new BadRequestException(`Geçersiz expand değeri: ${entry}`);
      }
    }

    return sanitized.length > 0 ? sanitized : undefined;
  }

  private parseSearchQuery(q?: string): string | undefined {
    if (!q) {
      return undefined;
    }

    const trimmed = q.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.length > 500) {
      throw new BadRequestException('q en fazla 500 karakter olabilir.');
    }

    if (/[\r\n\t]/.test(trimmed)) {
      throw new BadRequestException('q kontrol karakterleri içeremez.');
    }

    return trimmed;
  }

  private parseInvoiceId(invoiceId: string): string {
    const trimmed = invoiceId.trim();

    if (!trimmed) {
      throw new BadRequestException('invoiceId zorunludur.');
    }

    if (trimmed.length > 255) {
      throw new BadRequestException('invoiceId çok uzun.');
    }

    return trimmed;
  }

  @Get('directory/french')
  async lookupFrenchDirectory(
    @Req() req: AuthenticatedRequest,
    @Query('siren') siren: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<Record<string, unknown>> {
    if (!siren) {
      throw new BadRequestException('siren zorunludur.');
    }

    const normalizedOffset = this.parseOffset(offset);
    const normalizedLimit = this.parseLimit(limit);

    this.logger.log(
      `Iopole French directory lookup tenant=${req.user.tenantId} siren=${siren}`,
    );

    return this.apiClient.lookupFrenchDirectory({
      q: `siren:"${siren}"`,
      offset: normalizedOffset,
      limit: normalizedLimit,
    });
  }

  @Get('invoices/search')
  async searchInvoices(
    @Req() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('expand') expand?: string | string[],
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<Record<string, unknown>> {
    const normalizedOffset = this.parseOffset(offset);
    const normalizedLimit = this.parseLimit(limit);
    const normalizedExpand = this.parseExpand(expand);
    const normalizedQuery = this.parseSearchQuery(q);

    this.logger.log(
      `Iopole invoice search tenant=${req.user.tenantId} offset=${normalizedOffset} limit=${normalizedLimit}`,
    );

    return this.apiClient.searchInvoices({
      q: normalizedQuery,
      expand: normalizedExpand,
      offset: normalizedOffset,
      limit: normalizedLimit,
    });
  }

  @Get('invoices/not-seen')
  async getNotSeenInvoices(
    @Req() req: AuthenticatedRequest,
  ): Promise<string[]> {
    this.logger.log(`Iopole not-seen invoices tenant=${req.user.tenantId}`);
    return this.apiClient.getNotSeenInvoices();
  }

  @Get('status/not-seen')
  async getNotSeenStatuses(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>[]> {
    this.logger.log(`Iopole not-seen statuses tenant=${req.user.tenantId}`);
    return this.apiClient.getNotSeenStatuses();
  }

  @Get('invoices/:invoiceId/status-history')
  async getInvoiceStatusHistory(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<Record<string, unknown>> {
    const normalizedInvoiceId = this.parseInvoiceId(invoiceId);
    this.logger.log(
      `Iopole invoice status history tenant=${req.user.tenantId} invoiceId=${normalizedInvoiceId}`,
    );
    return this.apiClient.getInvoiceStatusHistory(normalizedInvoiceId);
  }

  @Get('invoices/:invoiceId')
  async getInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<Record<string, unknown>> {
    const normalizedInvoiceId = this.parseInvoiceId(invoiceId);
    this.logger.log(
      `Iopole invoice detail tenant=${req.user.tenantId} invoiceId=${normalizedInvoiceId}`,
    );
    return this.apiClient.getInvoice(normalizedInvoiceId);
  }

  @Get('sync/invoice/:invoiceId')
  async syncInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<unknown> {
    this.assertSyncAccess(req);
    const normalizedInvoiceId = this.parseInvoiceId(invoiceId);
    this.logger.log(
      `Iopole sync invoice tenant=${req.user.tenantId} invoiceId=${normalizedInvoiceId}`,
    );
    return this.syncService.syncInvoiceByExternalId(
      normalizedInvoiceId,
      req.user.tenantId,
    );
  }

  @Get('sync/invoice/:invoiceId/status-history')
  async syncInvoiceHistory(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<unknown> {
    this.assertSyncAccess(req);
    const normalizedInvoiceId = this.parseInvoiceId(invoiceId);
    this.logger.log(
      `Iopole sync history tenant=${req.user.tenantId} invoiceId=${normalizedInvoiceId}`,
    );
    return this.syncService.syncInvoiceStatusHistory(
      normalizedInvoiceId,
      req.user.tenantId,
    );
  }

  @Get('sync/search/inbound')
  async syncInboundSearch(
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    this.assertSyncAccess(req);
    this.logger.log(`Iopole sync inbound search tenant=${req.user.tenantId}`);
    return this.syncService.syncInboundSearchResults(req.user.tenantId);
  }

  @Get('sync/search/outbound')
  async syncOutboundSearch(
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    this.assertSyncAccess(req);
    this.logger.log(`Iopole sync outbound search tenant=${req.user.tenantId}`);
    return this.syncService.syncOutboundSearchResults(req.user.tenantId);
  }
}
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PeriodLockGuard } from '../common/guards/period-lock.guard';
import { InvoicesService } from './invoices.service';
import { InvoiceStatus } from './entities/invoice.entity';
import { Audit } from '../audit/audit.interceptor';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { FacturXService } from './facturx/facturx.service';
import { FacturXProfile } from './facturx/facturx-profile.enum';
import { PennylaneSubmitService } from '../integrations/pennylane/services/pennylane-submit.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import type { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  private readonly logger = new Logger(InvoicesController.name);

  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly facturXService: FacturXService,
    private readonly pennylaneSubmitService: PennylaneSubmitService,
  ) {}

  @Post()
  @UseGuards(PeriodLockGuard)
  @Audit('Invoice', AuditAction.CREATE)
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(req.user.tenantId, createInvoiceDto);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.invoicesService.findAll(req.user.tenantId);
  }

  @Get('statistics')
  getStatistics(@Req() req: AuthenticatedRequest) {
    return this.invoicesService.getStatistics(req.user.tenantId);
  }

  @Get(':id/facturx')
  @ApiQuery({ name: 'profile', enum: FacturXProfile, required: false })
  async downloadFacturX(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('profile') profile: FacturXProfile = FacturXProfile.EN_16931,
    @Res() res: Response,
  ): Promise<void> {
    const { pdf, filename } = await this.facturXService.generate(
      id,
      req.user.tenantId,
      undefined,
      profile,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.length),
    });
    res.end(pdf);
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.invoicesService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @UseGuards(PeriodLockGuard)
  @Audit('Invoice', AuditAction.UPDATE)
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(req.user.tenantId, id, updateInvoiceDto);
  }

  @Patch(':id/status')
  @Audit('Invoice', AuditAction.UPDATE)
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('status') status: InvoiceStatus,
  ) {
    const invoice = await this.invoicesService.updateStatus(req.user.tenantId, id, status);

    // Pennylane ödeme senkronizasyonu — "Ödendi" işaretlenince Pennylane'e bildir (best-effort)
    if (status === InvoiceStatus.PAID && invoice.providerInvoiceId) {
      void this.pennylaneSubmitService
        .syncPayment(req.user.tenantId, id)
        .catch((err: Error) =>
          this.logger.warn(`Pennylane ödeme sync atlandı: ${err.message}`),
        );
    }

    return invoice;
  }

  @Delete(':id')
  @UseGuards(PeriodLockGuard)
  @Audit('Invoice', AuditAction.DELETE)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.invoicesService.remove(req.user.tenantId, id);
  }

  @Patch(':id/void')
  @Audit('Invoice', AuditAction.UPDATE)
  async voidInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const invoice = await this.invoicesService.voidInvoice(
      req.user.tenantId,
      id,
      req.user.id,
      reason,
    );

    // Fatura daha önce Pennylane'e gönderilmişse orada da iptal et (best-effort)
    if (invoice.providerInvoiceId) {
      void this.pennylaneSubmitService
        .cancelInvoice(req.user.tenantId, invoice.providerInvoiceId)
        .catch((err: Error) =>
          this.logger.warn(`Pennylane cancel skipped: ${err.message}`),
        );
    }

    return invoice;
  }

  @Patch(':id/restore')
  @Audit('Invoice', AuditAction.UPDATE)
  restoreInvoice(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.invoicesService.restoreInvoice(req.user.tenantId, id);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PeriodLockGuard } from '../common/guards/period-lock.guard';
import { InvoicesService } from './invoices.service';
import { InvoiceStatus } from './entities/invoice.entity';
import { Audit } from '../audit/audit.interceptor';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import type { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

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
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('status') status: InvoiceStatus,
  ) {
    return this.invoicesService.updateStatus(req.user.tenantId, id, status);
  }

  @Delete(':id')
  @UseGuards(PeriodLockGuard)
  @Audit('Invoice', AuditAction.DELETE)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.invoicesService.remove(req.user.tenantId, id);
  }

  @Patch(':id/void')
  @Audit('Invoice', AuditAction.UPDATE)
  voidInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.invoicesService.voidInvoice(
      req.user.tenantId,
      id,
      req.user.id,
      reason,
    );
  }

  @Patch(':id/restore')
  @Audit('Invoice', AuditAction.UPDATE)
  restoreInvoice(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.invoicesService.restoreInvoice(req.user.tenantId, id);
  }
}

import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvoicesService } from './invoices.service';
import { InvoiceStatus } from './entities/invoice.entity';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  create(@Req() req: any, @Body() createInvoiceDto: any) {
    return this.invoicesService.create(req.user.tenantId, createInvoiceDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.invoicesService.findAll(req.user.tenantId);
  }

  @Get('statistics')
  getStatistics(@Req() req: any) {
    return this.invoicesService.getStatistics(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.invoicesService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() updateInvoiceDto: any) {
    return this.invoicesService.update(req.user.tenantId, id, updateInvoiceDto);
  }

  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: InvoiceStatus) {
    return this.invoicesService.updateStatus(req.user.tenantId, id, status);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.invoicesService.remove(req.user.tenantId, id);
  }
}

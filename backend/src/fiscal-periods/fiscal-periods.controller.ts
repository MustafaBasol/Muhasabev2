import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { FiscalPeriodsService, type CreateFiscalPeriodDto, type LockPeriodDto } from './fiscal-periods.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    tenantId: string;
  };
}

@Controller('fiscal-periods')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FiscalPeriodsController {
  constructor(private readonly fiscalPeriodsService: FiscalPeriodsService) {}

  @Post()
  create(@Body() body: any, @Req() req: AuthenticatedRequest) {
    // Frontend sends startDate/endDate, but service expects periodStart/periodEnd
    const createDto: CreateFiscalPeriodDto = {
      name: body.name,
      periodStart: new Date(body.startDate),
      periodEnd: new Date(body.endDate),
    };
    return this.fiscalPeriodsService.create(createDto, req.user.tenantId);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.fiscalPeriodsService.findAll(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.fiscalPeriodsService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: AuthenticatedRequest) {
    // Frontend sends startDate/endDate, but service expects periodStart/periodEnd
    const updateDto = {
      name: body.name,
      periodStart: new Date(body.startDate),
      periodEnd: new Date(body.endDate),
    };
    return this.fiscalPeriodsService.update(id, updateDto, req.user.tenantId);
  }

  @Patch(':id/lock')
  lockPeriod(@Param('id') id: string, @Body() lockDto: LockPeriodDto, @Req() req: AuthenticatedRequest) {
    return this.fiscalPeriodsService.lockPeriod(id, lockDto, req.user.tenantId, req.user.userId);
  }

  @Patch(':id/unlock')
  unlockPeriod(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.fiscalPeriodsService.unlockPeriod(id, req.user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.fiscalPeriodsService.remove(id, req.user.tenantId);
  }
}
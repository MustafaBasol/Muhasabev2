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
  BadRequestException,
} from '@nestjs/common';
import {
  FiscalPeriodsService,
  type CreateFiscalPeriodDto,
  type LockPeriodDto,
} from './fiscal-periods.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

type FiscalPeriodBody = {
  name: string;
  startDate: string | number | Date;
  endDate: string | number | Date;
};

@Controller('fiscal-periods')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FiscalPeriodsController {
  constructor(private readonly fiscalPeriodsService: FiscalPeriodsService) {}

  @Post()
  create(@Body() body: FiscalPeriodBody, @Req() req: AuthenticatedRequest) {
    const createDto = this.mapToFiscalPeriodDto(body);
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
  update(
    @Param('id') id: string,
    @Body() body: FiscalPeriodBody,
    @Req() req: AuthenticatedRequest,
  ) {
    const updateDto = this.mapToFiscalPeriodDto(body);
    return this.fiscalPeriodsService.update(id, updateDto, req.user.tenantId);
  }

  @Patch(':id/lock')
  lockPeriod(
    @Param('id') id: string,
    @Body() lockDto: LockPeriodDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.fiscalPeriodsService.lockPeriod(
      id,
      lockDto,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/unlock')
  unlockPeriod(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.fiscalPeriodsService.unlockPeriod(id, req.user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.fiscalPeriodsService.remove(id, req.user.tenantId);
  }

  private mapToFiscalPeriodDto(body: FiscalPeriodBody): CreateFiscalPeriodDto {
    if (!body?.name) {
      throw new BadRequestException('name is required');
    }
    return {
      name: body.name,
      periodStart: this.parseDate(body.startDate, 'startDate'),
      periodEnd: this.parseDate(body.endDate, 'endDate'),
    };
  }

  private parseDate(value: string | number | Date, field: string): Date {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return date;
  }
}

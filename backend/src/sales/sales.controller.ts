import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';
import type { CurrentUser } from '../common/decorators/user.decorator';
import { Audit } from '../audit/audit.interceptor';
import { AuditAction } from '../audit/entities/audit-log.entity';

@ApiTags('sales')
@Controller('sales')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @ApiOperation({ summary: 'Create sale' })
  @Audit('Sale', AuditAction.CREATE)
  async create(@Body() dto: CreateSaleDto, @User() user: CurrentUser) {
    return this.salesService.create(user.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sales for tenant' })
  async findAll(@User() user: CurrentUser) {
    return this.salesService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale by id' })
  async findOne(@Param('id') id: string, @User() user: CurrentUser) {
    return this.salesService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update sale' })
  @Audit('Sale', AuditAction.UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
    @User() user: CurrentUser,
  ) {
    return this.salesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete sale' })
  @Audit('Sale', AuditAction.DELETE)
  async remove(@Param('id') id: string, @User() user: CurrentUser) {
    return this.salesService.remove(user.tenantId, id);
  }

  @Delete('purge/all')
  @ApiOperation({ summary: 'Delete ALL sales for current tenant (dev only)' })
  async purgeAll(@User() user: CurrentUser) {
    if (process.env.NODE_ENV === 'production') {
      // Ek güvenlik: production ortamında kapalı
      throw new Error('Not allowed in production');
    }
    return this.salesService.purgeTenant(user.tenantId);
  }
}

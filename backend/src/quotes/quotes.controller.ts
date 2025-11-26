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
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';
import type { CurrentUser } from '../common/decorators/user.decorator';
import { Audit } from '../audit/audit.interceptor';
import { AuditAction } from '../audit/entities/audit-log.entity';

@ApiTags('quotes')
@Controller()
export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  // Authenticated endpoints
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('quotes')
  @ApiOperation({ summary: 'Create quote' })
  @Audit('Quote', AuditAction.CREATE)
  async create(@Body() dto: CreateQuoteDto, @User() user: CurrentUser) {
    return this.service.create(user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('quotes')
  @ApiOperation({ summary: 'List quotes (tenant scoped)' })
  async findAll(@User() user: CurrentUser) {
    return this.service.findAll(user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('quotes/:id')
  @ApiOperation({ summary: 'Get quote by id (tenant scoped)' })
  async findOne(@Param('id') id: string, @User() user: CurrentUser) {
    return this.service.findOne(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('quotes/:id')
  @ApiOperation({ summary: 'Update quote' })
  @Audit('Quote', AuditAction.UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
    @User() user: CurrentUser,
  ) {
    return this.service.update(user.tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('quotes/:id')
  @ApiOperation({ summary: 'Delete quote' })
  @Audit('Quote', AuditAction.DELETE)
  async remove(@Param('id') id: string, @User() user: CurrentUser) {
    return this.service.remove(user.tenantId, id);
  }

  // Public endpoints (via publicId)
  @Get('public/quotes/:publicId')
  @ApiOperation({ summary: 'Public: Get quote by publicId' })
  async getPublic(@Param('publicId') publicId: string) {
    return this.service.findByPublicId(publicId);
  }

  @Post('public/quotes/:publicId/viewed')
  @ApiOperation({ summary: 'Public: mark viewed if draft/sent' })
  async viewed(@Param('publicId') publicId: string) {
    return this.service.markViewed(publicId);
  }

  @Post('public/quotes/:publicId/accept')
  @ApiOperation({ summary: 'Public: accept quote' })
  async accept(@Param('publicId') publicId: string) {
    return this.service.accept(publicId);
  }

  @Post('public/quotes/:publicId/decline')
  @ApiOperation({ summary: 'Public: decline quote' })
  async decline(@Param('publicId') publicId: string) {
    return this.service.decline(publicId);
  }
}

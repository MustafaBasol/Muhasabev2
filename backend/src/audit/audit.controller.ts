import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService, AuditLogFilter } from './audit.service';
import { AuditAction } from './entities/audit-log.entity';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('test')
  test() {
    return { message: 'Audit controller is working!' };
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard)
  async getAuditLogs(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const user = req.user;
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Parse query parameters
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    // Validate limit
    if (limitNum > 100) {
      throw new BadRequestException('Limit cannot exceed 100');
    }

    // Parse dates
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        throw new BadRequestException('Invalid start date format');
      }
    }

    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        throw new BadRequestException('Invalid end date format');
      }
    }

    // Validate action enum
    let parsedAction: AuditAction | undefined;
    if (action) {
      if (!Object.values(AuditAction).includes(action as AuditAction)) {
        throw new BadRequestException('Invalid action type');
      }
      parsedAction = action as AuditAction;
    }

    const filter: AuditLogFilter = {
      tenantId,
      userId,
      entity,
      action: parsedAction,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      page: pageNum,
      limit: limitNum,
    };

    return await this.auditService.findAll(filter);
  }

  @Get('entities')
  @UseGuards(JwtAuthGuard)
  async getAuditableEntities(@Request() req: AuthenticatedRequest) {
    const user = req.user;
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Get unique entities from audit logs
    const result = await this.auditService.findAll({
      tenantId,
      limit: 1000, // Get a large sample to find all entities
    });

    const entities = [...new Set(result.data.map((log) => log.entity))];

    return {
      entities: entities.sort(),
    };
  }

  @Get('entity/:entity/:entityId')
  @UseGuards(JwtAuthGuard)
  async getEntityAuditHistory(
    @Request() req: AuthenticatedRequest,
    @Query('entity') entity: string,
    @Query('entityId') entityId: string,
  ) {
    const user = req.user;
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    if (!entity || !entityId) {
      throw new BadRequestException('Entity and entityId are required');
    }

    return await this.auditService.findByEntity(tenantId, entity, entityId);
  }
}

import { 
  Controller, 
  Get, 
  Patch,
  Body,
  Param,
  UseGuards,
  Request
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import type { UpdateTenantDto } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('my-tenant')
  @ApiOperation({ summary: 'Get current user\'s tenant' })
  async getMyTenant(@User() user: any) {
    return this.tenantsService.findOne(user.tenantId);
  }

  @Patch('my-tenant')
  @ApiOperation({ summary: 'Update current user\'s tenant' })
  async updateMyTenant(
    @Body() updateTenantDto: UpdateTenantDto,
    @User() user: any,
  ) {
    return this.tenantsService.update(user.tenantId, updateTenantDto);
  }
}

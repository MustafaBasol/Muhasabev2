import { Controller, Get, Post, Body, Param, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private checkAdminAuth(headers: any) {
    const adminToken = headers['admin-token'];
    if (adminToken !== 'admin-access-granted') {
      throw new UnauthorizedException('Admin access required');
    }
  }

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Admin logged in successfully' })
  async adminLogin(@Body() loginDto: { username: string; password: string }) {
    return this.adminService.adminLogin(loginDto.username, loginDto.password);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of all users' })
  async getAllUsers(@Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.adminService.getAllUsers();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Get all tenants' })
  @ApiResponse({ status: 200, description: 'List of all tenants' })
  async getAllTenants(@Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.adminService.getAllTenants();
  }

  @Get('user/:userId/data')
  @ApiOperation({ summary: 'Get all data for a specific user' })
  @ApiResponse({ status: 200, description: 'User data' })
  async getUserData(@Param('userId') userId: string, @Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.adminService.getUserData(userId);
  }

  @Get('tenant/:tenantId/data')
  @ApiOperation({ summary: 'Get all data for a specific tenant' })
  @ApiResponse({ status: 200, description: 'Tenant data' })
  async getTenantData(@Param('tenantId') tenantId: string, @Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.adminService.getTenantData(tenantId);
  }

  @Get('tables')
  @ApiOperation({ summary: 'Get all table information' })
  @ApiResponse({ status: 200, description: 'Database table information' })
  async getAllTables(@Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.adminService.getAllTables();
  }

  @Get('table/:tableName')
  @ApiOperation({ summary: 'Get data from specific table' })
  @ApiResponse({ status: 200, description: 'Table data' })
  async getTableData(
    @Param('tableName') tableName: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Headers() headers?: any,
  ) {
    this.checkAdminAuth(headers);
    return this.adminService.getTableData(tableName, tenantId, limit, offset);
  }
}
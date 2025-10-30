import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';
import { Audit } from '../audit/audit.interceptor';
import { AuditAction } from '../audit/entities/audit-log.entity';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'Create supplier' })
  @Audit('Supplier', AuditAction.CREATE)
  async create(
    @Body() createSupplierDto: CreateSupplierDto,
    @User() user: any,
  ) {
    return this.suppliersService.create(createSupplierDto, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all suppliers for tenant' })
  async findAll(@User() user: any) {
    return this.suppliersService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier by id' })
  async findOne(@Param('id') id: string, @User() user: any) {
    return this.suppliersService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update supplier' })
  @Audit('Supplier', AuditAction.UPDATE)
  async update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @User() user: any,
  ) {
    return this.suppliersService.update(id, updateSupplierDto, user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete supplier' })
  @Audit('Supplier', AuditAction.DELETE)
  async remove(@Param('id') id: string, @User() user: any) {
    return this.suppliersService.remove(id, user.tenantId);
  }
}

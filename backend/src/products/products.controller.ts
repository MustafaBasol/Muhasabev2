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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';
import { Audit } from '../audit/audit.interceptor';
import { AuditAction } from '../audit/entities/audit-log.entity';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create product' })
  @Audit('Product', AuditAction.CREATE)
  async create(
    @Body() createProductDto: CreateProductDto,
    @User() user: any,
  ) {
    return this.productsService.create(createProductDto, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products for tenant' })
  async findAll(@User() user: any) {
    return this.productsService.findAll(user.tenantId);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get products with low stock' })
  async findLowStock(@User() user: any) {
    return this.productsService.findLowStock(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by id' })
  async findOne(@Param('id') id: string, @User() user: any) {
    return this.productsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product' })
  @Audit('Product', AuditAction.UPDATE)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @User() user: any,
  ) {
    return this.productsService.update(id, updateProductDto, user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete product' })
  @Audit('Product', AuditAction.DELETE)
  async remove(@Param('id') id: string, @User() user: any) {
    return this.productsService.remove(id, user.tenantId);
  }
}

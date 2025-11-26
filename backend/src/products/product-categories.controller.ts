import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ProductCategoriesService } from './product-categories.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryExtraDto } from './dto/update-product-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

@Controller('product-categories')
@UseGuards(JwtAuthGuard)
export class ProductCategoriesController {
  constructor(private readonly categoriesService: ProductCategoriesService) {}

  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const include = String(includeInactive).toLowerCase() === 'true';
    return this.categoriesService.findAll(req.user.tenantId, include);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.categoriesService.findOne(id, req.user.tenantId);
  }

  @Post()
  create(
    @Body() createCategoryDto: CreateProductCategoryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.categoriesService.create(createCategoryDto, req.user.tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateProductCategoryExtraDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.categoriesService.update(
      id,
      updateCategoryDto,
      req.user.tenantId,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.categoriesService.remove(id, req.user.tenantId);
  }
}

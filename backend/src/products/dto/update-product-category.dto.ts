import { PartialType } from '@nestjs/mapped-types';
import { CreateProductCategoryDto } from './create-product-category.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateProductCategoryDto extends PartialType(
  CreateProductCategoryDto,
) {}

// Ek alanlar (Create DTO'da yok): isActive güncellemesine izin ver
export class UpdateProductCategoryExtraDto extends UpdateProductCategoryDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

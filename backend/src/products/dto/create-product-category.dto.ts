import { IsString, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class CreateProductCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate: number; // KDV oranı (0-100 arası)
}

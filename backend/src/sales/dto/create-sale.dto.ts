import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ required: false, description: 'KDV oranı (%) örn: 18' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

export class CreateSaleDto {
  @ApiProperty({
    required: false,
    description:
      'Satış numarası (örn: SAL-2025-11-001). Gönderilmezse sunucu üretir.',
  })
  @IsOptional()
  @IsString()
  saleNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({
    required: false,
    description: 'Müşteri adı (ID yoksa otomatik oluşturma için)',
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({
    required: false,
    description: 'Müşteri e-posta (otomatik oluşturma için opsiyonel)',
  })
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiProperty({ description: 'Satış tarihi (YYYY-MM-DD)' })
  @IsDateString()
  saleDate: string;

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceQuoteId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;
}

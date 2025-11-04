import { PartialType } from '@nestjs/swagger';
import { CreateSaleDto } from './create-sale.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSaleDto extends PartialType(CreateSaleDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string; // Serbest string; entity enum üzerinden sınırlı değerler kullanılacak
}

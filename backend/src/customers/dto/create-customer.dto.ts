import { IsString, IsEmail, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CustomerType } from '../entities/customer.entity';

// Yapılandırılmış adres tipi
interface StructuredAddress {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string; // ISO 3166-1 alpha-2
  state?: string;
}

export class CreateCustomerDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiProperty({ required: false, description: 'SIRET (FR, 14 haneli)' })
  @IsOptional()
  @IsString()
  siretNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  company?: string;

  // ─── Phase 1: E-Fatura Compliance Alanları ─────────────────────────────

  @ApiProperty({ required: false, enum: CustomerType, description: 'Müşteri tipi: b2b|b2c|individual' })
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @ApiProperty({ required: false, description: 'TVA/KDV Numarası (FR: FR + 11 hane)' })
  @IsOptional()
  @IsString()
  tvaNumber?: string;

  @ApiProperty({ required: false, description: 'SIREN Numarası (9 haneli)' })
  @IsOptional()
  @IsString()
  sirenNumber?: string;

  @ApiProperty({ required: false, description: 'Yapılandırılmış fatura adresi' })
  @IsOptional()
  @IsObject()
  billingAddress?: StructuredAddress;

  @ApiProperty({ required: false, description: 'Teslimat adresi (fatura adresinden farklıysa)' })
  @IsOptional()
  @IsObject()
  deliveryAddress?: StructuredAddress;

  @ApiProperty({ required: false, description: 'Ödeme koşulları, örn: 30 gün net' })
  @IsOptional()
  @IsString()
  defaultPaymentTerms?: string;

  @ApiProperty({ required: false, description: 'External provider customer ID (Pennylane vb.)' })
  @IsOptional()
  @IsString()
  providerCustomerId?: string;
}

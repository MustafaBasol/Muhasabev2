import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { QuoteStatus } from '../entities/quote.entity';

export class CreateQuoteDto {
  @ApiPropertyOptional({
    description: 'Quote number, if omitted server will generate',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  quoteNumber?: string;

  @ApiPropertyOptional({ description: 'Customer ID (UUID)' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ description: 'Issue date (YYYY-MM-DD)' })
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional({ description: 'Valid until (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({ description: 'Currency (TRY|USD|EUR|GBP)', example: 'TRY' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ description: 'Total amount' })
  @IsNumber()
  total!: number;

  @ApiPropertyOptional({ description: 'Initial status', enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @ApiPropertyOptional({ description: 'Line items', isArray: true })
  @IsOptional()
  @IsArray()
  items?: any[];

  @ApiPropertyOptional({ description: 'Scope of work (sanitized HTML)' })
  @IsOptional()
  @IsString()
  scopeOfWorkHtml?: string;

  @ApiPropertyOptional({ description: 'Customer name (denormalized)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;
}

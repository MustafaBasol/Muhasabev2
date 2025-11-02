import { IsString, IsOptional, Length, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBankAccountDto {
  @ApiProperty({ example: 'İş Bankası TL Hesabı' })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({ example: 'TR000000000000000000000000' })
  @IsString()
  @Length(16, 34)
  iban: string;

  @ApiProperty({ required: false, example: 'Türkiye İş Bankası' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  bankName?: string;

  @ApiProperty({ required: false, example: 'TRY' })
  @IsOptional()
  @IsString()
  @IsIn(['TRY', 'USD', 'EUR', 'GBP'])
  currency?: string = 'TRY';
}

import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  NoSqlInjection,
  NoXss,
  StrongPassword,
} from '../../common/validators/security.validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Valid email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @NoSqlInjection({ message: 'Email contains invalid characters' })
  @Length(1, 254, { message: 'Email must be between 1 and 254 characters' })
  email: string;

  @ApiProperty({
    description: 'Password (minimum 6 characters)',
    example: 'Password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  @NoXss({ message: 'First name contains invalid characters' })
  @NoSqlInjection({ message: 'First name contains invalid characters' })
  @Length(1, 50, { message: 'First name must be between 1 and 50 characters' })
  @Matches(/^[a-zA-ZğüşöçıĞÜŞÖÇİ\s]+$/, {
    message: 'First name can only contain letters and spaces',
  })
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  @NoXss({ message: 'Last name contains invalid characters' })
  @NoSqlInjection({ message: 'Last name contains invalid characters' })
  @Length(1, 50, { message: 'Last name must be between 1 and 50 characters' })
  @Matches(/^[a-zA-ZğüşöçıĞÜŞÖÇİ\s]+$/, {
    message: 'Last name can only contain letters and spaces',
  })
  lastName: string;

  @ApiProperty({
    required: false,
    description: 'Company name (optional)',
    example: 'ACME Corp',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @NoXss({ message: 'Company name contains invalid characters' })
  @NoSqlInjection({ message: 'Company name contains invalid characters' })
  @Length(1, 100, {
    message: 'Company name must be between 1 and 100 characters',
  })
  companyName?: string;
}

import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NoSqlInjection } from '../../common/validators/security.validator';

export class LoginDto {
  @ApiProperty({
    description: 'Valid email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @NoSqlInjection({ message: 'Email contains invalid characters' })
  @Length(1, 254, { message: 'Email must be between 1 and 254 characters' })
  email: string;

  @ApiProperty({
    description: 'Password',
    example: 'your_password',
  })
  @IsString()
  @Length(1, 128, { message: 'Password must be between 1 and 128 characters' })
  password: string;

  @ApiProperty({
    description:
      'Two-factor token (6-digit TOTP or 8-char backup code). Optional; required if 2FA is enabled.',
    required: false,
    example: '123456',
  })
  @IsOptional()
  @IsString()
  twoFactorToken?: string;

  @ApiProperty({
    description:
      'IANA time zone identifier reported by client (e.g., Europe/Istanbul). Optional.',
    required: false,
    example: 'Europe/Istanbul',
  })
  @IsOptional()
  @IsString()
  clientTimeZone?: string;

  @ApiProperty({
    description:
      'Client UTC offset minutes relative to UTC (e.g., +180 for GMT+3). Optional.',
    required: false,
    example: 180,
  })
  @IsOptional()
  @IsInt()
  @Min(-14 * 60)
  @Max(14 * 60)
  clientUtcOffsetMinutes?: number;

  @ApiProperty({
    description: 'Client locale reported by browser (e.g., tr-TR). Optional.',
    required: false,
    example: 'tr-TR',
  })
  @IsOptional()
  @IsString()
  clientLocale?: string;

  @ApiProperty({
    description:
      'Cloudflare Turnstile token. Required after captcha threshold reached for this email+IP.',
    required: false,
  })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

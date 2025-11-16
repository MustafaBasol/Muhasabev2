import { IsEmail, IsOptional, IsString, Length } from 'class-validator';
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
    description: 'Two-factor token (6-digit TOTP or 8-char backup code). Optional; required if 2FA is enabled.',
    required: false,
    example: '123456',
  })
  @IsOptional()
  @IsString()
  twoFactorToken?: string;
}

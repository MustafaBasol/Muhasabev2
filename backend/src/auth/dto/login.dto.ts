import { IsEmail, IsString, Length } from 'class-validator';
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
}

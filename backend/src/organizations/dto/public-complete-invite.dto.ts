import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class PublicCompleteInviteDto {
  @ApiProperty({ description: 'Password for the invited account', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ description: 'Cloudflare Turnstile token proving the request is human', required: false })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

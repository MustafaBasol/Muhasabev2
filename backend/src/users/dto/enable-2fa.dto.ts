import { IsString, IsNotEmpty, Length } from 'class-validator';

export class Enable2FADto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'TOTP token must be exactly 6 digits' })
  token: string;
}

export class Verify2FADto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 8, { message: 'Token must be 6 digits (TOTP) or 8 characters (backup code)' })
  token: string;
}

export class Disable2FADto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 8, { message: 'Token must be 6 digits (TOTP) or 8 characters (backup code)' })
  token: string;
}
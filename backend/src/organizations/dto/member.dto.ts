import { IsString, IsEmail, IsEnum } from 'class-validator';
import { Role } from '../../common/enums/organization.enum';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsEnum(Role)
  role: Role;
}

export class UpdateMemberRoleDto {
  @IsEnum(Role)
  role: Role;
}

export class AcceptInviteDto {
  @IsString()
  token: string;
}

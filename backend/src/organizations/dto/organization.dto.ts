import { IsString, IsEnum, IsOptional } from 'class-validator';
import { Plan } from '../../common/enums/organization.enum';

export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;
}

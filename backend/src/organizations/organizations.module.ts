import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { Organization } from './entities/organization.entity';
import { OrganizationMember } from './entities/organization-member.entity';
import { Invite } from './entities/invite.entity';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../services/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationMember,
      Invite,
      User,
    ]),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, EmailService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
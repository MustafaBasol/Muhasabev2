import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SecurityService } from '../common/security.service';
import { TwoFactorService } from '../common/two-factor.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Tenant])],
  controllers: [UsersController],
  providers: [UsersService, SecurityService, TwoFactorService],
  exports: [UsersService],
})
export class UsersModule {}

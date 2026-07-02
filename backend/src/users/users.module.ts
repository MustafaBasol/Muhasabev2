import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SecurityService } from '../common/security.service';
import { TwoFactorService } from '../common/two-factor.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant]),
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret || jwtSecret === 'default-secret') {
          throw new Error(
            'JWT_SECRET environment variable must be set with a secure key',
          );
        }
        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '15m' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, SecurityService, TwoFactorService],
  exports: [UsersService],
})
export class UsersModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { EmailModule } from '../email/email.module';
import { SecurityService } from '../common/security.service';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PassportModule,
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
          signOptions: {
            expiresIn: '15m', // 15 dakika - daha güvenli
          },
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    TenantsModule,
    TypeOrmModule.forFeature([EmailVerificationToken, PasswordResetToken]),
    AuditModule,
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SecurityService],
  exports: [AuthService],
})
export class AuthModule {}

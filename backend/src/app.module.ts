import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { TenantsModule } from './tenants/tenants.module';
import { CustomersModule } from './customers/customers.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { FiscalPeriodsModule } from './fiscal-periods/fiscal-periods.module';
import { CommonModule } from './common/common.module';
import { SubprocessorsModule } from './subprocessors/subprocessors.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { AuditInterceptor } from './audit/audit.interceptor';
import { SeedService } from './database/seed.service';
import { RateLimitMiddleware } from './common/rate-limit.middleware';
import { CSRFMiddleware } from './common/csrf.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 dakika
        limit: 100, // Normal API endpoints için (middleware auth endpoints'i override eder)
      },
    ]),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const isProd = process.env.NODE_ENV === 'production';
        const isTest =
          process.env.NODE_ENV === 'test' ||
          typeof process.env.JEST_WORKER_ID !== 'undefined';

        // Use in-memory SQLite for tests to avoid external DB dependency
        if (isTest) {
          return {
            type: 'better-sqlite3',
            database: ':memory:',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            dropSchema: true,
            logging: false,
          } as const;
        }

        const host = process.env.DATABASE_HOST || (isProd ? '' : 'localhost');
        const port = parseInt(
          process.env.DATABASE_PORT || (isProd ? '0' : '5432'),
        );
        const username =
          process.env.DATABASE_USER || (isProd ? '' : 'postgres');
        const password =
          process.env.DATABASE_PASSWORD || (isProd ? '' : 'password123');
        const database =
          process.env.DATABASE_NAME || (isProd ? '' : 'postgres');

        if (isProd && (!host || !port || !username || !password || !database)) {
          throw new Error(
            'Database environment variables are required in production',
          );
        }

        return {
          type: 'postgres',
          host,
          port: port || 5432,
          username,
          password,
          database,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          synchronize: false,
          logging: process.env.NODE_ENV === 'development',
          ssl: isProd ? { rejectUnauthorized: false } : false,
        } as const;
      },
    }),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TenantsModule,
    CustomersModule,
    SuppliersModule,
    ProductsModule,
    InvoicesModule,
    ExpensesModule,
    BankAccountsModule,
    AdminModule,
    AuditModule,
    FiscalPeriodsModule,
    CommonModule,
    SubprocessorsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SeedService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('*'); // Tüm route'lara rate limiting uygula

    consumer.apply(CSRFMiddleware).forRoutes('*'); // Tüm route'lara CSRF koruması uygula
  }
}

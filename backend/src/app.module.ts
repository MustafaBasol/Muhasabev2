import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ApiRouteGuardMiddleware } from './common/api-route-guard.middleware';
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import * as path from 'path';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { HealthController } from './health/health.controller';
import { WebhooksModule } from './webhooks/webhooks.module';
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
import { SalesModule } from './sales/sales.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { FiscalPeriodsModule } from './fiscal-periods/fiscal-periods.module';
import { CommonModule } from './common/common.module';
import { QuotesModule } from './quotes/quotes.module';
import { BillingModule } from './billing/billing.module';
import { SubprocessorsModule } from './subprocessors/subprocessors.module';
import { EmailModule } from './email/email.module';
import { SiteSettingsModule } from './site-settings/site-settings.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { MaintenanceInterceptor } from './common/interceptors/maintenance.interceptor';
import { AuditInterceptor } from './audit/audit.interceptor';
import { SeedService } from './database/seed.service';
import { RateLimitMiddleware } from './common/rate-limit.middleware';
import { CSRFMiddleware } from './common/csrf.middleware';
import { EnsureAttributionColumnsService } from './audit/ensure-attribution-columns.service';
import './database/patch-typeorm-for-tests';

const coercePort = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
type PgUrlParts = {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
};

const parseDatabaseUrl = (value?: string): PgUrlParts | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    const database = parsed.pathname.replace(/^\//, '') || undefined;
    return {
      host: parsed.hostname || undefined,
      port: parsed.port ? Number(parsed.port) : undefined,
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : undefined,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      database,
    };
  } catch (error) {
    console.warn(
      '⚠️  Invalid database URL provided, falling back to discrete env vars.',
      error,
    );
    return null;
  }
};

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public', 'dist'), // FIX: Artık exclude kuralı yok, middleware bu işi halledecek.
    }),
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
        const entities = [__dirname + '/**/*.entity{.ts,.js}'];
        const migrations = [__dirname + '/migrations/*{.ts,.js}'];

        if (isTest) {
          const urlParts =
            parseDatabaseUrl(process.env.TEST_DATABASE_URL) ||
            parseDatabaseUrl(process.env.DATABASE_URL);
          const host =
            process.env.TEST_DATABASE_HOST ||
            urlParts?.host ||
            process.env.DATABASE_HOST ||
            '127.0.0.1';
          const port =
            urlParts?.port ??
            coercePort(
              process.env.TEST_DATABASE_PORT || process.env.DATABASE_PORT,
              5432,
            );
          const username =
            process.env.TEST_DATABASE_USER ||
            urlParts?.username ||
            process.env.DATABASE_USER ||
            'moneyflow';
          const password =
            process.env.TEST_DATABASE_PASSWORD ||
            urlParts?.password ||
            process.env.DATABASE_PASSWORD ||
            'moneyflow123';
          const database =
            process.env.TEST_DATABASE_NAME ||
            urlParts?.database ||
            process.env.DATABASE_NAME ||
            'app_test';
          const sslEnabled = process.env.TEST_DATABASE_SSL === 'true';

          return {
            type: 'postgres',
            host,
            port,
            username,
            password,
            database,
            entities,
            migrations,
            autoLoadEntities: true,
            synchronize: false,
            dropSchema: false,
            ssl: sslEnabled ? { rejectUnauthorized: false } : false,
            logging: process.env.TEST_DB_LOGGING === 'true',
          } as const;
        }

        const urlParts = parseDatabaseUrl(process.env.DATABASE_URL);
        const useSqlite =
          process.env.DB_SQLITE === 'true' ||
          process.env.DATABASE_TYPE === 'sqlite' ||
          (!urlParts?.host && !process.env.DATABASE_HOST);

        if (!isProd && useSqlite) {
          console.warn(
            '⚠️ Using SQLite dev.db because DATABASE_HOST/URL is not set. For consistent data, set Postgres env (DATABASE_HOST, PORT, USER, PASSWORD, NAME).',
          );
          const sqlitePath = path.join(__dirname, '..', 'dev.db');
          return {
            type: 'sqlite',
            database: sqlitePath,
            entities,
            synchronize: true,
            logging: process.env.NODE_ENV === 'development',
            autoLoadEntities: true,
          } as const;
        }

        const host =
          urlParts?.host ||
          process.env.DATABASE_HOST ||
          (isProd ? undefined : 'localhost');
        const port =
          urlParts?.port ??
          coercePort(process.env.DATABASE_PORT, isProd ? 0 : 5432);
        const username =
          urlParts?.username ||
          process.env.DATABASE_USER ||
          (isProd ? undefined : 'postgres');
        const password =
          urlParts?.password ||
          process.env.DATABASE_PASSWORD ||
          (isProd ? undefined : 'password123');
        const database =
          urlParts?.database ||
          process.env.DATABASE_NAME ||
          (isProd ? undefined : 'postgres');
        if (!host || !port || !username || !password || !database) {
          throw new Error(
            'Database environment variables are required for Postgres connections',
          );
        }

        return {
          type: 'postgres',
          host,
          port,
          username,
          password,
          database,
          entities, // migrations,
          synchronize: true,
          dropSchema: false,
          logging: process.env.NODE_ENV === 'development',
          ssl: false,
          autoLoadEntities: true,
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
    QuotesModule,
    SalesModule,
    BankAccountsModule,
    AdminModule,
    AuditModule,
    FiscalPeriodsModule,
    CommonModule,
    SubprocessorsModule,
    EmailModule,
    SiteSettingsModule,
    WebhooksModule,
    BillingModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    SeedService,
    EnsureAttributionColumnsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MaintenanceInterceptor,
    },
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
  // FIX: ApiRouteGuardMiddleware'i tüm yollara uygulayıp içeride filtreleme yapıyoruz.
  // Bu, path-to-regexp hatasından kaçınmanın en güvenli yoludur.
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiRouteGuardMiddleware).forRoutes('*');

    consumer.apply(RateLimitMiddleware).forRoutes('*'); // Tüm route'lara rate limiting uygula

    consumer.apply(CSRFMiddleware).forRoutes('*'); // Tüm route'lara CSRF koruması uygula
  }
}

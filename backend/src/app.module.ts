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
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { AuditInterceptor } from './audit/audit.interceptor';
import { SeedService } from './database/seed.service';
import { RateLimitMiddleware } from './common/rate-limit.middleware';
import { CSRFMiddleware } from './common/csrf.middleware';
import { EnsureAttributionColumnsService } from './audit/ensure-attribution-columns.service';

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
        const useSqlite =
          process.env.DB_SQLITE === 'true' ||
          process.env.DATABASE_TYPE === 'sqlite' ||
          // Yerel geliştirmede Postgres ayarı yoksa otomatik SQLite'a düş
          (!process.env.DATABASE_HOST && !process.env.DATABASE_URL);

        // Use in-memory SQLite for tests to avoid external DB dependency
        // Test ortamı: her zaman memory SQLite kullan (hızlı ve bağımsız)
        if (isTest) {
          // Test ortamında sqlite kullan (sqlite3 sürücüsü) - timestamp uyumsuzluklarını azaltır
          return {
            type: 'sqlite',
            database: ':memory:',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            dropSchema: true,
            logging: false,
            autoLoadEntities: true,
          } as const;
        }

        // Geliştirme ortamı: varsayılan olarak yerel SQLite dosyası kullan.
        // Postgres'e bağlanmak isterseniz .env'de DATABASE_HOST vb. değerleri verin veya DB_SQLITE=false yapın.
        if (!isProd && useSqlite) {
          // Geliştirmede Postgres env'i eksikse SQLite'a düşüldüğünü belirgin şekilde logla
          // Bu, farklı ortamlarda "kullanıcılar kayboldu" algısının tipik sebebidir.
          console.warn('⚠️ Using SQLite dev.db because DATABASE_HOST/URL is not set. For consistent data, set Postgres env (DATABASE_HOST, PORT, USER, PASSWORD, NAME).');
          const sqlitePath = path.join(__dirname, '..', 'dev.db');
          return {
            type: 'sqlite',
            database: sqlitePath,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            logging: process.env.NODE_ENV === 'development',
            autoLoadEntities: true,
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

        // Prod veya bilinçli Postgres konfigürasyonu: Postgres'e bağlan
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

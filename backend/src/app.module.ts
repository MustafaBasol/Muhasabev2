import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { CustomersModule } from './customers/customers.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { FiscalPeriodsModule } from './fiscal-periods/fiscal-periods.module';
import { CommonModule } from './common/common.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { AuditInterceptor } from './audit/audit.interceptor';
import { SeedService } from './database/seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 dakika
      limit: 100, // 60 saniyede maksimum 100 istek
    }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'moneyflow',
      password: process.env.DATABASE_PASSWORD || 'moneyflow123',
      database: process.env.DATABASE_NAME || 'moneyflow_dev',
      autoLoadEntities: true,
      synchronize: false, // IMPORTANT: Never drop tables - keeps your data safe
      logging: false, // Reduce console noise in production
    }),
    AuthModule,
    UsersModule,
    TenantsModule,
    CustomersModule,
    SuppliersModule,
    ProductsModule,
    InvoicesModule,
    ExpensesModule,
    AdminModule,
    AuditModule,
    FiscalPeriodsModule,
    CommonModule,
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
export class AppModule {}

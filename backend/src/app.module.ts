import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'moneyflow',
      password: process.env.DATABASE_PASSWORD || 'moneyflow123',
      database: process.env.DATABASE_NAME || 'moneyflow_dev',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    UsersModule,
    TenantsModule,
    CustomersModule,
    SuppliersModule,
    ProductsModule,
    InvoicesModule,
    ExpensesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

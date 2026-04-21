import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import { IntegrationsCommonModule } from '../integrations/common/integrations-common.module';
import { EINVOICE_QUEUE } from '../integrations/common/queues/einvoice-queue.constants';
import { FacturXModule } from './facturx/facturx.module';
import { PennylaneModule } from '../integrations/pennylane/pennylane.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLine, Tenant, Sale, Customer, Product, ProductCategory]),
    BullModule.registerQueue({ name: EINVOICE_QUEUE }),
    IntegrationsCommonModule,
    FacturXModule,
    PennylaneModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}

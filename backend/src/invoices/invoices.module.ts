import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { Invoice } from './entities/invoice.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice]), CommonModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}

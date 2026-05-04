import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderAccount } from './entities/provider-account.entity';
import { IntegrationLog } from './entities/integration-log.entity';
import { OutboundJob } from './entities/outbound-job.entity';
import { EInvoiceEvent } from './entities/einvoice-event.entity';
import { EInvoiceExternalInvoice } from './entities/einvoice-external-invoice.entity';
import { ProviderAccountService } from './services/provider-account.service';
import { IntegrationLogService } from './services/integration-log.service';
import { EncryptionService } from '../../common/crypto/encryption.service';

/**
 * Provider-agnostic entegrasyon altyapısı.
 * Tüm provider modülleri (pennylane, chorus_pro vb.) bu modülü import eder.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProviderAccount,
      IntegrationLog,
      OutboundJob,
      EInvoiceEvent,
      EInvoiceExternalInvoice,
    ]),
  ],
  providers: [EncryptionService, ProviderAccountService, IntegrationLogService],
  exports: [EncryptionService, ProviderAccountService, IntegrationLogService, TypeOrmModule],
})
export class IntegrationsCommonModule {}

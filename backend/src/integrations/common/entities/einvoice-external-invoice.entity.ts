import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EInvoicingProvider } from '../types/integration.types';

const __isTestEnv =
  process.env.NODE_ENV === 'test' ||
  typeof process.env.JEST_WORKER_ID !== 'undefined';

@Entity('einvoice_external_invoices')
@Index(['tenantId', 'providerKey', 'providerInvoiceId'], { unique: true })
@Index(['providerKey', 'lastEventAt'])
export class EInvoiceExternalInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ type: 'varchar', length: 64 })
  providerKey: EInvoicingProvider;

  @Column({ type: 'varchar', length: 255 })
  providerInvoiceId: string;

  @Column({ type: 'uuid', nullable: true })
  localInvoiceId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  direction: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  way: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  streamId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  documentId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  originalFormat: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  originalFlavor: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  originalNetwork: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lifecycleStatus: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  statusCode: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  paymentStatus: string | null;

  @Column({ type: __isTestEnv ? 'datetime' : 'timestamp', nullable: true })
  documentDate: Date | null;

  @Column({ type: __isTestEnv ? 'datetime' : 'timestamp', nullable: true })
  lastEventAt: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  rejectionReasonCode: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReasonLabel: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: __isTestEnv ? 'simple-json' : 'jsonb', nullable: true })
  businessData: Record<string, unknown> | null;

  @Column({ type: __isTestEnv ? 'simple-json' : 'jsonb', nullable: true })
  rawPayload: Record<string, unknown> | unknown[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
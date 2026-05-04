import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { EInvoicingProvider } from '../types/integration.types';

const __isTestEnv =
  process.env.NODE_ENV === 'test' ||
  typeof process.env.JEST_WORKER_ID !== 'undefined';

@Entity('einvoice_events')
@Index(['providerKey', 'createdAt'])
@Index(['tenantId', 'providerKey', 'eventType'])
export class EInvoiceEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ type: 'varchar', length: 64 })
  providerKey: EInvoicingProvider;

  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerInvoiceId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerEventId: string | null;

  @Column({ type: 'varchar', length: 128 })
  eventType: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  status: string | null;

  @Column({ type: 'simple-json', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({
    type: __isTestEnv ? 'datetime' : 'timestamp',
    nullable: true,
  })
  processedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
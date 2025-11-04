import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Customer } from '../../customers/entities/customer.entity';

const __isTestEnv =
  process.env.NODE_ENV === 'test' ||
  typeof process.env.JEST_WORKER_ID !== 'undefined';

export enum SaleStatus {
  CREATED = 'created',
  INVOICED = 'invoiced',
  REFUNDED = 'refunded',
}

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // İnsan okunur satış numarası (ör. SAL-2025-11-001)
  @Column({ type: 'varchar', length: 32, unique: true })
  saleNumber: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer | null;

  @Column({ type: 'date' })
  saleDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({
    type: __isTestEnv ? 'text' : 'enum',
    enum: __isTestEnv ? undefined : SaleStatus,
    default: SaleStatus.CREATED,
  })
  status: SaleStatus;

  @Column({ type: 'varchar', nullable: true })
  sourceQuoteId: string | null;

  // İlişkili fatura (opsiyonel). Not: invoice tarafında saleId string olarak tutuluyor.
  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ type: __isTestEnv ? 'simple-json' : 'jsonb', nullable: true })
  items: any[] | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

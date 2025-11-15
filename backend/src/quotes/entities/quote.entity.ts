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
import { User } from '../../users/entities/user.entity';

const __isTestEnv =
  process.env.NODE_ENV === 'test' ||
  typeof process.env.JEST_WORKER_ID !== 'undefined';

export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Public paylaşım için rastgele token (UUID)
  @Column({ type: 'uuid', unique: true })
  publicId: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  quoteNumber: string;

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

  // Denormalized for quick listing
  @Column({ type: 'varchar', length: 255, nullable: true })
  customerName: string | null;

  @Column({ type: 'date' })
  issueDate: Date;

  @Column({ type: 'date', nullable: true })
  validUntil: Date | null;

  @Column({ type: 'varchar', length: 3, default: 'TRY' })
  currency: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: number;

  @Column({
    type: __isTestEnv ? 'text' : 'enum',
    enum: __isTestEnv ? undefined : QuoteStatus,
    default: QuoteStatus.DRAFT,
  })
  status: QuoteStatus;

  @Column({ type: __isTestEnv ? 'simple-json' : 'jsonb', nullable: true })
  items: any[] | null;

  // İşin kapsamı (zengin metin HTML)
  @Column({ type: 'text', nullable: true })
  scopeOfWorkHtml: string | null;

  // Basit revizyon desteği için sürüm
  @Column({ type: 'int', default: 1 })
  version: number;

  // Revizyon geçmişi (snapshot listesi)
  @Column({ type: __isTestEnv ? 'simple-json' : 'jsonb', nullable: true })
  revisions: any[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Attribution
  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdByUser: User | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdByName: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedById' })
  updatedByUser: User | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedByName: string | null;
}

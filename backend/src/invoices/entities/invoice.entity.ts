import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  invoiceNumber: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid', nullable: true })
  customerId: string;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'date' })
  issueDate: Date;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', nullable: true })
  saleId: string;

  @Column({ type: 'varchar', nullable: true })
  type: string; // 'product', 'service', 'refund' (iade faturası)

  @Column({ type: 'uuid', nullable: true })
  refundedInvoiceId: string; // İade edilen orijinal fatura ID'si

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'refundedInvoiceId' })
  refundedInvoice: Invoice; // İade edilen orijinal fatura

  @Column({ type: 'jsonb', nullable: true })
  items: any[];

  // Soft delete columns
  @Column({ name: 'is_voided', type: 'boolean', default: false })
  isVoided: boolean;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string | null;

  @Column({ name: 'voided_at', type: 'timestamp', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'voided_by', type: 'uuid', nullable: true })
  voidedBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'voided_by' })
  voidedByUser: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

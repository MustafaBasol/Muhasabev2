import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { InvoiceLine } from './invoice-line.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import type {
  InvoiceSellerSnapshot,
  InvoiceBuyerSnapshot,
} from '../dto/invoice.dto';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

// E-fatura iletim/compliance durumu (ticari status'tan bağımsız)
// Pennylane CustomerInvoicePDPStatus + ek durumlar ile hizalandı
export enum EInvoiceStatus {
  NOT_APPLICABLE = 'not_applicable', // e-fatura henüz aktif değil
  PENDING = 'pending',               // gönderime hazır, henüz iletilmedi
  SUBMITTED = 'submitted',           // provider'a gönderildi (PDP: submitted)
  SENT = 'sent',                     // alıcıya iletildi (PDP: sent)
  APPROVED = 'approved',             // PDP ağı tarafından onaylandı (PDP: approved)
  ACCEPTED = 'accepted',             // alıcı tarafından kabul edildi (PDP: accepted)
  REJECTED = 'rejected',             // PDP/teknik red (PDP: rejected)
  REFUSED = 'refused',               // alıcı tarafından ticari red (PDP: refused)
  IN_DISPUTE = 'in_dispute',         // itiraz sürecinde (PDP: in_dispute)
  COLLECTED = 'collected',           // tahsilat tamamlandı (PDP: collected)
  PARTIALLY_COLLECTED = 'partially_collected', // kısmi tahsilat (PDP: partially_collected)
  CANCELLED = 'cancelled',           // iletim iptal edildi
}

// Fatura belge türü (Factur-X ve provider mapping için)
export enum InvoiceDocumentType {
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
  DEBIT_NOTE = 'debit_note',
}

const __isTestEnv =
  process.env.NODE_ENV === 'test' ||
  typeof process.env.JEST_WORKER_ID !== 'undefined';

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
  customerId: string | null;

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
    type: __isTestEnv ? 'text' : 'enum',
    enum: __isTestEnv ? undefined : InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true })
  saleId: string | null;

  @Column({ type: 'varchar', nullable: true })
  type: string | null; // 'product', 'service', 'refund' (iade faturası)

  @Column({ type: 'uuid', nullable: true })
  refundedInvoiceId: string | null; // İade edilen orijinal fatura ID'si

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'refundedInvoiceId' })
  refundedInvoice: Invoice | null; // İade edilen orijinal fatura

  // Normalize fatura satırları
  @OneToMany(() => InvoiceLine, (line) => line.invoice, { cascade: true, eager: false })
  lines: InvoiceLine[];

  // Soft delete columns
  @Column({ name: 'is_voided', type: 'boolean', default: false })
  isVoided: boolean;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string | null;

  @Column({
    name: 'voided_at',
    type: __isTestEnv ? 'datetime' : 'timestamp',
    nullable: true,
  })
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

  // ─── Phase 1: E-Fatura Compliance Alanları ───────────────────────────────

  // E-fatura iletim durumu (ticari status'tan ayrı lifecycle)
  @Column({
    type: __isTestEnv ? 'text' : 'enum',
    enum: __isTestEnv ? undefined : EInvoiceStatus,
    default: EInvoiceStatus.NOT_APPLICABLE,
    nullable: true,
  })
  eInvoiceStatus: EInvoiceStatus | null;

  // Provider'dan gelen red/hata açıklaması
  @Column({ type: 'text', nullable: true })
  eInvoiceStatusReason: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  eInvoiceProvider: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  eInvoiceExternalId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  eInvoiceStatusCode: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  eInvoiceLifecycleStatus: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  eInvoicePaymentStatus: string | null;

  @Column({
    type: __isTestEnv ? 'datetime' : 'timestamp',
    nullable: true,
  })
  eInvoiceLastEventAt: Date | null;

  @Column({
    type: __isTestEnv ? 'datetime' : 'timestamp',
    nullable: true,
  })
  eInvoiceRejectedAt: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  eInvoiceRejectionReasonCode: string | null;

  @Column({ type: 'text', nullable: true })
  eInvoiceRejectionReasonLabel: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  eInvoiceErrorCode: string | null;

  @Column({ type: 'text', nullable: true })
  eInvoiceErrorMessage: string | null;

  // Belge türü: fatura / alacak dekontu / borç dekontu
  @Column({
    type: __isTestEnv ? 'text' : 'enum',
    enum: __isTestEnv ? undefined : InvoiceDocumentType,
    nullable: true,
  })
  documentType: InvoiceDocumentType | null;

  // Fatura para birimi (tenant'ın default currency'sinden bağımsız tutulabilir)
  @Column({ type: 'varchar', length: 3, nullable: true, comment: 'ISO 4217' })
  invoiceCurrency: string | null;

  // Fatura dili (FR zorunluluğu için)
  @Column({ type: 'varchar', length: 8, nullable: true, comment: 'BCP 47 dil kodu, örn: fr, en' })
  invoiceLanguage: string | null;

  // Hizmet/teslimat dönemi
  @Column({ type: 'date', nullable: true })
  servicePeriodStart: Date | null;

  @Column({ type: 'date', nullable: true })
  servicePeriodEnd: Date | null;

  // Provider entegrasyon alanları
  @Column({ type: 'varchar', nullable: true, comment: 'External provider invoice ref ID (Pennylane integer id vb.)' })
  providerInvoiceId: string | null;

  @Column({ type: 'varchar', nullable: true, comment: 'Provider tarafından atanan insan-okunur fatura numarası (örn. FA-2024-0001)' })
  providerInvoiceNumber: string | null;

  @Column({
    type: __isTestEnv ? 'datetime' : 'timestamp',
    nullable: true,
    comment: 'Son provider senkronizasyon zamanı',
  })
  lastProviderSyncAt: Date | null;

  @Column({ type: 'text', nullable: true, comment: 'Provider hata mesajı' })
  providerError: string | null;

  // Yasal kimlik snapshot'ları (fatura kesildiğinde anlık olarak kaydedilir, immutable)
  @Column({ type: __isTestEnv ? 'simple-json' : 'jsonb', nullable: true })
  sellerSnapshot: InvoiceSellerSnapshot | null;

  @Column({ type: __isTestEnv ? 'simple-json' : 'jsonb', nullable: true })
  buyerSnapshot: InvoiceBuyerSnapshot | null;

  // ─── EN 16931 Uyum Alanları (BT = Business Term) ──────────────────────────

  // BT-10 — Alıcı referansı (örn. servis kodu, departman numarası)
  @Column({ type: 'varchar', length: 200, nullable: true, comment: 'EN 16931 BT-10: Alıcı fatura referansı' })
  buyerReference: string | null;

  // BT-13 — Sipariş numarası (buyer purchase order)
  @Column({ type: 'varchar', length: 200, nullable: true, comment: 'EN 16931 BT-13: Sipariş numarası' })
  orderReference: string | null;

  // BT-12 — Sözleşme numarası
  @Column({ type: 'varchar', length: 200, nullable: true, comment: 'EN 16931 BT-12: Sözleşme numarası' })
  contractReference: string | null;

  // BT-81 — Ödeme yöntemi kodu (bank_transfer | direct_debit | card | cheque | cash)
  @Column({ type: 'varchar', length: 64, nullable: true, comment: 'EN 16931 BT-81: Ödeme yöntemi kodu' })
  paymentMethodCode: string | null;

  // BT-84 — Alacaklı IBAN (Pennylane: payable_iban)
  @Column({ type: 'varchar', length: 34, nullable: true, comment: 'EN 16931 BT-84: Tahsilat IBAN — maksimum 34 karakter' })
  paymentIban: string | null;

  // BT-86 — Banka BIC/SWIFT kodu
  @Column({ type: 'varchar', length: 11, nullable: true, comment: 'EN 16931 BT-86: Banka BIC/SWIFT kodu' })
  paymentBic: string | null;
}

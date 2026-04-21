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
import { User } from '../../users/entities/user.entity';

// B2B/B2C ayrımı — e-fatura yönlendirme kuralları için gerekli
export enum CustomerType {
  B2B = 'b2b',
  B2C = 'b2c',
  INDIVIDUAL = 'individual',
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  email: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ nullable: true })
  taxNumber: string | null;

  @Column({ nullable: true, comment: 'SIRET Numarası (FR, 14 haneli)' })
  siretNumber: string | null;

  @Column({ nullable: true })
  company: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  // ─── Phase 1: E-Fatura Compliance Alanları ───────────────────────────────

  // Müşteri tipi: B2B, B2C veya bireysel (e-fatura yönlendirme için kritik)
  @Column({
    type: 'simple-enum',
    enum: CustomerType,
    nullable: true,
  })
  customerType: CustomerType | null;

  // Müşteri TVA/KDV numarası (FR: FR + 11 hane)
  @Column({ nullable: true, comment: 'TVA/KDV Numarası (FR: FR + 11 hane)' })
  tvaNumber: string | null;

  // SIREN numarası (9 hane — SIRET olmaksızın kullanılabilir)
  @Column({ nullable: true, comment: 'SIREN Numarası (9 haneli)' })
  sirenNumber: string | null;

  // Yapılandırılmış fatura adresi (ülke kodu, posta kodu vb. ayrıştırılmış)
  @Column({ type: 'simple-json', nullable: true, comment: 'Yapılandırılmış fatura adresi' })
  billingAddress: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string; // ISO 3166-1 alpha-2
    state?: string;
  } | null;

  // Ayrı teslimat adresi (fatura adresinden farklıysa)
  @Column({ type: 'simple-json', nullable: true, comment: 'Teslimat adresi' })
  deliveryAddress: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    state?: string;
  } | null;

  // Müşteri bazlı ödeme koşulları (faturaya snapshot edilecek)
  @Column({ type: 'varchar', nullable: true, comment: 'Ödeme koşulları, örn: 30 gün net' })
  defaultPaymentTerms: string | null;

  // Provider'daki müşteri eşleşme ID'si (Pennylane vb.)
  @Column({ type: 'varchar', nullable: true, comment: 'External provider customer ID' })
  providerCustomerId: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  tenantId: string;

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

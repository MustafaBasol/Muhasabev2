import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

const __isTestEnv =
  process.env.NODE_ENV === 'test' ||
  typeof process.env.JEST_WORKER_ID !== 'undefined';

export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
  EXPIRED = 'expired',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  companyName: string;

  @Column({ nullable: true })
  taxNumber: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true, comment: 'Website URL' })
  website: string;

  // === Türkiye Yasal Alanları ===
  @Column({ nullable: true, comment: 'Vergi Dairesi' })
  taxOffice: string;

  @Column({ nullable: true, comment: 'Mersis Numarası' })
  mersisNumber: string;

  @Column({ nullable: true, comment: 'KEP Adresi (e-fatura)' })
  kepAddress: string;

  // === Fransa Yasal Alanları ===
  @Column({ nullable: true, comment: 'SIRET Numarası (14 haneli)' })
  siretNumber: string;

  @Column({ nullable: true, comment: 'SIREN Numarası (9 haneli)' })
  sirenNumber: string;

  @Column({ nullable: true, comment: 'APE/NAF Kodu (ana faaliyet)' })
  apeCode: string;

  @Column({ nullable: true, comment: 'TVA Numarası (FR + 11 hane)' })
  tvaNumber: string;

  @Column({ nullable: true, comment: 'RCS Numarası (Ticaret Sicil)' })
  rcsNumber: string;

  // === Almanya Yasal Alanları ===
  @Column({ nullable: true, comment: 'Steuernummer (Vergi Numarası)' })
  steuernummer: string;

  @Column({ nullable: true, comment: 'Umsatzsteuer-ID (DE + 9 hane)' })
  umsatzsteuerID: string;

  @Column({ nullable: true, comment: 'Handelsregisternummer (Ticaret Sicil)' })
  handelsregisternummer: string;

  @Column({ nullable: true, comment: 'Geschäftsführer (Genel Müdür)' })
  geschaeftsfuehrer: string;

  // === Amerika Yasal Alanları ===
  @Column({ nullable: true, comment: 'EIN (Employer Identification Number)' })
  einNumber: string;

  @Column({ nullable: true, comment: 'Tax ID Numarası' })
  taxId: string;

  @Column({ nullable: true, comment: 'Business License Number' })
  businessLicenseNumber: string;

  @Column({ nullable: true, comment: 'State of Incorporation' })
  stateOfIncorporation: string;

  @Column({
    // Sürücüler arası uyumluluk için simple-enum kullan
    type: 'simple-enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  subscriptionPlan: SubscriptionPlan;

  @Column({
    type: 'simple-enum',
    enum: TenantStatus,
    default: TenantStatus.TRIAL,
  })
  status: TenantStatus;

  @Column({ nullable: true })
  subscriptionExpiresAt: Date;

  @Column({ type: 'int', default: 5 })
  maxUsers: number;

  @Column({ type: 'simple-json', nullable: true })
  settings: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  features: Record<string, boolean>;

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

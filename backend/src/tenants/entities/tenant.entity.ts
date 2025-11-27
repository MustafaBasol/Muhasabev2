import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

const driverHint = (
  process.env.TEST_DB ||
  process.env.TEST_DATABASE ||
  process.env.TEST_DATABASE_TYPE ||
  process.env.DB_TYPE ||
  process.env.DATABASE_CLIENT ||
  process.env.TYPEORM_CONNECTION ||
  process.env.TYPEORM_DRIVER ||
  ''
).toLowerCase();

const isSqliteHint = ['sqlite', 'better-sqlite3'].includes(driverHint);

const __sqliteFriendlyEnv =
  isSqliteHint ||
  (!driverHint &&
    (process.env.DB_SQLITE === 'true' ||
      process.env.NODE_ENV === 'test' ||
      typeof process.env.JEST_WORKER_ID !== 'undefined'));

const timestampColumnType = __sqliteFriendlyEnv ? 'datetime' : 'timestamp';

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

  @Column({ nullable: true, type: 'varchar' })
  companyName: string | null;

  @Column({ nullable: true, type: 'varchar' })
  taxNumber: string | null;

  @Column({ nullable: true, type: 'varchar' })
  address: string | null;

  @Column({ nullable: true, type: 'varchar' })
  phone: string | null;

  @Column({ nullable: true, type: 'varchar' })
  email: string | null;

  @Column({ nullable: true, comment: 'Website URL', type: 'varchar' })
  website: string | null;

  // === Türkiye Yasal Alanları ===
  @Column({ nullable: true, comment: 'Vergi Dairesi', type: 'varchar' })
  taxOffice: string | null;

  @Column({ nullable: true, comment: 'Mersis Numarası', type: 'varchar' })
  mersisNumber: string | null;

  @Column({ nullable: true, comment: 'KEP Adresi (e-fatura)', type: 'varchar' })
  kepAddress: string | null;

  // === Fransa Yasal Alanları ===
  @Column({
    nullable: true,
    comment: 'SIRET Numarası (14 haneli)',
    type: 'varchar',
  })
  siretNumber: string | null;

  @Column({
    nullable: true,
    comment: 'SIREN Numarası (9 haneli)',
    type: 'varchar',
  })
  sirenNumber: string | null;

  @Column({
    nullable: true,
    comment: 'APE/NAF Kodu (ana faaliyet)',
    type: 'varchar',
  })
  apeCode: string | null;

  @Column({
    nullable: true,
    comment: 'TVA Numarası (FR + 11 hane)',
    type: 'varchar',
  })
  tvaNumber: string | null;

  @Column({
    nullable: true,
    comment: 'RCS Numarası (Ticaret Sicil)',
    type: 'varchar',
  })
  rcsNumber: string | null;

  // === Almanya Yasal Alanları ===
  @Column({
    nullable: true,
    comment: 'Steuernummer (Vergi Numarası)',
    type: 'varchar',
  })
  steuernummer: string | null;

  @Column({
    nullable: true,
    comment: 'Umsatzsteuer-ID (DE + 9 hane)',
    type: 'varchar',
  })
  umsatzsteuerID: string | null;

  @Column({
    nullable: true,
    comment: 'Handelsregisternummer (Ticaret Sicil)',
    type: 'varchar',
  })
  handelsregisternummer: string | null;

  @Column({
    nullable: true,
    comment: 'Geschäftsführer (Genel Müdür)',
    type: 'varchar',
  })
  geschaeftsfuehrer: string | null;

  // === Amerika Yasal Alanları ===
  @Column({
    nullable: true,
    comment: 'EIN (Employer Identification Number)',
    type: 'varchar',
  })
  einNumber: string | null;

  @Column({ nullable: true, comment: 'Tax ID Numarası', type: 'varchar' })
  taxId: string | null;

  @Column({
    nullable: true,
    comment: 'Business License Number',
    type: 'varchar',
  })
  businessLicenseNumber: string | null;

  @Column({
    nullable: true,
    comment: 'State of Incorporation',
    type: 'varchar',
  })
  stateOfIncorporation: string | null;

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

  @Column({ nullable: true, type: timestampColumnType })
  subscriptionExpiresAt: Date | null;

  // Dönem sonunda iptal isteği (true ise abonelik mevcut dönem bitimine kadar aktif kalır, yenilenmez)
  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd: boolean;

  // Stripe entegrasyonu
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeCustomerId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: true,
    comment: 'billing interval: month|year',
  })
  billingInterval: string | null;

  @Column({ type: 'int', default: 5 })
  maxUsers: number;

  // Plan düşürme uyarı/uygulama akışı için alanlar
  @Column({
    type: timestampColumnType,
    nullable: true,
    comment: 'Plan düşürme için son tarih',
  })
  downgradePendingUntil: Date | null;

  @Column({
    type: 'int',
    nullable: true,
    comment: 'Plan düşürmede pasifleştirilmesi gereken kullanıcı sayısı',
  })
  requiredUserReduction: number | null;

  @Column({ type: 'simple-json', nullable: true })
  settings: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  features: Record<string, boolean> | null;

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

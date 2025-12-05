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
import { Organization } from '../../organizations/entities/organization.entity';

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

const timestamptzColumnType = __sqliteFriendlyEnv ? 'datetime' : 'timestamptz';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  ACCOUNTANT = 'accountant',
  USER = 'user',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  lastLoginTimeZone: string;

  @Column({ type: 'int', nullable: true })
  lastLoginUtcOffsetMinutes: number;

  @Column({ nullable: true })
  deletionRequestedAt: Date;

  @Column({ default: false })
  isPendingDeletion: boolean;

  // Two-Factor Authentication fields
  @Column({ name: 'twoFactorSecret', nullable: true })
  twoFactorSecret: string;

  @Column({ name: 'twoFactorEnabled', default: false })
  twoFactorEnabled: boolean;

  @Column({
    name: 'twoFactorBackupCodes',
    type: 'text',
    array: true,
    nullable: true,
  })
  backupCodes: string[];

  @Column({
    name: 'twoFactorEnabledAt',
    nullable: true,
  })
  twoFactorEnabledAt: Date;

  // Email verification fields
  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true, type: 'varchar' })
  emailVerificationToken?: string | null;

  @Column({ nullable: true, type: timestamptzColumnType })
  emailVerificationSentAt?: Date | null;

  @Column({ nullable: true, type: timestamptzColumnType })
  emailVerifiedAt?: Date | null;

  // Password reset fields
  @Column({ nullable: true, type: 'varchar' })
  passwordResetToken: string | null;

  @Column({ nullable: true, type: timestamptzColumnType })
  passwordResetExpiresAt: Date | null;

  @ManyToOne(() => Tenant, (tenant) => tenant.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  tenantId: string;

  // Current organization ID for session context
  @Column({ nullable: true })
  currentOrgId?: string | null;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'currentOrgId' })
  currentOrganization: Organization;

  @Column({ type: timestamptzColumnType, nullable: true })
  removedFromTenantAt?: Date | null;

  @Column({ nullable: true })
  removedFromTenantBy?: string | null;

  @Column({ nullable: true })
  removedFromTenantReason?: string | null;

  @Column({ nullable: true })
  removedFromTenantId?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // JWT token versioning – increment to invalidate all existing tokens
  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

  // Notification preferences (per user, per tenant context)
  // Stored as JSON blob to allow easy extension without extra migrations
  @Column({ type: 'simple-json', nullable: true })
  notificationPreferences?: {
    invoiceReminders?: boolean;
    expenseAlerts?: boolean;
    salesNotifications?: boolean;
    lowStockAlerts?: boolean;
    quoteReminders?: boolean;
  };
}

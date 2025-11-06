import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Organization } from '../../organizations/entities/organization.entity';

const __isTestEnv =
  process.env.NODE_ENV === 'test' ||
  typeof process.env.JEST_WORKER_ID !== 'undefined';

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
    type: __isTestEnv ? 'text' : 'enum',
    enum: __isTestEnv ? undefined : UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: __isTestEnv ? 'datetime' : 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({ type: __isTestEnv ? 'datetime' : 'timestamp', nullable: true })
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
    type: __isTestEnv ? 'simple-json' : 'text',
    array: __isTestEnv ? undefined : true,
    nullable: true,
  })
  backupCodes: string[];

  @Column({
    name: 'twoFactorEnabledAt',
    type: __isTestEnv ? 'datetime' : 'timestamp',
    nullable: true,
  })
  twoFactorEnabledAt: Date;

  // Email verification fields
  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken: string;

  @Column({ type: __isTestEnv ? 'datetime' : 'timestamp', nullable: true })
  emailVerificationSentAt: Date;

  @Column({ type: __isTestEnv ? 'datetime' : 'timestamp', nullable: true })
  emailVerifiedAt: Date;

  // Password reset fields
  @Column({ nullable: true })
  passwordResetToken: string;

  @Column({ type: __isTestEnv ? 'datetime' : 'timestamp', nullable: true })
  passwordResetExpiresAt: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  tenantId: string;

  // Current organization ID for session context
  @Column({ nullable: true })
  currentOrgId: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'currentOrgId' })
  currentOrganization: Organization;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Notification preferences (per user, per tenant context)
  // Stored as JSON blob to allow easy extension without extra migrations
  @Column({ type: 'json', nullable: true })
  notificationPreferences?: {
    invoiceReminders?: boolean;
    expenseAlerts?: boolean;
    salesNotifications?: boolean;
    lowStockAlerts?: boolean;
    quoteReminders?: boolean;
  };
}

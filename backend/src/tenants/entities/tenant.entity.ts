import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

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

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  subscriptionPlan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.TRIAL,
  })
  status: TenantStatus;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionExpiresAt: Date;

  @Column({ type: 'int', default: 5 })
  maxUsers: number;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  features: Record<string, boolean>;

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
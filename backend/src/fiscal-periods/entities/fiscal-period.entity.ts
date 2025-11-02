import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

const __isTestEnv = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

@Entity('fiscal_periods')
export class FiscalPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  name: string; // e.g., "January 2024", "Q1 2024", "2024"

  @Column({ type: 'date' })
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ type: __isTestEnv ? 'datetime' : 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  lockedBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lockedBy' })
  lockedByUser: User | null;

  @Column({ type: 'text', nullable: true })
  lockReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
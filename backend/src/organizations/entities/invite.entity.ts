import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Role } from '../../common/enums/organization.enum';

const __isTestEnv = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

@Entity('invites')
@Index(['token'], { unique: true })
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: string;

  @Column()
  email: string;

  @Column({
    type: __isTestEnv ? 'text' : 'enum',
    enum: __isTestEnv ? undefined : Role,
    default: Role.MEMBER,
  })
  role: Role;

  @Column({ unique: true })
  token: string;

  @Column({ type: __isTestEnv ? 'datetime' : 'timestamp' })
  expiresAt: Date;

  @Column({ type: __isTestEnv ? 'datetime' : 'timestamp', nullable: true })
  acceptedAt: Date;

  @ManyToOne(() => Organization, (organization) => organization.invites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn()
  createdAt: Date;
}
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('email_outbox')
export class EmailOutbox {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320 })
  @Index()
  to!: string;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'varchar', length: 32 })
  provider!: string; // ses | smtp | log

  @Column({ type: 'boolean', default: false })
  success!: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  messageId?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  correlationId?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tenantId?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tokenId?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  type?: string | null; // verify | verify-resend | reset | deletion | export

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
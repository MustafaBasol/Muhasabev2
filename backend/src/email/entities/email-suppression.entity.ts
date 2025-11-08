import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('email_suppression')
export class EmailSuppression {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_email_suppression_email', { unique: true })
  @Column({ type: 'varchar', length: 320 })
  email: string; // lowercase

  @Column({ type: 'varchar', length: 50, nullable: true })
  reason?: string; // bounce | complaint | manual | other

  @CreateDateColumn()
  createdAt: Date;
}

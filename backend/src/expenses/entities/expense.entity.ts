import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';

export enum ExpenseCategory {
  OTHER = 'other',
  RENT = 'rent',
  UTILITIES = 'utilities',
  SALARIES = 'salaries',
  PERSONNEL = 'personnel',
  SUPPLIES = 'supplies',
  EQUIPMENT = 'equipment',
  MARKETING = 'marketing',
  TRAVEL = 'travel',
  INSURANCE = 'insurance',
  TAXES = 'taxes',
}

export enum ExpenseStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PAID = 'paid',
  REJECTED = 'rejected',
}

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  expenseNumber: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid', nullable: true })
  supplierId: string;

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column()
  description: string;

  @Column({ type: 'date' })
  expenseDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ExpenseCategory,
    default: ExpenseCategory.OTHER,
  })
  category: ExpenseCategory;

  @Column({
    type: 'enum',
    enum: ExpenseStatus,
    default: ExpenseStatus.PENDING,
  })
  status: ExpenseStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', nullable: true })
  receiptUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

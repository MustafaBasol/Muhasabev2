import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

@Entity('products')
@Unique(['tenantId', 'code'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Kodun benzersizliği tenant bazlıdır (sınıf düzeyinde @Unique ile tanımlandı)
  @Column()
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  stock: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minStock: number;

  @Column({ default: 'pieces' })
  unit: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  categoryTaxRateOverride: number; // Ürüne özel KDV oranı (kategorinin KDV'sini override eder)

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Attribution
  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdByUser: User | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdByName: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedById' })
  updatedByUser: User | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedByName: string | null;
}

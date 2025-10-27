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

@Entity('product_categories')
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 18 })
  taxRate: number; // KDV oranı (örn: 18 = %18)

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  parentId?: string; // Ana kategori (Hizmetler/Ürünler) altında alt kategori için

  @Column({ default: false })
  isProtected: boolean; // Silinemeyen/değiştirilemeyen ana kategoriler (Hizmetler, Ürünler)

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

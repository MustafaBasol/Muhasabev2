import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Invoice } from './invoice.entity';

/**
 * Normalize edilmiş fatura satırı.
 *
 * Neden ayrı tablo:
 *  - TVA breakdown (rate bazlı gruplama) sorgulanabilir
 *  - Pennylane / Factur-X mapping satır bazlı veri bekler
 *  - Stok hareketi ve raporlama kolaylaşır
 */
@Entity('invoice_lines')
@Index(['invoiceId'])
export class InvoiceLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  // Sıralama — PDF / Factur-X satır sırası için
  @Column({ type: 'int', default: 0 })
  position: number;

  // Ürün referansı (opsiyonel — serbest metin satırları da olabilir)
  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ type: 'varchar', nullable: true })
  productName: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  quantity: number;

  // KDV hariç birim fiyat
  @Column({ type: 'decimal', precision: 12, scale: 4 })
  unitPrice: number;

  // Satır bazlı KDV oranı (%, örn: 20.00)
  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  taxRate: number;

  // Satır bazlı indirim tutarı (KDV hariç)
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  discountAmount: number;

  // Hesaplanmış alanlar (denormal — servis tarafından doldurulur)
  // KDV hariç satır toplamı = quantity * unitPrice - discountAmount
  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  lineNet: number;

  // Satır KDV tutarı = lineNet * taxRate / 100
  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  lineTax: number;

  // KDV dahil satır toplamı = lineNet + lineTax
  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  lineGross: number;

  // Birim (adet, saat, kg vb.) — opsiyonel, Factur-X unit code için
  @Column({ type: 'varchar', length: 16, nullable: true })
  unit: string | null;
}

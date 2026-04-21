import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { IntegrationLogLevel } from '../types/integration.types';

/**
 * Provider API çağrılarının denetim kaydı.
 *
 * - request / response / hata detayları JSON olarak saklanır
 * - silme işlemi yapılmaz; retention policy ile eski kayıtlar temizlenir
 * - OutboundJob ile ilişkilendirilebilir (nullable FK — log her zaman silinmez)
 */
@Entity('integration_logs')
@Index(['tenantId', 'providerKey', 'createdAt'])
@Index(['outboundJobId'])
export class IntegrationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 64 })
  providerKey: string;

  // İlişkili iş (opsiyonel — doğrudan API çağrıları için null olabilir)
  @Column({ type: 'uuid', nullable: true })
  outboundJobId: string | null;

  // İlişkili fatura (opsiyonel)
  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  // Log seviyesi
  @Column({
    type: 'simple-enum',
    enum: IntegrationLogLevel,
    default: IntegrationLogLevel.INFO,
  })
  level: IntegrationLogLevel;

  // Ne yapıldığını özetleyen kısa etiket: "invoice.submit", "customer.upsert" vb.
  @Column({ type: 'varchar', length: 128 })
  action: string;

  // HTTP yöntemi + URL (opsiyonel)
  @Column({ type: 'varchar', nullable: true })
  httpMethod: string | null;

  @Column({ type: 'text', nullable: true })
  httpUrl: string | null;

  // HTTP yanıt kodu
  @Column({ type: 'int', nullable: true })
  httpStatus: number | null;

  // Gönderilen request gövdesi (hassas alanlar servis katmanında maskelenmeli)
  @Column({ type: 'simple-json', nullable: true })
  requestBody: Record<string, unknown> | null;

  // Alınan response gövdesi
  @Column({ type: 'simple-json', nullable: true })
  responseBody: Record<string, unknown> | null;

  // Hata mesajı (varsa)
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  // İşlem süresi (ms)
  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @CreateDateColumn()
  createdAt: Date;
}

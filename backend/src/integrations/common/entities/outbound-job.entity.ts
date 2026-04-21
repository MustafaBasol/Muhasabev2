import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { OutboundJobStatus, OutboundJobType } from '../types/integration.types';

/**
 * Provider'a gönderilecek işlerin kuyruğu.
 *
 * - idempotencyKey: aynı işin iki kez çalışmasını önler
 * - retryCount / maxRetries: üstel geri çekilmeli retry için
 * - nextRetryAt: bir sonraki denemenin zamanı
 * - lockedAt: işlemin şu an işlendiğini gösteren kilit (optimistic locking)
 */
@Entity('outbound_jobs')
@Index(['tenantId', 'status', 'nextRetryAt'])
@Index(['idempotencyKey'], { unique: true })
export class OutboundJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 64 })
  providerKey: string;

  // İş türü
  @Column({
    type: 'simple-enum',
    enum: OutboundJobType,
  })
  jobType: OutboundJobType;

  // Durum
  @Column({
    type: 'simple-enum',
    enum: OutboundJobStatus,
    default: OutboundJobStatus.PENDING,
  })
  status: OutboundJobStatus;

  // Tekrar gönderimi önleyen benzersiz anahtar
  // Format önerisi: "<tenantId>:<jobType>:<entityId>:<attempt>"
  @Column({ type: 'varchar', length: 255 })
  idempotencyKey: string;

  // İlişkili fatura ID'si (varsa)
  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  // İlişkili müşteri ID'si (varsa)
  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  // İş yükü (provider'a gönderilecek veri, maskelenerek saklanabilir)
  @Column({ type: 'simple-json', nullable: true })
  payload: Record<string, unknown> | null;

  // Kaç kez denendi
  @Column({ type: 'int', default: 0 })
  retryCount: number;

  // Maksimum deneme sayısı
  @Column({ type: 'int', default: 5 })
  maxRetries: number;

  // Bir sonraki deneme zamanı (null ise hemen çalıştırılabilir)
  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date | null;

  // İşlenmeye başlandığı zaman (kilit)
  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  // Tamamlanma veya kalıcı hata zamanı
  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  // Son hata mesajı
  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  // Provider'ın bu iş için verdiği referans (başarıyla tamamlandıktan sonra)
  @Column({ type: 'varchar', nullable: true })
  providerReference: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../../tenants/entities/tenant.entity';
import {
  ProviderConnectionStatus,
} from '../types/integration.types';

/**
 * Tenant ↔ e-fatura provider bağlantısı.
 *
 * Her tenant birden fazla provider'a bağlanabilir (farklı providerKey'ler).
 * Aynı tenant + aynı providerKey kombinasyonu tekil olmalı.
 *
 * Token alanları uygulama katmanında şifrelenmeli — bu entity sadece
 * saklama yapısını tanımlar. Çözüm için EncryptionService Phase 2'de eklenir.
 */
@Entity('provider_accounts')
@Index(['tenantId', 'providerKey'], { unique: true })
export class ProviderAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // Hangi provider: "pennylane", "chorus_pro" vb.
  @Column({ type: 'varchar', length: 64 })
  providerKey: string;

  // Bağlantı durumu
  @Column({
    type: 'simple-enum',
    enum: ProviderConnectionStatus,
    default: ProviderConnectionStatus.DISCONNECTED,
  })
  connectionStatus: ProviderConnectionStatus;

  // OAuth erişim token'ı (şifreli olarak saklanmalı)
  @Column({ type: 'text', nullable: true, select: false })
  accessToken: string | null;

  // OAuth yenileme token'ı (şifreli olarak saklanmalı)
  @Column({ type: 'text', nullable: true, select: false })
  refreshToken: string | null;

  // Token geçerlilik sonu
  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt: Date | null;

  // Provider'ın bu tenant için verdiği dış hesap/firma ID'si
  @Column({ type: 'varchar', nullable: true })
  providerAccountId: string | null;

  // Son başarılı bağlantı zamanı
  @Column({ type: 'timestamp', nullable: true })
  lastConnectedAt: Date | null;

  // Son hata mesajı
  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  // Provider'a özgü ek yapılandırma (bölge, ortam, özel parametreler)
  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

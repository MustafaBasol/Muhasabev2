import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderAccount } from '../entities/provider-account.entity';
import { ProviderConnectionStatus } from '../types/integration.types';
import { EncryptionService } from '../../../common/crypto/encryption.service';

const TOKEN_ALIAS = 'providerAccount';

/**
 * Provider bağlantı hesapları CRUD servisi.
 * Token operations (store / rotate / invalidate) bu servis üzerinden yapılır.
 *
 * Token güvenliği: accessToken ve refreshToken, EncryptionService (AES-256-GCM)
 * ile şifrelenerek saklanır; findWithTokens() şifre çözmeyi otomatik yapar.
 */
@Injectable()
export class ProviderAccountService {
  constructor(
    @InjectRepository(ProviderAccount)
    private readonly accountRepository: Repository<ProviderAccount>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async findByTenantAndProvider(
    tenantId: string,
    providerKey: string,
  ): Promise<ProviderAccount | null> {
    return this.accountRepository.findOne({ where: { tenantId, providerKey } });
  }

  /**
   * `accessToken` ve `refreshToken` alanları `select: false` işaretli olduğundan
   * normal `findOne` bunları getirmez. Token gerektiren işlemlerde bu metodu kullan.
   * Dönen entity'nin token alanları otomatik olarak şifre çözülmüş hâlde gelir.
   */
  async findWithTokens(
    tenantId: string,
    providerKey: string,
  ): Promise<ProviderAccount | null> {
    const account = await this.accountRepository
      .createQueryBuilder(TOKEN_ALIAS)
      .addSelect([
        `${TOKEN_ALIAS}.accessToken`,
        `${TOKEN_ALIAS}.refreshToken`,
      ])
      .where(`${TOKEN_ALIAS}.tenantId = :tenantId`, { tenantId })
      .andWhere(`${TOKEN_ALIAS}.providerKey = :providerKey`, { providerKey })
      .getOne();

    if (!account) return null;

    // Şifre çöz (şifrelenmemiş eski kayıtlar da kabul edilir)
    if (account.accessToken) {
      account.accessToken = this.encryptionService.decrypt(account.accessToken);
    }
    if (account.refreshToken) {
      account.refreshToken = this.encryptionService.decrypt(account.refreshToken);
    }

    return account;
  }

  async upsert(
    tenantId: string,
    providerKey: string,
    data: Partial<ProviderAccount>,
  ): Promise<ProviderAccount> {
    // Token alanlarını kaydetmeden önce şifrele
    const toSave = { ...data };
    if (toSave.accessToken) {
      toSave.accessToken = this.encryptionService.encrypt(toSave.accessToken);
    }
    if (toSave.refreshToken) {
      toSave.refreshToken = this.encryptionService.encrypt(toSave.refreshToken);
    }

    const existing = await this.findByTenantAndProvider(tenantId, providerKey);
    if (existing) {
      Object.assign(existing, toSave);
      return this.accountRepository.save(existing);
    }
    const account = this.accountRepository.create({
      tenantId,
      providerKey,
      ...toSave,
    });
    return this.accountRepository.save(account);
  }

  async markConnected(
    tenantId: string,
    providerKey: string,
    providerAccountId?: string,
  ): Promise<void> {
    await this.upsert(tenantId, providerKey, {
      connectionStatus: ProviderConnectionStatus.CONNECTED,
      lastConnectedAt: new Date(),
      lastError: null,
      providerAccountId: providerAccountId ?? undefined,
    });
  }

  async markError(
    tenantId: string,
    providerKey: string,
    error: string,
  ): Promise<void> {
    await this.upsert(tenantId, providerKey, {
      connectionStatus: ProviderConnectionStatus.ERROR,
      lastError: error,
    });
  }

  async disconnect(tenantId: string, providerKey: string): Promise<void> {
    const account = await this.findByTenantAndProvider(tenantId, providerKey);
    if (!account) return;
    account.connectionStatus = ProviderConnectionStatus.DISCONNECTED;
    account.accessToken = null;
    account.refreshToken = null;
    account.tokenExpiresAt = null;
    await this.accountRepository.save(account);
  }
}

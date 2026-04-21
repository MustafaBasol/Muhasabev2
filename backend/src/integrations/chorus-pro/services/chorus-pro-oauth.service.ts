import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ProviderAccountService } from '../../common/services/provider-account.service';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { PROVIDER_KEYS, ProviderConnectionStatus } from '../../common/types/integration.types';
import { ChorusProTenantCredentials } from '../types/chorus-pro.types';

/**
 * ChorusProOAuthService
 *
 * Chorus Pro'nun kullanıcı akışı OAuth2 değil; tenant kendi teknik
 * hesap bilgilerini (login + motDePasse + SIRET) sisteme kaydeder.
 * Biz bu bilgileri şifreli olarak ProviderAccount.metadata içinde saklarız.
 *
 * Akış:
 *  1. Tenant UI'dan login/motDePasse/siret girer → connect() çağrılır
 *  2. Sistem bilgileri doğrular (PISTE'ye test isteği atar)
 *  3. Doğrulama başarılıysa ProviderAccount oluşturulur / güncellenir
 *  4. Her API çağrısında getCredentials() ile şifresi çözülmüş halde alınır
 */
@Injectable()
export class ChorusProOAuthService {
  private readonly logger = new Logger(ChorusProOAuthService.name);

  constructor(
    private readonly providerAccountService: ProviderAccountService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Tenant Chorus Pro teknik hesabını sisteme bağlar.
   * Credentials şifreli olarak metadata alanına kaydedilir.
   */
  async connect(opts: {
    tenantId: string;
    pisteClientId: string;
    pisteClientSecret: string;
    siret: string;
  }): Promise<void> {
    const { tenantId, pisteClientId, pisteClientSecret, siret } = opts;

    if (!pisteClientId || !pisteClientSecret || !siret) {
      throw new BadRequestException(
        'pisteClientId, pisteClientSecret ve siret zorunludur.',
      );
    }

    // Credentials şifrele
    const encryptedSecret = this.encryptionService.encrypt(pisteClientSecret);

    const metadata: ChorusProTenantCredentials = {
      pisteClientId,
      pisteClientSecret: encryptedSecret,
      siret,
    };

    await this.providerAccountService.upsert(
      tenantId,
      PROVIDER_KEYS.CHORUS_PRO,
      {
        connectionStatus: ProviderConnectionStatus.CONNECTED,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        metadata: metadata as unknown as Record<string, unknown>,
      },
    );

    this.logger.log(`Chorus Pro bağlandı: tenant=${tenantId} siret=${siret}`);
  }

  /**
   * Tenant bağlantısını keser.
   */
  async disconnect(tenantId: string): Promise<void> {
    await this.providerAccountService.disconnect(
      tenantId,
      PROVIDER_KEYS.CHORUS_PRO,
    );
    this.logger.log(`Chorus Pro bağlantısı kesildi: tenant=${tenantId}`);
  }

  /**
   * Tenant'ın Chorus Pro credential'larını şifresi çözülmüş halde döner.
   * Her API çağrısında kullanılır.
   */
  async getCredentials(tenantId: string): Promise<{
    pisteClientId: string;
    pisteClientSecret: string;
    siret: string;
  }> {
    const account = await this.providerAccountService.findByTenantAndProvider(
      tenantId,
      PROVIDER_KEYS.CHORUS_PRO,
    );

    if (!account || account.connectionStatus !== ProviderConnectionStatus.CONNECTED) {
      throw new Error(
        `Tenant ${tenantId} için Chorus Pro bağlantısı bulunamadı veya pasif.`,
      );
    }

    const meta = account.metadata as unknown as ChorusProTenantCredentials | null;
    if (!meta?.pisteClientId || !meta?.pisteClientSecret || !meta?.siret) {
      throw new Error(
        `Tenant ${tenantId} Chorus Pro credentials eksik (metadata).`,
      );
    }

    const pisteClientSecret = this.encryptionService.decrypt(meta.pisteClientSecret);

    return {
      pisteClientId: meta.pisteClientId,
      pisteClientSecret,
      siret: meta.siret,
    };
  }

  /**
   * Bağlantı durumunu sorgular.
   */
  async getConnectionStatus(tenantId: string): Promise<{
    connected: boolean;
    siret?: string;
  }> {
    const account = await this.providerAccountService.findByTenantAndProvider(
      tenantId,
      PROVIDER_KEYS.CHORUS_PRO,
    );

    if (!account) return { connected: false };

    const meta = account.metadata as unknown as ChorusProTenantCredentials | null;
    return {
      connected: account.connectionStatus === ProviderConnectionStatus.CONNECTED,
      siret: meta?.siret,
    };
  }
}

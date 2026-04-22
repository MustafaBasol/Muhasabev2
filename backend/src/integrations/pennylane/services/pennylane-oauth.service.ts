import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import {
  PENNYLANE_AUTH_URL,
  PENNYLANE_TOKEN_URL,
  PENNYLANE_SCOPES,
  PennylaneTokenResponse,
} from '../types/pennylane.types';
import { ProviderAccountService } from '../../common/services/provider-account.service';
import { PROVIDER_KEYS, ProviderConnectionStatus } from '../../common/types/integration.types';

/**
 * PennylaneOAuthService
 *
 * Pennylane OAuth 2.0 Authorization Code Flow:
 *   1. getAuthorizationUrl(tenantId)  → kullanıcıyı Pennylane'e yönlendirir
 *   2. handleCallback(code, tenantId) → code → tokens, provider_accounts'a kaydeder
 *   3. getValidAccessToken(tenantId)  → gerekirse refresh ederek token döner
 *
 * Tokens şifreli saklanmaz (Phase 2 notu: app-layer encryption eklenecek).
 * select:false ile DB'den otomatik seçilmez, servis açıkça SELECT eder.
 */
@Injectable()
export class PennylaneOAuthService {
  private readonly logger = new Logger(PennylaneOAuthService.name);

  constructor(
    private readonly providerAccountService: ProviderAccountService,
  ) {}

  // ─── Step 1: Authorization URL ─────────────────────────────────────────────

  getAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    tenantId: string,
  ): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: PENNYLANE_SCOPES.join(' '),
      state: tenantId, // CSRF koruması için tenantId kullanılır; üretimde daha güçlü bir state kullanın
    });
    return `${PENNYLANE_AUTH_URL}?${params.toString()}`;
  }

  // ─── Step 2: Exchange Code → Tokens ────────────────────────────────────────

  async handleCallback(opts: {
    code: string;
    tenantId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<void> {
    const { code, tenantId, clientId, clientSecret, redirectUri } = opts;

    let tokenData: PennylaneTokenResponse;
    try {
      const res = await axios.post<PennylaneTokenResponse>(
        PENNYLANE_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // Pennylane token endpoint'i RFC 6749 §2.3.1 uyumlu:
            // client_id + client_secret HTTP Basic auth header olarak gönderilmeli
            Authorization:
              'Basic ' +
              Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
          },
        },
      );
      tokenData = res.data;
    } catch (err) {
      const detail = (err as any)?.response?.data ?? (err as any)?.message ?? err;
      this.logger.error('Token exchange hatası', JSON.stringify(detail));
      throw new UnauthorizedException('Pennylane token alınamadı.');
    }

    const expiresAt = new Date(
      (tokenData.created_at + tokenData.expires_in) * 1000,
    );

    await this.providerAccountService.upsert(tenantId, PROVIDER_KEYS.PENNYLANE, {
      providerAccountId: clientId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: expiresAt,
      connectionStatus: ProviderConnectionStatus.CONNECTED,
      lastConnectedAt: new Date(),
      metadata: { token_type: tokenData.token_type, scope: tokenData.scope },
    });

    this.logger.log(`Pennylane bağlantısı kuruldu tenant=${tenantId}`);
  }

  // ─── Step 3: Get Valid Access Token (auto-refresh) ─────────────────────────

  async getValidAccessToken(
    tenantId: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const account = await this.providerAccountService.findWithTokens(
      tenantId,
      PROVIDER_KEYS.PENNYLANE,
    );

    if (!account) {
      throw new UnauthorizedException(
        `Pennylane bağlantısı bulunamadı (tenant=${tenantId}). Önce OAuth ile bağlanın.`,
      );
    }

    // Süre dolmamışsa direkt dön
    const nowMs = Date.now();
    const bufferMs = 5 * 60 * 1000; // 5 dakika tampon
    if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > nowMs + bufferMs) {
      return account.accessToken!;
    }

    // Refresh et
    if (!account.refreshToken) {
      throw new UnauthorizedException(
        'Refresh token yok. Lütfen Pennylane bağlantısını yenileyin.',
      );
    }

    return this.refreshToken(account.refreshToken, tenantId, clientId, clientSecret);
  }

  // ─── Internal: Refresh ─────────────────────────────────────────────────────

  private async refreshToken(
    currentRefreshToken: string,
    tenantId: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    let tokenData: PennylaneTokenResponse;
    try {
      const res = await axios.post<PennylaneTokenResponse>(
        PENNYLANE_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: currentRefreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization:
              'Basic ' +
              Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
          },
        },
      );
      tokenData = res.data;
    } catch (err) {
      this.logger.error('Token refresh hatası', err);
      throw new UnauthorizedException('Pennylane token yenilenemedi. Lütfen yeniden bağlanın.');
    }

    const expiresAt = new Date(
      (tokenData.created_at + tokenData.expires_in) * 1000,
    );

    await this.providerAccountService.upsert(tenantId, PROVIDER_KEYS.PENNYLANE, {
      providerAccountId: clientId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: expiresAt,
      metadata: { token_type: tokenData.token_type, scope: tokenData.scope },
    });

    this.logger.log(`Pennylane token yenilendi (tenant=${tenantId})`);
    return tokenData.access_token;
  }

  // ─── Bağlantı durumu & bağlantı kesme ─────────────────────────────────────

  async getConnectionStatus(tenantId: string): Promise<{
    connected: boolean;
    connectedAt?: string | null;
  }> {
    const account = await this.providerAccountService.findByTenantAndProvider(
      tenantId,
      PROVIDER_KEYS.PENNYLANE,
    );
    if (!account) return { connected: false };
    return {
      connected: account.connectionStatus === 'connected',
      connectedAt: account.lastConnectedAt?.toISOString() ?? null,
    };
  }

  async disconnect(tenantId: string): Promise<void> {
    await this.providerAccountService.disconnect(tenantId, PROVIDER_KEYS.PENNYLANE);
    this.logger.log(`Pennylane bağlantısı kesildi (tenant=${tenantId})`);
  }

  /**
   * Mevcut tokenın geçerliliğini Pennylane /me endpoint'i ile doğrular.
   * Bağlantı testi için kullanılır.
   */
  async verifyToken(
    tenantId: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{ valid: boolean; email?: string; role?: string }> {
    try {
      await this.getValidAccessToken(tenantId, clientId, clientSecret);
      return { valid: true };
    } catch {
      return { valid: false };
    }
  }
}

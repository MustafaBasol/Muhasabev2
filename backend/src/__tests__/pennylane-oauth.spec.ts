import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PennylaneOAuthService } from '../integrations/pennylane/services/pennylane-oauth.service';
import { ProviderAccountService } from '../integrations/common/services/provider-account.service';
import { PROVIDER_KEYS } from '../integrations/common/types/integration.types';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-abc';
const CLIENT_ID = 'client-001';
const CLIENT_SECRET = 'secret-xyz';
const REDIRECT_URI = 'https://app.comptario.com/integrations/pennylane/oauth/callback';

const NOW_SEC = Math.floor(Date.now() / 1000);

// ─── Mock ProviderAccountService ─────────────────────────────────────────────

const mockProviderAccountService = {
  findWithTokens: jest.fn(),
  findByTenantAndProvider: jest.fn(),
  upsert: jest.fn(),
  disconnect: jest.fn(),
};

// ─── axios mock ──────────────────────────────────────────────────────────────

jest.mock('axios', () => ({
  post: jest.fn(),
}));

import axios from 'axios';
const mockedAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('PennylaneOAuthService (unit)', () => {
  let service: PennylaneOAuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PennylaneOAuthService,
        { provide: ProviderAccountService, useValue: mockProviderAccountService },
      ],
    }).compile();

    service = module.get<PennylaneOAuthService>(PennylaneOAuthService);
  });

  // ─── getAuthorizationUrl ──────────────────────────────────────────────────

  describe('getAuthorizationUrl', () => {
    it('geçerli OAuth URL döner', () => {
      const url = service.getAuthorizationUrl(CLIENT_ID, REDIRECT_URI, TENANT_ID);

      expect(url).toContain('https://app.pennylane.com/oauth/authorize');
      expect(url).toContain(`client_id=${CLIENT_ID}`);
      expect(url).toContain(`redirect_uri=`);
      expect(url).toContain(`response_type=code`);
      expect(url).toContain(`state=${TENANT_ID}`);
    });

    it('scope parametresi içerir', () => {
      const url = service.getAuthorizationUrl(CLIENT_ID, REDIRECT_URI, TENANT_ID);
      expect(url).toContain('scope=');
    });
  });

  // ─── handleCallback ───────────────────────────────────────────────────────

  describe('handleCallback', () => {
    const tokenResponse = {
      data: {
        access_token: 'access-token-abc',
        refresh_token: 'refresh-token-xyz',
        expires_in: 7200,
        created_at: NOW_SEC,
        token_type: 'Bearer',
        scope: 'customer_invoices:all',
      },
    };

    it('başarılı token alışverişinde upsert çağrılır', async () => {
      mockedAxiosPost.mockResolvedValueOnce(tokenResponse);
      mockProviderAccountService.upsert.mockResolvedValueOnce(undefined);

      await service.handleCallback({
        code: 'auth-code-123',
        tenantId: TENANT_ID,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI,
      });

      expect(mockedAxiosPost).toHaveBeenCalledTimes(1);
      expect(mockProviderAccountService.upsert).toHaveBeenCalledWith(
        TENANT_ID,
        PROVIDER_KEYS.PENNYLANE,
        expect.objectContaining({
          accessToken: 'access-token-abc',
          refreshToken: 'refresh-token-xyz',
        }),
      );
    });

    it('Pennylane HTTP hatası → UnauthorizedException fırlatır', async () => {
      mockedAxiosPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.handleCallback({
          code: 'bad-code',
          tenantId: TENANT_ID,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          redirectUri: REDIRECT_URI,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── getValidAccessToken ──────────────────────────────────────────────────

  describe('getValidAccessToken', () => {
    it('token geçerliyse direkt döner', async () => {
      const futureExpiry = new Date(Date.now() + 60 * 60 * 1000); // +1 saat
      mockProviderAccountService.findWithTokens.mockResolvedValueOnce({
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: futureExpiry,
      });

      const token = await service.getValidAccessToken(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
      expect(token).toBe('valid-token');
      expect(mockedAxiosPost).not.toHaveBeenCalled();
    });

    it('token süresi dolmak üzereyse refresh yapılır', async () => {
      const nearExpiry = new Date(Date.now() + 2 * 60 * 1000); // +2 dakika (buffer 5 dk)
      mockProviderAccountService.findWithTokens.mockResolvedValueOnce({
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: nearExpiry,
      });

      const refreshResponse = {
        data: {
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 7200,
          created_at: NOW_SEC,
          token_type: 'Bearer',
          scope: '',
        },
      };
      mockedAxiosPost.mockResolvedValueOnce(refreshResponse);
      mockProviderAccountService.upsert.mockResolvedValueOnce(undefined);

      const token = await service.getValidAccessToken(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
      expect(token).toBe('new-token');
    });

    it('hesap bulunamazsa UnauthorizedException fırlatır', async () => {
      mockProviderAccountService.findWithTokens.mockResolvedValueOnce(null);

      await expect(
        service.getValidAccessToken(TENANT_ID, CLIENT_ID, CLIENT_SECRET),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refresh token yoksa UnauthorizedException fırlatır', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      mockProviderAccountService.findWithTokens.mockResolvedValueOnce({
        accessToken: 'old-token',
        refreshToken: null,
        tokenExpiresAt: pastExpiry,
      });

      await expect(
        service.getValidAccessToken(TENANT_ID, CLIENT_ID, CLIENT_SECRET),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── getConnectionStatus ──────────────────────────────────────────────────

  describe('getConnectionStatus', () => {
    it('hesap yoksa { connected: false } döner', async () => {
      mockProviderAccountService.findByTenantAndProvider.mockResolvedValueOnce(null);

      const result = await service.getConnectionStatus(TENANT_ID);
      expect(result).toEqual({ connected: false });
    });

    it('bağlı hesap için { connected: true, connectedAt } döner', async () => {
      const connectedAt = new Date('2024-05-01T10:00:00.000Z');
      mockProviderAccountService.findByTenantAndProvider.mockResolvedValueOnce({
        connectionStatus: 'connected',
        lastConnectedAt: connectedAt,
      });

      const result = await service.getConnectionStatus(TENANT_ID);
      expect(result.connected).toBe(true);
      expect(result.connectedAt).toBe('2024-05-01T10:00:00.000Z');
    });

    it('bağlı olmayan hesap için { connected: false } döner', async () => {
      mockProviderAccountService.findByTenantAndProvider.mockResolvedValueOnce({
        connectionStatus: 'disconnected',
        lastConnectedAt: null,
      });

      const result = await service.getConnectionStatus(TENANT_ID);
      expect(result.connected).toBe(false);
    });
  });

  // ─── disconnect ───────────────────────────────────────────────────────────

  describe('disconnect', () => {
    it('providerAccountService.disconnect çağrılır', async () => {
      mockProviderAccountService.disconnect.mockResolvedValueOnce(undefined);

      await service.disconnect(TENANT_ID);

      expect(mockProviderAccountService.disconnect).toHaveBeenCalledWith(
        TENANT_ID,
        PROVIDER_KEYS.PENNYLANE,
      );
    });
  });
});

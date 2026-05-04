import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import {
  IOPOLE_DEFAULT_AUTH_URL,
  IopoleTokenResponse,
} from '../types/iopole.types';

@Injectable()
export class IopoleAuthService {
  private readonly logger = new Logger(IopoleAuthService.name);
  private cachedAccessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  private sanitizeSensitiveText(input: string): string {
    return input
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
      .replace(/(access_token["']?\s*[:=]\s*["']?)([^"'\s,&}]+)/gi, '$1[REDACTED]')
      .replace(/(client_secret["']?\s*[:=]\s*["']?)([^"'\s,&}]+)/gi, '$1[REDACTED]');
  }

  async getAccessToken(): Promise<string> {
    this.ensureEnabled();

    if (
      this.cachedAccessToken &&
      Date.now() < this.accessTokenExpiresAt - 60_000
    ) {
      return this.cachedAccessToken;
    }

    const clientId = process.env.IOPOLE_CLIENT_ID;
    const clientSecret = process.env.IOPOLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'IOPOLE_CLIENT_ID ve IOPOLE_CLIENT_SECRET tanımlı değil.',
      );
    }

    try {
      const response = await axios.post<IopoleTokenResponse>(
        process.env.IOPOLE_AUTH_URL ?? IOPOLE_DEFAULT_AUTH_URL,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          timeout: 15_000,
        },
      );

      this.cachedAccessToken = response.data.access_token;
      this.accessTokenExpiresAt =
        Date.now() + Math.max(response.data.expires_in, 60) * 1000;

      return response.data.access_token;
    } catch (error) {
      const detail = this.sanitizeSensitiveText(
        axios.isAxiosError(error)
          ? JSON.stringify(error.response?.data ?? error.message)
          : String(error),
      );

      this.logger.error(`Iopole token alma hatası: ${detail}`);
      throw new InternalServerErrorException('Iopole access token alınamadı.');
    }
  }

  ensureEnabled(): void {
    if (process.env.IOPOLE_ENABLED !== 'true') {
      throw new ForbiddenException('Iopole integration disabled.');
    }
  }
}
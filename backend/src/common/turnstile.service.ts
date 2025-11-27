import { Injectable } from '@nestjs/common';

@Injectable()
export class TurnstileService {
  private warnedMissingSecret = false;
  private warnedBypassToken = false;

  private readonly turnstileEndpoint =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  private getSecret(): string {
    return (process.env.TURNSTILE_SECRET_KEY || '').trim();
  }

  isEnabled(): boolean {
    return this.getSecret().length > 0;
  }

  async verify(token?: string, ip?: string): Promise<boolean> {
    const secret = this.getSecret();
    if (!secret) {
      if (!this.warnedMissingSecret) {
        console.warn(
          '⚠️ TURNSTILE_SECRET_KEY missing – Turnstile verification skipped (fail-open).',
        );
        this.warnedMissingSecret = true;
      }
      return true;
    }
    if (!token) {
      return false;
    }
    if (token === 'TURNSTILE_SKIPPED') {
      if (this.isDevBypassEnabled()) {
        if (!this.warnedBypassToken) {
          console.warn(
            '⚠️ Turnstile dev bypass token accepted (TURNSTILE_SKIPPED). Disable TURNSTILE_DEV_BYPASS for production.',
          );
          this.warnedBypassToken = true;
        }
        return true;
      }
      return false;
    }
    try {
      const params = new URLSearchParams();
      params.append('secret', secret);
      params.append('response', token);
      if (ip) {
        params.append('remoteip', ip);
      }
      const res = await fetch(this.turnstileEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (!res.ok) {
        return false;
      }
      const payload: unknown = await res.json().catch(() => null);
      const data = this.parseResponse(payload);
      const success = data?.success === true;
      if (!success && this.shouldLogVerbose()) {
        console.warn('Turnstile failure details:', data);
      }
      return success;
    } catch (error) {
      if (this.shouldLogVerbose()) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.warn(
          '⚠️ Turnstile verification error (treat as failure):',
          errorMessage,
        );
      }
      return false;
    }
  }

  private parseResponse(payload: unknown): TurnstileVerifyResponse | null {
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }
    const record = payload as Record<string, unknown>;
    return {
      success: record.success === true,
      'error-codes': Array.isArray(record['error-codes'])
        ? (record['error-codes'] as string[])
        : undefined,
      challenge_ts:
        typeof record.challenge_ts === 'string'
          ? record.challenge_ts
          : undefined,
      hostname:
        typeof record.hostname === 'string' ? record.hostname : undefined,
      action: typeof record.action === 'string' ? record.action : undefined,
      cdata: typeof record.cdata === 'string' ? record.cdata : undefined,
    };
  }

  private shouldLogVerbose(): boolean {
    return (process.env.TURNSTILE_LOG_VERBOSE || '').toLowerCase() === 'true';
  }

  private isDevBypassEnabled(): boolean {
    const flag =
      process.env.TURNSTILE_DEV_BYPASS ??
      process.env.CAPTCHA_DEV_BYPASS ??
      process.env.VITE_CAPTCHA_DEV_BYPASS ??
      '';
    const normalized = flag.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
    const isCodespace = Boolean(process.env.CODESPACE_NAME);
    return isCodespace && nodeEnv !== 'production';
  }
}

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

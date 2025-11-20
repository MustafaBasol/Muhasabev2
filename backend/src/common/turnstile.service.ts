import { Injectable } from '@nestjs/common';

@Injectable()
export class TurnstileService {
  private warnedMissingSecret = false;

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
      return false;
    }
    try {
      const params = new URLSearchParams();
      params.append('secret', secret);
      params.append('response', token);
      if (ip) {
        params.append('remoteip', ip);
      }
      const res = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        },
      );
      if (!res.ok) {
        return false;
      }
      const data: any = await res.json().catch(() => ({}));
      const success = data?.success === true;
      if (!success && (process.env.TURNSTILE_LOG_VERBOSE || '').toLowerCase() === 'true') {
        console.warn('Turnstile failure details:', data);
      }
      return success;
    } catch (error) {
      if ((process.env.TURNSTILE_LOG_VERBOSE || '').toLowerCase() === 'true') {
        console.warn(
          '⚠️ Turnstile verification error (treat as failure):',
          (error as any)?.message,
        );
      }
      return false;
    }
  }
}

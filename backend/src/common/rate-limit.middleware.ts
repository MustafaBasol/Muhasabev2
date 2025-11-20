import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly rateLimitStore = new Map<string, RateLimitEntry>();
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly MAX_REQUESTS = 5; // default fallback
  private readonly ADMIN_IP_ALLOWLIST = [
    '127.0.0.1',
    '::1',
    'localhost',
    // Add more allowed IPs from environment
    ...(process.env.ADMIN_ALLOWED_IPS?.split(',') || []),
  ];

  use(req: Request, res: Response, next: NextFunction) {
    const clientIP = this.getClientIP(req);
    const isAuthEndpoint = this.isAuthEndpoint(req.path);
    const perRouteLimit = this.getPerRouteLimit(req.path);
    const isPublicInviteEndpoint = perRouteLimit.key.startsWith('public-invite');
    const isAdminEndpoint = this.isAdminEndpoint(req.path);
    const isWebhookEndpoint = this.isWebhookEndpoint(req.path);

    // Admin API IP kontrolü
    if (isAdminEndpoint && !this.isIPAllowed(clientIP)) {
      throw new HttpException(
        {
          error: 'Forbidden',
          message: 'Admin API access denied from this IP',
          statusCode: HttpStatus.FORBIDDEN,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Auth ve Webhook endpoint'ler için rate limiting
    if (isAuthEndpoint || isWebhookEndpoint || isPublicInviteEndpoint) {
      const scope = isWebhookEndpoint
        ? 'webhook'
        : isPublicInviteEndpoint
          ? 'invite'
          : 'auth';
      const rateLimitKey = `${scope}:${perRouteLimit.key}:${clientIP}`;
      const currentTime = Date.now();

      // Mevcut rate limit entry'yi al veya yeni oluştur
      let entry = this.rateLimitStore.get(rateLimitKey);

      if (!entry) {
        entry = {
          count: 1,
          firstAttempt: currentTime,
          lastAttempt: currentTime,
        };
        this.rateLimitStore.set(rateLimitKey, entry);
      } else {
        // Zaman penceresi geçtiyse reset et
        if (currentTime - entry.firstAttempt > this.RATE_LIMIT_WINDOW) {
          entry.count = 1;
          entry.firstAttempt = currentTime;
          entry.lastAttempt = currentTime;
        } else {
          entry.count++;
          entry.lastAttempt = currentTime;
        }
      }

      // Rate limit aşıldıysa hata fırlat
      const limit = perRouteLimit.limit ?? this.MAX_REQUESTS;
      if (entry.count > limit) {
        const resetTime = entry.firstAttempt + this.RATE_LIMIT_WINDOW;
        const remainingTime = Math.ceil((resetTime - currentTime) / 1000);

        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
        res.setHeader('Retry-After', remainingTime);

        throw new HttpException(
          {
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${remainingTime} seconds.`,
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Rate limit headers ekle
      const limit2 = perRouteLimit.limit ?? this.MAX_REQUESTS;
      res.setHeader('X-RateLimit-Limit', limit2);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit2 - entry.count));
      res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil((entry.firstAttempt + this.RATE_LIMIT_WINDOW) / 1000),
      );
    }

    // Periodik cleanup (her 5 dakikada bir)
    if (Math.random() < 0.01) {
      // 1% chance per request
      this.cleanupExpiredEntries();
    }

    next();
  }

  /**
   * Client IP adresini güvenli şekilde al
   */
  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIP = req.headers['x-real-ip'] as string;
    const cfConnectingIP = req.headers['cf-connecting-ip'] as string;

    // Cloudflare, proxy headers'dan IP al
    if (cfConnectingIP) return cfConnectingIP;
    if (realIP) return realIP;
    if (forwarded) return forwarded.split(',')[0].trim();

    return (
      req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown'
    );
  }

  /**
   * Auth endpoint kontrolü
   */
  private isAuthEndpoint(path: string): boolean {
    const authPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/admin-login',
      '/auth/verify-2fa',
      '/users/2fa/verify',
      // Yeni akış uç noktaları (rate-limit kapsamına al)
      '/auth/signup',
      '/auth/verify',
      '/auth/forgot',
      '/auth/reset',
      '/auth/resend-verification',
      '/auth/forgot-password', // geriye uyumluluk
      '/auth/reset-password', // geriye uyumluluk
    ];
    return authPaths.some((authPath) => path.includes(authPath));
  }

  /**
   * Route bazlı limitleri env'den oku
   */
  private getPerRouteLimit(path: string): { key: string; limit?: number } {
    // default
    const out = { key: 'generic', limit: undefined as number | undefined };
    const norm = path.toLowerCase();
    const n = (name: string, d: number) => {
      const v = Number((process.env[name] || '').trim());
      return Number.isFinite(v) && v > 0 ? v : d;
    };
    if (norm.includes('/auth/signup') || norm.includes('/auth/register')) {
      return { key: 'signup', limit: n('SIGNUP_RATE_LIMIT', 5) };
    }
    if (
      norm.includes('/auth/forgot') ||
      norm.includes('/auth/forgot-password')
    ) {
      return { key: 'forgot', limit: n('FORGOT_RATE_LIMIT', 5) };
    }
    if (norm.includes('/auth/reset') || norm.includes('/auth/reset-password')) {
      return { key: 'reset', limit: n('RESET_RATE_LIMIT', 10) };
    }
    if (norm.includes('/auth/verify') || norm.includes('/auth/verify-email')) {
      return { key: 'verify', limit: n('VERIFY_RATE_LIMIT', 20) };
    }
    if (norm.includes('/auth/resend-verification')) {
      return { key: 'resend', limit: n('RESEND_RATE_LIMIT', 3) };
    }
    if (norm.includes('/public/invites') && norm.includes('/register')) {
      return {
        key: 'public-invite-complete',
        limit: n('PUBLIC_INVITE_COMPLETE_RATE_LIMIT', 5),
      };
    }
    if (norm.includes('/public/invites')) {
      return {
        key: 'public-invite-lookup',
        limit: n('PUBLIC_INVITE_LOOKUP_RATE_LIMIT', 8),
      };
    }
    if (norm.includes('/webhooks/ses/sns')) {
      return { key: 'sns-webhook', limit: n('WEBHOOK_SNS_RATE_LIMIT', 120) };
    }
    return out;
  }

  /**
   * Admin endpoint kontrolü
   */
  private isAdminEndpoint(path: string): boolean {
    return path.startsWith('/admin') || path.includes('admin-login');
  }

  /**
   * Webhook endpoint kontrolü
   */
  private isWebhookEndpoint(path: string): boolean {
    return path.startsWith('/webhooks/ses');
  }

  /**
   * IP allowlist kontrolü
   */
  private isIPAllowed(ip: string): boolean {
    return (
      this.ADMIN_IP_ALLOWLIST.includes(ip) ||
      this.ADMIN_IP_ALLOWLIST.includes('0.0.0.0')
    ); // Allow all if configured
  }

  /**
   * Expired entries'leri temizle
   */
  private cleanupExpiredEntries(): void {
    const currentTime = Date.now();
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (currentTime - entry.firstAttempt > this.RATE_LIMIT_WINDOW) {
        this.rateLimitStore.delete(key);
      }
    }
  }
}

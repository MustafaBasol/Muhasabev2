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
  private readonly MAX_REQUESTS = 5; // 5 requests per minute
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
    const isAdminEndpoint = this.isAdminEndpoint(req.path);

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

    // Auth endpoint'ler için rate limiting
    if (isAuthEndpoint) {
      const rateLimitKey = `auth:${clientIP}`;
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
      if (entry.count > this.MAX_REQUESTS) {
        const resetTime = entry.firstAttempt + this.RATE_LIMIT_WINDOW;
        const remainingTime = Math.ceil((resetTime - currentTime) / 1000);

        res.setHeader('X-RateLimit-Limit', this.MAX_REQUESTS);
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
      res.setHeader('X-RateLimit-Limit', this.MAX_REQUESTS);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, this.MAX_REQUESTS - entry.count),
      );
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
    ];
    return authPaths.some((authPath) => path.includes(authPath));
  }

  /**
   * Admin endpoint kontrolü
   */
  private isAdminEndpoint(path: string): boolean {
    return path.startsWith('/admin') || path.includes('admin-login');
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

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CSRFMiddleware implements NestMiddleware {
  private static readonly logger = new Logger('CSRFMiddleware');
  private readonly TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
  // Stateless CSRF: the token is an HMAC-signed payload, so verification needs
  // no server-side store and works across multiple instances / restarts —
  // provided CSRF_SECRET is shared. A per-process random fallback only works
  // for single-instance dev; warn loudly if it is missing in production.
  private readonly SECRET = (() => {
    const fromEnv = process.env.CSRF_SECRET;
    if (fromEnv && fromEnv.length >= 16) return fromEnv;
    if (process.env.NODE_ENV === 'production') {
      CSRFMiddleware.logger.error(
        'CSRF_SECRET is not set (or too short) in production. CSRF tokens will not validate across instances/restarts. Set a strong CSRF_SECRET.',
      );
    }
    return crypto.randomBytes(32).toString('hex');
  })();

  use(req: Request, res: Response, next: NextFunction) {
    const isProtectedMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
      req.method,
    );
    const isCSRFProtectedRoute = this.needsCSRFProtection(req.path);

    // Her istek için (GET dahil) korunan rotalarda geçerli bir token üret ve döndür
    if (isCSRFProtectedRoute) {
      const sessionId = this.getOrCreateSessionId(req, res);
      // Stateless: her yanıtta taze imzalı token üret (sunucu tarafı depo yok)
      res.setHeader('X-CSRF-Token', this.generateCSRFToken(sessionId));
    }

    // Protected method'larda token doğrula
    if (isProtectedMethod && isCSRFProtectedRoute && this.shouldEnforceCSRF()) {
      const sessionId = this.getSessionId(req);
      const providedToken = this.getHeaderValue(req, 'x-csrf-token');

      if (!sessionId || !providedToken) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'CSRF token missing',
          statusCode: 403,
        });
      }

      const result = this.validateCSRFToken(providedToken, sessionId);
      if (result !== 'ok') {
        return res.status(403).json({
          error: 'Forbidden',
          message:
            result === 'expired' ? 'CSRF token expired' : 'Invalid CSRF token',
          statusCode: 403,
        });
      }
    }

    next();
  }

  /**
   * CSRF doğrulamasını development/test dışındaki tüm ortamlarda (staging dahil)
   * zorunlu kıl. Acil durumda CSRF_ENFORCE=false ile kapatılabilir.
   */
  private shouldEnforceCSRF(): boolean {
    const flag = (process.env.CSRF_ENFORCE || '').trim().toLowerCase();
    if (flag === 'false' || flag === '0' || flag === 'off') return false;
    if (flag === 'true' || flag === '1' || flag === 'on') return true;
    const env = process.env.NODE_ENV;
    return env !== 'development' && env !== 'test';
  }

  /**
   * CSRF koruması gerektiren route'ları belirle
   */
  private needsCSRFProtection(path: string): boolean {
    // Global prefix '/api' varsa normalize et
    const normalizedPath = path.startsWith('/api/') ? path.substring(4) : path;

    // Automation-friendly exception: blog admin endpoints are protected by admin-token,
    // and may be called by non-browser clients (n8n) without cookie-based CSRF state.
    if (normalizedPath.startsWith('/admin/blog-posts')) {
      return false;
    }
    if (normalizedPath.startsWith('/admin/blog-assets')) {
      return false;
    }
    const protectedPaths = [
      '/admin',
      '/users/2fa',
      '/auth/change-password',
      '/tenants/settings',
      '/products',
      '/customers',
      '/suppliers',
      '/invoices',
      '/expenses',
    ];

    return protectedPaths.some((protectedPath) =>
      normalizedPath.startsWith(protectedPath),
    );
  }

  /**
   * Session ID al veya oluştur
   */
  private getOrCreateSessionId(req: Request, res: Response): string {
    let sessionId = this.getCookie(req, 'csrf-session');

    if (!sessionId) {
      sessionId = crypto.randomBytes(32).toString('hex');
      res.cookie('csrf-session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: this.TOKEN_EXPIRY,
      });
    }

    return sessionId;
  }

  /**
   * Mevcut session ID'yi al
   */
  private getSessionId(req: Request): string | undefined {
    return this.getCookie(req, 'csrf-session');
  }

  /**
   * CSRF token oluştur (stateless, HMAC imzalı)
   */
  private generateCSRFToken(sessionId: string): string {
    const timestamp = Date.now().toString();
    const randomValue = crypto.randomBytes(16).toString('hex');
    const payload = `${sessionId}:${timestamp}:${randomValue}`;
    const signature = this.sign(payload);
    return Buffer.from(`${payload}:${signature}`).toString('base64');
  }

  /**
   * CSRF token doğrula (stateless): imza + oturum bağı + süre kontrolü.
   * Sunucu tarafı depo gerektirmez; paylaşılan CSRF_SECRET ile çok-instance
   * ortamda çalışır.
   */
  private validateCSRFToken(
    providedToken: string,
    sessionId: string,
  ): 'ok' | 'expired' | 'invalid' {
    let decoded: string;
    try {
      decoded = Buffer.from(providedToken, 'base64').toString('utf8');
    } catch {
      return 'invalid';
    }
    // payload = sessionId:timestamp:random ; sonra imza
    const lastSep = decoded.lastIndexOf(':');
    if (lastSep < 0) return 'invalid';
    const payload = decoded.slice(0, lastSep);
    const signature = decoded.slice(lastSep + 1);

    const expectedSig = this.sign(payload);
    if (!this.timingSafeEqualStr(signature, expectedSig)) return 'invalid';

    const parts = payload.split(':');
    if (parts.length !== 3) return 'invalid';
    const [tokenSessionId, timestampStr] = parts;

    // Token, isteği yapan oturuma (cookie) bağlı olmalı
    if (!this.timingSafeEqualStr(tokenSessionId, sessionId)) return 'invalid';

    const timestamp = Number(timestampStr);
    if (!Number.isFinite(timestamp)) return 'invalid';
    if (Date.now() - timestamp > this.TOKEN_EXPIRY) return 'expired';

    return 'ok';
  }

  private sign(payload: string): string {
    return crypto.createHmac('sha256', this.SECRET).update(payload).digest('hex');
  }

  private timingSafeEqualStr(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    try {
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  private getCookie(req: Request, key: string): string | undefined {
    const cookies: unknown = req.cookies;
    if (cookies && typeof cookies === 'object') {
      const record = cookies as Record<string, unknown>;
      const value = record[key];
      return typeof value === 'string' ? value : undefined;
    }
    return undefined;
  }

  private getHeaderValue(req: Request, header: string): string | undefined {
    const candidate = req.headers?.[header.toLowerCase()];
    if (typeof candidate === 'string') {
      return candidate;
    }
    if (Array.isArray(candidate)) {
      return candidate[0];
    }
    return undefined;
  }
}

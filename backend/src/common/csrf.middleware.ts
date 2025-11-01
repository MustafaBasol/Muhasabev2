import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

interface CSRFTokenStore {
  [sessionId: string]: {
    token: string;
    expires: number;
  };
}

@Injectable()
export class CSRFMiddleware implements NestMiddleware {
  private readonly tokenStore: CSRFTokenStore = {};
  private readonly TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
  private readonly SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');

  use(req: Request, res: Response, next: NextFunction) {
    const isProtectedMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const isCSRFProtectedRoute = this.needsCSRFProtection(req.path);

    // GET isteklerinde token üret ve header'a ekle
    if (req.method === 'GET' && isCSRFProtectedRoute) {
      const sessionId = this.getOrCreateSessionId(req, res);
      const csrfToken = this.generateCSRFToken(sessionId);
      
      // Token'ı response header'ına ekle
      res.setHeader('X-CSRF-Token', csrfToken);
      
      // Token'ı store'da sakla
      this.tokenStore[sessionId] = {
        token: csrfToken,
        expires: Date.now() + this.TOKEN_EXPIRY
      };
    }

    // Protected method'larda token doğrula
    if (isProtectedMethod && isCSRFProtectedRoute) {
      const sessionId = this.getSessionId(req);
      const providedToken = req.headers['x-csrf-token'] as string;

      if (!sessionId || !providedToken) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'CSRF token missing',
          statusCode: 403
        });
      }

      const storedTokenData = this.tokenStore[sessionId];
      
      if (!storedTokenData || storedTokenData.expires < Date.now()) {
        return res.status(403).json({
          error: 'Forbidden', 
          message: 'CSRF token expired',
          statusCode: 403
        });
      }

      if (!this.verifyCSRFToken(providedToken, storedTokenData.token)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid CSRF token',
          statusCode: 403
        });
      }
    }

    // Expired token'ları temizle (periodic cleanup)
    if (Math.random() < 0.1) { // 10% chance per request
      this.cleanupExpiredTokens();
    }

    next();
  }

  /**
   * CSRF koruması gerektiren route'ları belirle
   */
  private needsCSRFProtection(path: string): boolean {
    // Global prefix '/api' varsa normalize et
    const normalizedPath = path.startsWith('/api/') ? path.substring(4) : path;
    const protectedPaths = [
      '/admin',
      '/users/2fa',
      '/auth/change-password',
      '/tenants/settings',
      '/products',
      '/customers',
      '/suppliers',
      '/invoices',
      '/expenses'
    ];

    return protectedPaths.some(protectedPath => normalizedPath.startsWith(protectedPath));
  }

  /**
   * Session ID al veya oluştur
   */
  private getOrCreateSessionId(req: Request, res: Response): string {
    let sessionId = req.cookies?.['csrf-session'];
    
    if (!sessionId) {
      sessionId = crypto.randomBytes(32).toString('hex');
      res.cookie('csrf-session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: this.TOKEN_EXPIRY
      });
    }

    return sessionId;
  }

  /**
   * Mevcut session ID'yi al
   */
  private getSessionId(req: Request): string {
    return req.cookies?.['csrf-session'];
  }

  /**
   * CSRF token oluştur
   */
  private generateCSRFToken(sessionId: string): string {
    const timestamp = Date.now().toString();
    const randomValue = crypto.randomBytes(16).toString('hex');
    const payload = `${sessionId}:${timestamp}:${randomValue}`;
    
    const hmac = crypto.createHmac('sha256', this.SECRET);
    hmac.update(payload);
    const signature = hmac.digest('hex');
    
    return Buffer.from(`${payload}:${signature}`).toString('base64');
  }

  /**
   * CSRF token doğrula
   */
  private verifyCSRFToken(providedToken: string, expectedToken: string): boolean {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(providedToken),
        Buffer.from(expectedToken)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Expired token'ları temizle
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, tokenData] of Object.entries(this.tokenStore)) {
      if (tokenData.expires < now) {
        delete this.tokenStore[sessionId];
      }
    }
  }
}
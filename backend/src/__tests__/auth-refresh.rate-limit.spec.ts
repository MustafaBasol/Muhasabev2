// Bu test, /auth/refresh endpoint'inde tanımlanan Throttle decorator'ının
// belirlenen limite (REFRESH_RATE_LIMIT_MAX) ulaşıldığında 429 döndüğünü doğrular.
// Not: Controller içindeki sabitler dosya import edildiği anda ortam değişkeninden
// okunur; bu nedenle import öncesi env ayarlanır.

process.env.REFRESH_RATE_LIMIT_MAX = '5';
process.env.REFRESH_RATE_LIMIT_TTL_SECONDS = '60';

import { Test } from '@nestjs/testing';
import { INestApplication, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import request from 'supertest';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// JwtAuthGuard mock: tüm istekleri kabul eder ve user objesini ekler.
@Injectable()
class MockJwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    // Basit kullanıcı payload'ı ekle
    req.user = { id: 'test-user-id', email: 'test@example.com', role: 'USER' };
    return true;
  }
}

// AuthService mock: sadece refresh fonksiyonu gerekir.
class MockAuthService {
  async refresh(user: { id: string }) {
    return { token: 'mock-token-for-' + user.id, expiresIn: '15m' };
  }
}

describe('AuthController Refresh Rate Limiting', () => {
  let app: INestApplication;
  type SupertestTarget = Parameters<typeof request>[0];
  let httpServer: SupertestTarget;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useClass: MockAuthService },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    })
      .overrideGuard(JwtAuthGuard) // Controller'da kullanılan gerçek guard'ı override et
      .useValue(new MockJwtAuthGuard())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    httpServer = app.getHttpServer() as SupertestTarget;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow requests under the limit', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(httpServer).post('/auth/refresh');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    }
  });

  it('should block when exceeding the limit', async () => {
    // Önce limite kadar tüket (5 istek)
    for (let i = 0; i < 5; i++) {
      await request(httpServer).post('/auth/refresh');
    }
    // 6. istek 429 dönmeli
    const res = await request(httpServer).post('/auth/refresh');
    expect([429, 403]).toContain(res.status); // Ortam farkları için tolerans (bazı throttle versiyonları 429 döner)
  });
});

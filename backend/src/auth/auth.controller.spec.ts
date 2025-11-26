import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  ThrottlerModule,
  ThrottlerGuard,
  ThrottlerException,
} from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// AuthService'i taklit ediyoruz (mock), çünkü sadece controller'ın davranışını test etmek istiyoruz.
const mockAuthService = {
  refresh: jest.fn().mockResolvedValue({ token: 'new-refreshed-token' }),
};

// Test ortamı için rate limit ayarları
const TEST_RATE_LIMIT = 5;
const TEST_RATE_TTL_SECONDS = 60;

describe('AuthController (Rate Limiting)', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        // Test için özel, düşük limitli bir Throttler yapılandırması kullanıyoruz.
        ThrottlerModule.forRoot([
          {
            ttl: TEST_RATE_TTL_SECONDS * 1000,
            limit: TEST_RATE_LIMIT,
          },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        // ThrottlerGuard'ı global bir guard olarak uyguluyoruz, tıpkı app.module.ts'deki gibi.
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    })
      // JwtAuthGuard'ı bu testte devre dışı bırakıyoruz, çünkü sadece rate limiting'e odaklanıyoruz.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    // Her testten sonra mock'ların sayacını sıfırla.
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /auth/refresh rate limiting', () => {
    it(`should allow up to ${TEST_RATE_LIMIT} requests within the time window`, async () => {
      const userPayload = { id: 'test-user-id', ip: '127.0.0.1' };

      // Limite kadar olan tüm isteklerin başarılı olmasını bekliyoruz.
      for (let i = 0; i < TEST_RATE_LIMIT; i++) {
        await expect(controller.refresh(userPayload)).resolves.toBeDefined();
      }

      // AuthService'in refresh metodunun tam olarak limit kadar çağrıldığını doğruluyoruz.
      expect(mockAuthService.refresh).toHaveBeenCalledTimes(TEST_RATE_LIMIT);
    });

    it(`should throw a ThrottlerException on the ${TEST_RATE_LIMIT + 1}th request`, async () => {
      const userPayload = { id: 'test-user-id', ip: '127.0.0.1' };

      // Önce izin verilen tüm hakları tüketiyoruz.
      for (let i = 0; i < TEST_RATE_LIMIT; i++) {
        await controller.refresh(userPayload);
      }

      // Limiti aşan bir sonraki isteğin ThrottlerException fırlatmasını bekliyoruz.
      await expect(controller.refresh(userPayload)).rejects.toThrow(
        ThrottlerException,
      );

      // AuthService'in refresh metodunun fazladan çağrılmadığını doğruluyoruz (guard engelledi).
      expect(mockAuthService.refresh).toHaveBeenCalledTimes(TEST_RATE_LIMIT);
    });
  });
});

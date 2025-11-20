import { AuthService } from './auth.service';
import { LoginAttemptsService } from './login-attempts.service';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';

// Minimal mock helpers
const mockUsersService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  validatePassword: jest.fn(),
  updateLastLogin: jest.fn(),
  update: jest.fn(),
  verifyTwoFactor: jest.fn(),
};
const mockTenantsService = { create: jest.fn(), findOne: jest.fn() };
const mockJwtService = { sign: jest.fn().mockReturnValue('jwt-token') };
const mockEmailService = { send: jest.fn() } as any;
const mockSecurityService = {
  evaluatePasswordStrength: jest.fn().mockReturnValue({ score: 4, suggestions: [] }),
  generateRandomString: jest.fn().mockReturnValue('RANDOMSTRING123456'),
};
const mockEvtRepo = { save: jest.fn(async (e:any)=>e), create: jest.fn((e:any)=>e) } as any;
const mockPrtRepo = { save: jest.fn(), create: jest.fn() } as any;
const mockAuditService = { log: jest.fn() } as any;
const mockOrgsService = { getUserOrganizations: jest.fn().mockResolvedValue([]), getOwnerTenantId: jest.fn() } as any;

describe('AuthService Turnstile & Captcha Flow', () => {
  let service: AuthService;

  beforeAll(() => {
    jest.spyOn(global, 'fetch').mockImplementation(async (_url: any, opts: any) => {
      const body = String(opts?.body || '');
      const token = /response=([^&]+)/.exec(body)?.[1];
      const success = token === 'valid-turnstile-token';
      return {
        ok: true,
        json: async () => ({ success }),
      } as any;
    });
  });

  beforeEach(() => {
    // Reset env before each test
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    process.env.LOGIN_FAILED_CAPTCHA_THRESHOLD = '3';
    mockUsersService.findByEmail.mockReset();
    mockUsersService.create.mockReset();
    mockUsersService.validatePassword.mockReset();
    mockTenantsService.create.mockReset();

    const attempts = new LoginAttemptsService();
    service = new AuthService(
      mockUsersService as any,
      mockTenantsService as any,
      mockJwtService as any,
      mockEmailService,
      mockSecurityService as any,
      mockEvtRepo,
      mockPrtRepo,
      mockAuditService,
      mockOrgsService,
      attempts,
    );
  });

  it('should reject register without turnstile token when secret configured', async () => {
    await expect(service.register({
      email: 'x@test.com',
      password: 'Password123',
      firstName: 'X',
      lastName: 'Y',
    } as any)).rejects.toThrow(BadRequestException);
  });

  it('should allow register with valid turnstile token', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);
    mockTenantsService.create.mockResolvedValue({ id: 't1', name: 'Tenant', slug: 'tenant', subscriptionPlan: 'free', status: 'active', maxUsers: 5 });
    mockUsersService.create.mockResolvedValue({ id: 'u1', email: 'x@test.com', firstName: 'X', lastName: 'Y', role: 'ADMIN', tenantId: 't1' });
    const res = await service.register({
      email: 'x@test.com',
      password: 'Password123',
      firstName: 'X',
      lastName: 'Y',
      turnstileToken: 'valid-turnstile-token'
    } as any);
    expect(res.user.email).toBe('x@test.com');
  });

  it('login should require captcha after threshold and then succeed with valid token', async () => {
    mockUsersService.findByEmail.mockResolvedValue({ id: 'u1', email: 'x@test.com', password: 'hash', isActive: true, firstName: 'X', lastName: 'Y', role: 'ADMIN', tenantId: 't1' });
    mockUsersService.validatePassword.mockResolvedValue(false); // simulate failures
    // 3 failed attempts
    for (let i=0;i<3;i++) {
      await expect(service.login({ email: 'x@test.com', password: 'bad' } as any, { ip: '127.0.0.1' })).rejects.toThrow();
    }
    // Now captcha required
    await expect(service.login({ email: 'x@test.com', password: 'bad' } as any, { ip: '127.0.0.1' })).rejects.toThrow(ForbiddenException);
    // Provide captcha but still bad password -> still invalid credentials (after verification). Password check first ensures captcha verified.
    await expect(service.login({ email: 'x@test.com', password: 'bad', turnstileToken: 'valid-turnstile-token' } as any, { ip: '127.0.0.1' })).rejects.toThrow(UnauthorizedException);
    // Successful attempt with correct password + captcha
    mockUsersService.validatePassword.mockResolvedValue(true);
    const ok = await service.login({ email: 'x@test.com', password: 'good', turnstileToken: 'valid-turnstile-token' } as any, { ip: '127.0.0.1' });
    expect(ok.user.email).toBe('x@test.com');
  });
});

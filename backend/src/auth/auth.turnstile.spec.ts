import { AuthService } from './auth.service';
import { LoginAttemptsService } from './login-attempts.service';
import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TurnstileService } from '../common/turnstile.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { UsersService } from './users.service';
import type { TenantsService } from '../tenants/tenants.service';
import type { JwtService } from '@nestjs/jwt';
import type { EmailService } from '../services/email.service';
import type { SecurityService } from '../common/security.service';
import type { AuditService } from '../audit/audit.service';
import type { OrganizationsService } from '../organizations/organizations.service';
import type { Repository } from 'typeorm';
import type { EmailVerificationToken } from './entities/email-verification-token.entity';
import type { PasswordResetToken } from './entities/password-reset-token.entity';

type MockFn<T extends (...args: any[]) => any> = jest.Mock<
  Awaited<ReturnType<T>>,
  Parameters<T>
>;

type UsersServiceMock = {
  findByEmail: MockFn<UsersService['findByEmail']>;
  create: MockFn<UsersService['create']>;
  validatePassword: MockFn<UsersService['validatePassword']>;
  updateLastLogin: MockFn<UsersService['updateLastLogin']>;
  update: MockFn<UsersService['update']>;
  verifyTwoFactor: MockFn<UsersService['verifyTwoFactor']>;
};

// Minimal mock helpers
const mockUsersService: UsersServiceMock = {
  findByEmail: jest.fn<
    Awaited<ReturnType<UsersService['findByEmail']>>,
    Parameters<UsersService['findByEmail']>
  >(),
  create: jest.fn<
    Awaited<ReturnType<UsersService['create']>>,
    Parameters<UsersService['create']>
  >(),
  validatePassword: jest.fn<
    Awaited<ReturnType<UsersService['validatePassword']>>,
    Parameters<UsersService['validatePassword']>
  >(),
  updateLastLogin: jest.fn<
    Awaited<ReturnType<UsersService['updateLastLogin']>>,
    Parameters<UsersService['updateLastLogin']>
  >(),
  update: jest.fn<
    Awaited<ReturnType<UsersService['update']>>,
    Parameters<UsersService['update']>
  >(),
  verifyTwoFactor: jest.fn<
    Awaited<ReturnType<UsersService['verifyTwoFactor']>>,
    Parameters<UsersService['verifyTwoFactor']>
  >(),
};
const mockTenantsService = { create: jest.fn(), findOne: jest.fn() };
const mockJwtService = { sign: jest.fn().mockReturnValue('jwt-token') };
const mockEmailService = { sendEmail: jest.fn() };
const mockSecurityService = {
  evaluatePasswordStrength: jest
    .fn()
    .mockReturnValue({ score: 4, suggestions: [] }),
  generateRandomString: jest.fn().mockReturnValue('RANDOMSTRING123456'),
};
const mockEvtRepo = {
  save: jest.fn(async <T>(entity: T) => entity),
  create: jest.fn(<T>(entity: T) => entity),
};
const mockPrtRepo = {
  save: jest.fn(async <T>(entity: T) => entity),
  create: jest.fn(<T>(entity: T) => entity),
};
const mockAuditService = { log: jest.fn() };
const mockOrgsService = {
  getUserOrganizations: jest.fn().mockResolvedValue([]),
  getOwnerTenantId: jest.fn(),
};

const ensureObjectMock = <T extends object>(
  mock: Record<string, unknown>,
): T => {
  if (!mock || typeof mock !== 'object') {
    throw new TypeError('Mock dependencies must be objects');
  }
  return mock as T;
};

const ensureUsersService = (mock: UsersServiceMock): UsersService => {
  const requiredMethods: (keyof UsersServiceMock)[] = [
    'findByEmail',
    'create',
    'validatePassword',
    'updateLastLogin',
    'update',
    'verifyTwoFactor',
  ];
  for (const method of requiredMethods) {
    if (typeof mock[method] !== 'function') {
      throw new TypeError(`UsersService mock missing method ${method}`);
    }
  }
  return mock as unknown as UsersService;
};

const usersServiceStub = ensureUsersService(mockUsersService);
const tenantsServiceStub = ensureObjectMock<TenantsService>(mockTenantsService);
const jwtServiceStub = ensureObjectMock<JwtService>(mockJwtService);
const emailServiceStub = ensureObjectMock<EmailService>(mockEmailService);
const securityServiceStub =
  ensureObjectMock<SecurityService>(mockSecurityService);
const evtRepoStub =
  ensureObjectMock<Repository<EmailVerificationToken>>(mockEvtRepo);
const prtRepoStub =
  ensureObjectMock<Repository<PasswordResetToken>>(mockPrtRepo);
const auditServiceStub = ensureObjectMock<AuditService>(mockAuditService);
const orgsServiceStub = ensureObjectMock<OrganizationsService>(mockOrgsService);

const buildRegisterDto = (
  overrides: Partial<RegisterDto> = {},
): RegisterDto => ({
  email: 'x@test.com',
  password: 'Password123',
  firstName: 'X',
  lastName: 'Y',
  ...overrides,
});

const buildLoginDto = (overrides: Partial<LoginDto> = {}): LoginDto => ({
  email: 'x@test.com',
  password: 'bad',
  ...overrides,
});

describe('AuthService Turnstile & Captcha Flow', () => {
  let service: AuthService;

  beforeAll(() => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(
        async (
          _url: Parameters<typeof fetch>[0],
          opts?: Parameters<typeof fetch>[1],
        ) => {
          const bodyRaw = opts?.body;
          const serializedBody =
            typeof bodyRaw === 'string'
              ? bodyRaw
              : bodyRaw instanceof URLSearchParams
                ? bodyRaw.toString()
                : '';
          const token = /response=([^&]+)/.exec(serializedBody)?.[1];
          const success = token === 'valid-turnstile-token';
          const mockResponse = {
            ok: true,
            json: async () => ({ success }),
          } satisfies Pick<Response, 'ok' | 'json'>;
          return mockResponse as Response;
        },
      );
  });

  beforeEach(() => {
    // Reset env before each test
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    process.env.LOGIN_FAILED_CAPTCHA_THRESHOLD = '3';
    mockUsersService.findByEmail.mockReset();
    mockUsersService.create.mockReset();
    mockUsersService.validatePassword.mockReset();
    mockTenantsService.create.mockReset();
    mockEmailService.sendEmail.mockReset();

    const attempts = new LoginAttemptsService();
    const turnstile = new TurnstileService();
    service = new AuthService(
      usersServiceStub,
      tenantsServiceStub,
      jwtServiceStub,
      emailServiceStub,
      securityServiceStub,
      turnstile,
      evtRepoStub,
      prtRepoStub,
      auditServiceStub,
      orgsServiceStub,
      attempts,
    );
  });

  it('should reject register without turnstile token when secret configured', async () => {
    await expect(service.register(buildRegisterDto())).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should allow register with valid turnstile token', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);
    mockTenantsService.create.mockResolvedValue({
      id: 't1',
      name: 'Tenant',
      slug: 'tenant',
      subscriptionPlan: 'free',
      status: 'active',
      maxUsers: 5,
    });
    mockUsersService.create.mockResolvedValue({
      id: 'u1',
      email: 'x@test.com',
      firstName: 'X',
      lastName: 'Y',
      role: 'ADMIN',
      tenantId: 't1',
    });
    const res = await service.register(
      buildRegisterDto({ turnstileToken: 'valid-turnstile-token' }),
    );
    expect(res.user.email).toBe('x@test.com');
  });

  it('login should require captcha after threshold and then succeed with valid token', async () => {
    mockUsersService.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'x@test.com',
      password: 'hash',
      isActive: true,
      firstName: 'X',
      lastName: 'Y',
      role: 'ADMIN',
      tenantId: 't1',
    });
    mockUsersService.validatePassword.mockResolvedValue(false); // simulate failures
    // 3 failed attempts
    for (let i = 0; i < 3; i++) {
      await expect(
        service.login(buildLoginDto(), { ip: '127.0.0.1' }),
      ).rejects.toThrow();
    }
    // Now captcha required
    await expect(
      service.login(buildLoginDto(), { ip: '127.0.0.1' }),
    ).rejects.toThrow(ForbiddenException);
    // Provide captcha but still bad password -> still invalid credentials (after verification). Password check first ensures captcha verified.
    await expect(
      service.login(
        buildLoginDto({ turnstileToken: 'valid-turnstile-token' }),
        { ip: '127.0.0.1' },
      ),
    ).rejects.toThrow(UnauthorizedException);
    // Successful attempt with correct password + captcha
    mockUsersService.validatePassword.mockResolvedValue(true);
    const ok = await service.login(
      buildLoginDto({
        password: 'good',
        turnstileToken: 'valid-turnstile-token',
      }),
      { ip: '127.0.0.1' },
    );
    expect(ok.user.email).toBe('x@test.com');
  });
});

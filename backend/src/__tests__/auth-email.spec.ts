import { createHash } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { SecurityService } from '../common/security.service';
import { AuditService } from '../audit/audit.service';
import { TurnstileService } from '../common/turnstile.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../services/email.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { LoginAttemptsService } from '../auth/login-attempts.service';
import { Repository } from 'typeorm';
import { EmailVerificationToken } from '../auth/entities/email-verification-token.entity';
import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';

// Minimal stubs
const usersService = {
  findByEmail: jest.fn(),
  update: jest.fn(),
  findOne: jest.fn(),
};
const tenantsService = {} as Record<string, never>;
const jwtService = {} as Record<string, never>;
const emailService = { sendEmail: jest.fn().mockResolvedValue(true) };
const securityService = new SecurityService();
const turnstileService = new TurnstileService();
const organizationsService = {
  getUserOrganizations: jest.fn().mockResolvedValue([]),
  acceptInvite: jest.fn(),
  validateInvite: jest.fn(),
  getOwnerTenantId: jest.fn(),
};
const attemptsService = {
  requireCaptcha: jest.fn().mockResolvedValue(false),
  increment: jest.fn(),
  reset: jest.fn(),
};

interface MockTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

type TokenQuery = {
  where: { userId: string };
  take?: number;
} & Record<string, unknown>;

type MockTokenRepo = {
  create: jest.Mock<MockTokenEntity, [Partial<MockTokenEntity>]>;
  find: jest.Mock<Promise<MockTokenEntity[]>, [TokenQuery]>;
  save: jest.Mock<
    Promise<MockTokenEntity | MockTokenEntity[]>,
    [MockTokenEntity | MockTokenEntity[]]
  >;
};

const makeEvtRepo = (tokens: MockTokenEntity[]): MockTokenRepo => {
  const create = jest
    .fn<MockTokenEntity, [Partial<MockTokenEntity>]>()
    .mockImplementation((data) => ({
      id: data.id ?? 'gen_' + Math.random().toString(36).slice(2, 8),
      userId: data.userId ?? 'unknown',
      tokenHash: data.tokenHash ?? '',
      expiresAt: data.expiresAt ?? new Date(),
      usedAt: data.usedAt ?? null,
      ...data,
    }));

  const find = jest
    .fn<Promise<MockTokenEntity[]>, [TokenQuery]>()
    .mockImplementation(async (query) => {
      const take = query?.take ?? 10;
      return tokens
        .filter((t) => t.userId === query.where.userId && !t.usedAt)
        .slice(0, take);
    });

  const save = jest
    .fn<
      Promise<MockTokenEntity | MockTokenEntity[]>,
      [MockTokenEntity | MockTokenEntity[]]
    >()
    .mockImplementation(async (entity) => {
      if (Array.isArray(entity)) {
        entity.forEach((e) => {
          const idx = tokens.findIndex((t) => t.id === e.id);
          if (idx >= 0) tokens[idx] = { ...tokens[idx], ...e };
        });
        return entity;
      }
      const idx = tokens.findIndex((t) => t.id === entity.id);
      if (idx >= 0) tokens[idx] = { ...tokens[idx], ...entity };
      else tokens.push(entity);
      return entity;
    });

  return { create, find, save };
};

const makePrtRepo = (tokens: MockTokenEntity[]): MockTokenRepo =>
  makeEvtRepo(tokens);

const auditService: Partial<AuditService> = {
  log: jest.fn().mockResolvedValue(undefined),
};

function sha256hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

describe('AuthService - Email Verification (hashed)', () => {
  it('verifies a valid token and invalidates others', async () => {
    const userId = 'u1';
    const raw = 'abc123xyz';
    const other = 'othertoken';
    const now = Date.now();
    const evtTokens: MockTokenEntity[] = [
      {
        id: 't1',
        userId,
        tokenHash: sha256hex(raw),
        expiresAt: new Date(now + 3600_000),
        usedAt: null,
      },
      {
        id: 't2',
        userId,
        tokenHash: sha256hex(other),
        expiresAt: new Date(now + 3600_000),
        usedAt: null,
      },
    ];
    const service = new AuthService(
      usersService as unknown as UsersService,
      tenantsService as unknown as TenantsService,
      jwtService as unknown as JwtService,
      emailService as unknown as EmailService,
      securityService,
      turnstileService,
      makeEvtRepo(evtTokens) as unknown as Repository<EmailVerificationToken>,
      makePrtRepo(
        [] as MockTokenEntity[],
      ) as unknown as Repository<PasswordResetToken>,
      auditService as unknown as AuditService,
      organizationsService as unknown as OrganizationsService,
      attemptsService as unknown as LoginAttemptsService,
    );
    usersService.update.mockResolvedValue(true);
    usersService.findOne.mockResolvedValue({
      id: userId,
      tenantId: 'tnt1',
    });

    const res = await service.verifyEmailHashed(raw, userId);
    expect(res).toEqual({ success: true });
    expect(usersService.update).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ isEmailVerified: true }),
    );
    // first token used
    expect(evtTokens[0].usedAt).toBeInstanceOf(Date);
    // other token also invalidated
    expect(evtTokens[1].usedAt).toBeInstanceOf(Date);
  });

  it('throws for invalid or expired token', async () => {
    const userId = 'u2';
    const evtTokens: MockTokenEntity[] = [];
    const service = new AuthService(
      usersService as unknown as UsersService,
      tenantsService as unknown as TenantsService,
      jwtService as unknown as JwtService,
      emailService as unknown as EmailService,
      securityService,
      turnstileService,
      makeEvtRepo(evtTokens) as unknown as Repository<EmailVerificationToken>,
      makePrtRepo(
        [] as MockTokenEntity[],
      ) as unknown as Repository<PasswordResetToken>,
      auditService as unknown as AuditService,
      organizationsService as unknown as OrganizationsService,
      attemptsService as unknown as LoginAttemptsService,
    );
    await expect(
      service.verifyEmailHashed('nope', userId),
    ).rejects.toBeTruthy();
  });
});

describe('AuthService - Resend verification cooldown', () => {
  it('applies 60s cooldown per email silently', async () => {
    const evtTokens: MockTokenEntity[] = [];
    const service = new AuthService(
      usersService as unknown as UsersService,
      tenantsService as unknown as TenantsService,
      jwtService as unknown as JwtService,
      emailService as unknown as EmailService,
      securityService,
      turnstileService,
      makeEvtRepo(evtTokens) as unknown as Repository<EmailVerificationToken>,
      makePrtRepo(
        [] as MockTokenEntity[],
      ) as unknown as Repository<PasswordResetToken>,
      auditService as unknown as AuditService,
      organizationsService as unknown as OrganizationsService,
      attemptsService as unknown as LoginAttemptsService,
    );
    usersService.findByEmail.mockResolvedValue({
      id: 'u3',
      email: 'a@b.c',
      firstName: 'A',
      lastName: 'B',
      tenantId: 't1',
    });

    await service.resendVerification('a@b.c');
    // immediate second call should not send another email
    emailService.sendEmail.mockClear();
    await service.resendVerification('a@b.c');
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });
});

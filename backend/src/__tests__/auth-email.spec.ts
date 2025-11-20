import { AuthService } from '../auth/auth.service';
import { SecurityService } from '../common/security.service';
import { AuditService } from '../audit/audit.service';
import { TurnstileService } from '../common/turnstile.service';

// Minimal stubs
const usersService = {
  findByEmail: jest.fn(),
  update: jest.fn(),
  findOne: jest.fn(),
};
const tenantsService = {} as any;
const jwtService = {} as any;
const emailService = { sendEmail: jest.fn().mockResolvedValue(true) } as any;
const securityService = new SecurityService();
const turnstileService = new TurnstileService();

// In-memory repos
function makeEvtRepo(tokens: any[]) {
  return {
    create: jest.fn().mockImplementation((data: any) => ({
      id: 'gen_' + Math.random().toString(36).slice(2, 8),
      ...data,
    })),
    find: jest.fn().mockImplementation((query: any) => {
      const take = query?.take ?? 10;
      return Promise.resolve(
        tokens
          .filter((t) => t.userId === query.where.userId && !t.usedAt)
          .slice(0, take),
      );
    }),
    save: jest.fn().mockImplementation(async (entity: any) => {
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
    }),
  } as any;
}

function makePrtRepo(tokens: any[]) {
  return makeEvtRepo(tokens);
}

const auditService: Partial<AuditService> = {
  log: jest.fn().mockResolvedValue(undefined) as any,
};

function sha256hex(input: string) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(input).digest('hex');
}

describe('AuthService - Email Verification (hashed)', () => {
  it('verifies a valid token and invalidates others', async () => {
    const userId = 'u1';
    const raw = 'abc123xyz';
    const other = 'othertoken';
    const now = Date.now();
    const evtTokens = [
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
      usersService as any,
      tenantsService,
      jwtService,
      emailService,
      securityService,
      turnstileService,
      makeEvtRepo(evtTokens),
      makePrtRepo([]),
      auditService as any,
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
    const evtTokens: any[] = [];
    const service = new AuthService(
      usersService as any,
      tenantsService,
      jwtService,
      emailService,
      securityService,
      turnstileService,
      makeEvtRepo(evtTokens),
      makePrtRepo([]),
      auditService as any,
    );
    await expect(
      service.verifyEmailHashed('nope', userId),
    ).rejects.toBeTruthy();
  });
});

describe('AuthService - Resend verification cooldown', () => {
  it('applies 60s cooldown per email silently', async () => {
    const evtTokens: any[] = [];
    const service = new AuthService(
      usersService as any,
      tenantsService,
      jwtService,
      emailService,
      securityService,
      turnstileService,
      makeEvtRepo(evtTokens),
      makePrtRepo([]),
      auditService as any,
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
    (emailService.sendEmail as jest.Mock).mockClear();
    await service.resendVerification('a@b.c');
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });
});

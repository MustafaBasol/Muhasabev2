import { Test } from '@nestjs/testing';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { ConfigModule } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

// Minimal UsersService mock
class MockUsersService {
  private user: any = {
    id: 'u1',
    isActive: true,
    tokenVersion: 0,
    tenantId: 't1',
  };
  async findOne(id: string) {
    if (id !== this.user.id) return null;
    return this.user;
  }
  async increment() {
    this.user.tokenVersion += 1;
  }
}

describe('JwtStrategy tokenVersion revocation', () => {
  let strategy: JwtStrategy;
  let users: MockUsersService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        JwtStrategy,
        { provide: UsersService, useClass: MockUsersService },
      ],
    }).compile();
    strategy = mod.get(JwtStrategy);
    users = mod.get(UsersService);
  });

  it('accepts token with matching tokenVersion', async () => {
    const payload = {
      sub: 'u1',
      email: 'x@test.com',
      role: 'user',
      tenantId: 't1',
      tokenVersion: 0,
    };
    const res = await strategy.validate(payload as any);
    expect(res).toBeDefined();
    expect(res.tokenVersion).toBe(0);
  });

  it('rejects token after tokenVersion increment', async () => {
    await users.increment();
    const payload = {
      sub: 'u1',
      email: 'x@test.com',
      role: 'user',
      tenantId: 't1',
      tokenVersion: 0, // stale
    };
    await expect(strategy.validate(payload as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

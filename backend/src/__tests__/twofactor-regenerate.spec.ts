import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SecurityService } from '../common/security.service';
import { TwoFactorService } from '../common/two-factor.service';
import { AuditService } from '../audit/audit.service';

interface MockUserEntity {
  id: string;
  email: string;
  tenantId: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  backupCodes?: string[];
}

class MockUserRepo {
  private store: MockUserEntity[] = [];

  findOne(opts: {
    where: { id: string };
  }): Promise<MockUserEntity | undefined> {
    return Promise.resolve(this.store.find((u) => u.id === opts.where.id));
  }

  update(id: string, data: Partial<MockUserEntity>): Promise<void> {
    const idx = this.store.findIndex((u) => u.id === id);
    if (idx >= 0) {
      this.store[idx] = { ...this.store[idx], ...data };
    }
    return Promise.resolve();
  }

  count(): Promise<number> {
    return Promise.resolve(this.store.length);
  }

  create(data: MockUserEntity): MockUserEntity {
    return data;
  }

  save(data: MockUserEntity): Promise<MockUserEntity> {
    this.store.push(data);
    return Promise.resolve(data);
  }
}

class MockTenantRepo {
  findOne() {
    return Promise.resolve({ id: 't1' });
  }
}

describe('UsersService regenerateTwoFactorBackupCodes', () => {
  let service: UsersService;
  let userRepo: MockUserRepo;

  beforeAll(async () => {
    userRepo = new MockUserRepo();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Tenant), useValue: new MockTenantRepo() },
        SecurityService,
        TwoFactorService,
        { provide: AuditService, useValue: { log: async () => {} } },
      ],
    }).compile();

    service = moduleRef.get(UsersService);

    // Seed user with 2FA enabled & secret
    await userRepo.save({
      id: 'u1',
      email: 'test@example.com',
      tenantId: 't1',
      twoFactorEnabled: true,
      twoFactorSecret: 'ABCDEF123456',
      backupCodes: [],
    });
  });

  it('regenerates backup codes when 2FA enabled', async () => {
    const result = await service.regenerateTwoFactorBackupCodes('u1');
    expect(result.backupCodes).toHaveLength(10);
    // Ensure stored hashed codes differ from plaintext
    const stored = await userRepo.findOne({ where: { id: 'u1' } });
    expect(stored.backupCodes).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(stored.backupCodes[i]).not.toEqual(result.backupCodes[i]);
    }
  });

  it('throws if user not found', async () => {
    await expect(
      service.regenerateTwoFactorBackupCodes('missing'),
    ).rejects.toThrow('User not found');
  });

  it('throws if 2FA not enabled', async () => {
    await userRepo.save({
      id: 'u2',
      email: 'no2fa@example.com',
      tenantId: 't1',
      twoFactorEnabled: false,
    });
    await expect(service.regenerateTwoFactorBackupCodes('u2')).rejects.toThrow(
      '2FA is not enabled for this user',
    );
  });
});

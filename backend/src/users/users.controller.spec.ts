import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SecurityService } from '../common/security.service';
import { TwoFactorService } from '../common/two-factor.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Basit in-memory mock repository
interface FindByIdOptions {
  where: { id: string };
}

class MockUserRepo {
  private store: Array<Partial<User>> = [];

  async findOne(opts: FindByIdOptions): Promise<Partial<User> | undefined> {
    return this.store.find((u) => u.id === opts.where.id);
  }

  async update(id: string, data: Partial<User>): Promise<void> {
    const idx = this.store.findIndex((u) => u.id === id);
    if (idx >= 0) {
      this.store[idx] = { ...this.store[idx], ...data };
    }
  }

  create(data: Partial<User>): Partial<User> {
    return { ...data };
  }

  async save(data: Partial<User>): Promise<Partial<User>> {
    this.store.push(data);
    return data;
  }
}

type MockRequest = { user: { id: string } };

describe('UsersController', () => {
  let controller: UsersController;
  let repo: MockUserRepo;

  beforeEach(async () => {
    repo = new MockUserRepo();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        {
          provide: getRepositoryToken(Tenant),
          useValue: {},
        },
        {
          provide: SecurityService,
          useValue: { hashPassword: async (p: string) => p },
        },
        {
          provide: TwoFactorService,
          useValue: {
            generateTwoFactorSetup: () => ({ secret: 's', backupCodes: [] }),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    // Seed bir kullanıcı
    await repo.save({
      id: 'u1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      tenantId: 't1',
      notificationPreferences: {},
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get empty notification preferences object', async () => {
    const req: MockRequest = { user: { id: 'u1' } };
    const result = await controller.getNotificationPreferences(req);
    expect(result).toEqual({});
  });

  it('should update and return notification preferences', async () => {
    const req: MockRequest = { user: { id: 'u1' } };
    const body = { invoiceReminders: false, expenseAlerts: true };
    const updated = await controller.updateNotificationPreferences(req, body);
    expect(updated.notificationPreferences).toEqual(body);
    const fetched = await controller.getNotificationPreferences(req);
    expect(fetched).toEqual(body);
  });
});

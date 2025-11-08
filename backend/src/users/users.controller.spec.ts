import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

// Basit in-memory mock repository
class MockUserRepo {
  private store: any[] = [];
  findOne(opts: any) {
    return Promise.resolve(this.store.find((u) => u.id === opts.where.id));
  }
  update(id: string, data: any) {
    const idx = this.store.findIndex((u) => u.id === id);
    if (idx >= 0) {
      this.store[idx] = { ...this.store[idx], ...data };
    }
    return Promise.resolve();
  }
  create(data: any) {
    return data;
  }
  save(data: any) {
    this.store.push(data);
    return Promise.resolve(data);
  }
}

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;
  let repo: MockUserRepo;

  beforeEach(async () => {
    repo = new MockUserRepo();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        {
          provide: getRepositoryToken(
            require('../tenants/entities/tenant.entity').Tenant,
          ),
          useValue: {},
        },
        {
          provide: require('../common/security.service').SecurityService,
          useValue: { hashPassword: async (p: string) => p },
        },
        {
          provide: require('../common/two-factor.service').TwoFactorService,
          useValue: {
            generateTwoFactorSetup: () => ({ secret: 's', backupCodes: [] }),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
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
    const req: any = { user: { id: 'u1' } };
    const result = await controller.getNotificationPreferences(req);
    expect(result).toEqual({});
  });

  it('should update and return notification preferences', async () => {
    const req: any = { user: { id: 'u1' } };
    const body = { invoiceReminders: false, expenseAlerts: true };
    const updated = await controller.updateNotificationPreferences(req, body);
    expect(updated.notificationPreferences).toEqual(body);
    const fetched = await controller.getNotificationPreferences(req);
    expect(fetched).toEqual(body);
  });
});

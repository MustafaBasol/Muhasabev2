import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomersService } from '../src/customers/customers.service';
import { TenantPlanLimitService } from '../src/common/tenant-plan-limits.service';

// Minimal mocks
const mockQB = (result: any) => {
  const chain: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
  };
  return chain;
};

const createRepoMocks = (opts?: { existingForEmail?: any; count?: number }) => {
  const customersRepository: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(opts?.count ?? 0),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQB(opts?.existingForEmail ?? null)),
  };
  const invoicesRepository: any = { find: jest.fn() };
  const tenantRepository: any = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: 't-1', subscriptionPlan: 'free' }),
  };
  return { customersRepository, invoicesRepository, tenantRepository };
};

// Spy plan limit to allow add up to some count
jest
  .spyOn(TenantPlanLimitService, 'canAddCustomer')
  .mockImplementation((count: number) => count < 100);

describe('CustomersService duplicate guards', () => {
  it('should throw BadRequestException on duplicate email in create()', async () => {
    const { customersRepository, invoicesRepository, tenantRepository } =
      createRepoMocks({ existingForEmail: { id: 'c-1' }, count: 0 });
    const service = new CustomersService(
      customersRepository,
      invoicesRepository,
      tenantRepository,
    );

    await expect(
      service.create({ name: 'Test', email: 'dup@example.com' }, 't-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(customersRepository.createQueryBuilder).toHaveBeenCalled();
  });

  it('should save when no duplicate found in create()', async () => {
    const { customersRepository, invoicesRepository, tenantRepository } =
      createRepoMocks({ existingForEmail: null, count: 0 });
    const service = new CustomersService(
      customersRepository,
      invoicesRepository,
      tenantRepository,
    );

    const saved = await service.create(
      { name: 'Ok', email: 'ok@example.com' },
      't-1',
    );
    expect(saved).toMatchObject({
      name: 'Ok',
      email: 'ok@example.com',
      tenantId: 't-1',
    });
    expect(customersRepository.save).toHaveBeenCalled();
  });

  it('should check duplicate on update()', async () => {
    const { customersRepository, invoicesRepository, tenantRepository } =
      createRepoMocks({ existingForEmail: { id: 'other' }, count: 0 });
    const service = new CustomersService(
      customersRepository,
      invoicesRepository,
      tenantRepository,
    );

    await expect(
      service.update('curr', { email: 'dup@example.com' }, 't-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

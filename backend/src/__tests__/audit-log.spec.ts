import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, AuditAction } from '../audit/entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import {
  Tenant,
  SubscriptionPlan,
  TenantStatus,
} from '../tenants/entities/tenant.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Invite } from '../organizations/entities/invite.entity';
import { AuditService } from '../audit/audit.service';
import { DataSource } from 'typeorm';

describe('AuditService basic logging', () => {
  let service: AuditService;
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const entityId = '33333333-3333-4333-8333-333333333333';
  const entities = [
    AuditLog,
    User,
    Tenant,
    Organization,
    OrganizationMember,
    Invite,
  ];

  const prefersPostgres = (() => {
    const flag =
      process.env.TEST_DB ||
      process.env.TEST_DATABASE ||
      process.env.TEST_DATABASE_TYPE;
    return flag ? ['postgres', 'pg'].includes(flag.toLowerCase()) : false;
  })();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(
          prefersPostgres
            ? {
                type: 'postgres',
                host: process.env.DATABASE_HOST || 'localhost',
                port: Number(process.env.DATABASE_PORT || 5432),
                username: process.env.DATABASE_USER || 'postgres',
                password: process.env.DATABASE_PASSWORD || 'password',
                database: process.env.DATABASE_NAME || 'postgres',
                synchronize: true,
                dropSchema: true,
                entities,
                logging: false,
              }
            : {
                type: 'sqlite',
                database: ':memory:',
                dropSchema: true,
                entities,
                synchronize: true,
              },
        ),
        TypeOrmModule.forFeature([AuditLog]),
      ],
      providers: [AuditService],
    }).compile();
    service = mod.get(AuditService);

    const dataSource = mod.get(DataSource);
    await dataSource.getRepository(Tenant).save({
      id: tenantId,
      name: 'Test Tenant',
      slug: 'test-tenant',
      subscriptionPlan: SubscriptionPlan.FREE,
      status: TenantStatus.ACTIVE,
    });
  });

  it('logs an entry and retrieves it', async () => {
    const entry = await service.log({
      tenantId,
      entity: 'tenant',
      entityId,
      action: AuditAction.CREATE,
      diff: { name: 'Acme' },
    });
    expect(entry.id).toBeDefined();
    const found = await service.findAll({ tenantId, page: 1, limit: 10 });
    expect(found.total).toBe(1);
    expect(found.data[0].entity).toBe('tenant');
  });
});

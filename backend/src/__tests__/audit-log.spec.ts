import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, AuditAction } from '../audit/entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Invite } from '../organizations/entities/invite.entity';
import { AuditService } from '../audit/audit.service';

describe('AuditService basic logging', () => {
  let service: AuditService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: [AuditLog, User, Tenant, Organization, OrganizationMember, Invite],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([AuditLog]),
      ],
      providers: [AuditService],
    }).compile();
    service = mod.get(AuditService);
  });

  it('logs an entry and retrieves it', async () => {
    const entry = await service.log({
      tenantId: 't1',
      userId: 'u1',
      entity: 'tenant',
      entityId: 't1',
      action: AuditAction.CREATE,
      diff: { name: 'Acme' },
    });
    expect(entry.id).toBeDefined();
    const found = await service.findAll({ tenantId: 't1', page: 1, limit: 10 });
    expect(found.total).toBe(1);
    expect(found.data[0].entity).toBe('tenant');
  });
});

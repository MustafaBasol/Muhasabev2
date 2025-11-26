import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditLog } from '../audit/entities/audit-log.entity';

type QueryBuilderMock = {
  leftJoinAndSelect: () => QueryBuilderMock;
  where: () => QueryBuilderMock;
  andWhere: () => QueryBuilderMock;
  orderBy: () => QueryBuilderMock;
  skip: () => QueryBuilderMock;
  take: () => QueryBuilderMock;
  getCount: () => Promise<number>;
  getMany: () => Promise<AuditLog[]>;
};

// Basit mock repository
class MockRepo {
  entries: AuditLog[] = [];

  create(data: Partial<AuditLog>): AuditLog {
    return {
      id: 'log-' + (this.entries.length + 1),
      createdAt: new Date(),
      updatedAt: new Date(),
      tenantId: 'tenant',
      userId: 'user',
      entity: 'entity',
      entityId: 'entity-id',
      action: AuditAction.CREATE,
      diff: {},
      ...data,
    } as AuditLog;
  }

  async save(entry: AuditLog): Promise<AuditLog> {
    this.entries.push(entry);
    return entry;
  }

  createQueryBuilder(): QueryBuilderMock {
    // Sadece findAll kullanımını kabaca taklit eder
    const builder: QueryBuilderMock = {
      leftJoinAndSelect: () => builder,
      where: () => builder,
      andWhere: () => builder,
      orderBy: () => builder,
      skip: () => builder,
      take: () => builder,
      getCount: async () => this.entries.length,
      getMany: async () => this.entries,
    };
    return builder;
  }

  find(): AuditLog[] {
    return this.entries;
  }
}

describe('AuditService (unit)', () => {
  let service: AuditService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = new MockRepo();
    service = new AuditService(repo as unknown as Repository<AuditLog>);
  });

  it('masks PII fields in diff', async () => {
    const log = await service.log({
      tenantId: 't1',
      userId: 'u1',
      entity: 'user',
      entityId: 'u1',
      action: AuditAction.UPDATE,
      diff: { email: 'user@example.com', password: 'SecretPass123' },
    });
    expect(log.diff.email).toMatch(/\*\*\*/); // email masked
    expect(log.diff.password).toMatch(/\*\*\*/); // password masked
  });

  it('creates diff between objects', () => {
    const a = { name: 'A', count: 1 };
    const b = { name: 'B', count: 2 };
    const diff = service.createDiff(a, b);
    expect(diff.name.from).toBe('A');
    expect(diff.name.to).toBe('B');
    expect(diff.count.to).toBe(2);
  });
});

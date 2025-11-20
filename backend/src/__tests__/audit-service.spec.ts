import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditLog } from '../audit/entities/audit-log.entity';

// Basit mock repository
class MockRepo {
  entries: any[] = [];
  create(data: any) {
    return { id: 'log-' + (this.entries.length + 1), createdAt: new Date(), ...data } as AuditLog;
  }
  async save(entry: any) {
    this.entries.push(entry);
    return entry;
  }
  createQueryBuilder() {
    // Sadece findAll kullanımını kabaca taklit eder
    const self = this;
    return {
      leftJoinAndSelect() { return this; },
      where() { return this; },
      andWhere() { return this; },
      orderBy() { return this; },
      getCount: async () => self.entries.length,
      skip() { return this; },
      take() { return this; },
      getMany: async () => self.entries,
    };
  }
  find() { return this.entries; }
}

describe('AuditService (unit)', () => {
  let service: AuditService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = new MockRepo();
    // @ts-ignore inject mock repo
    service = new AuditService(repo);
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

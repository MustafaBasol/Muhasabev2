import { Test } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  Tenant,
  SubscriptionPlan,
  TenantStatus,
} from '../src/tenants/entities/tenant.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { DataSource } from 'typeorm';

// Basit JwtAuthGuard override: her isteğe user enjekte eder
class TestAuthGuard {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    // Tek bir sabit tenant ID kullanıyoruz
    req.user = {
      id: 'test-user',
      tenantId: 'test-tenant',
      role: 'TENANT_ADMIN',
    };
    return true;
  }
}

describe('Billing endpoints (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    const repo = dataSource.getRepository(Tenant);
    await repo.insert({
      id: 'test-tenant',
      name: 'TestCo',
      slug: 'testco',
      subscriptionPlan: SubscriptionPlan.FREE,
      status: TenantStatus.ACTIVE,
      maxUsers: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /billing/:tenantId/invoices returns empty invoices list for new tenant', async () => {
    const res = await request(app.getHttpServer()).get(
      '/billing/test-tenant/invoices',
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('invoices');
    expect(Array.isArray(res.body.invoices)).toBe(true);
    expect(res.body.invoices.length).toBe(0); // no stripeCustomerId yet
  });

  it('GET /billing/:tenantId/history returns success and events array', async () => {
    const res = await request(app.getHttpServer()).get(
      '/billing/test-tenant/history',
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
    // At least one plan.current or fallback event
    expect(res.body.events.length).toBeGreaterThan(0);
  });
});

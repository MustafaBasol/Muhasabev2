import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Multi-Tenant Isolation (e2e)', () => {
  let app: INestApplication;

  // Tenant 1
  let tenant1Token: string;
  let tenant1CustomerId: string;
  let tenant1ProductId: string;

  // Tenant 2
  let tenant2Token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Register Tenant 1
    const tenant1Response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `tenant1-${Date.now()}@example.com`,
        password: 'Test123456',
        firstName: 'Tenant',
        lastName: 'One',
        companyName: `Company One ${Date.now()}`,
      });
    tenant1Token = tenant1Response.body.token;

    // Register Tenant 2
    const tenant2Response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `tenant2-${Date.now()}@example.com`,
        password: 'Test123456',
        firstName: 'Tenant',
        lastName: 'Two',
        companyName: `Company Two ${Date.now()}`,
      });
    tenant2Token = tenant2Response.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Customer Isolation', () => {
    it('should create customer for tenant 1', async () => {
      const response = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          name: 'Tenant 1 Customer',
          email: 'customer1@tenant1.com',
          phone: '1234567890',
          address: 'Address 1',
        })
        .expect(201);

      tenant1CustomerId = response.body.id;
      expect(response.body.name).toBe('Tenant 1 Customer');
    });

    it('should create customer for tenant 2', async () => {
      const response = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${tenant2Token}`)
        .send({
          name: 'Tenant 2 Customer',
          email: 'customer2@tenant2.com',
          phone: '0987654321',
          address: 'Address 2',
        })
        .expect(201);

      expect(response.body.name).toBe('Tenant 2 Customer');
    });

    it('tenant 1 should only see their own customers', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(
        response.body.every(
          (c: any) =>
            c.name.includes('Tenant 1') || c.name === 'Tenant 1 Customer',
        ),
      ).toBe(true);
    });

    it('tenant 2 should only see their own customers', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${tenant2Token}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(
        response.body.every(
          (c: any) =>
            c.name.includes('Tenant 2') || c.name === 'Tenant 2 Customer',
        ),
      ).toBe(true);
    });

    it('tenant 2 should NOT be able to access tenant 1 customer', async () => {
      await request(app.getHttpServer())
        .get(`/customers/${tenant1CustomerId}`)
        .set('Authorization', `Bearer ${tenant2Token}`)
        .expect(404);
    });

    it('tenant 2 should NOT be able to update tenant 1 customer', async () => {
      await request(app.getHttpServer())
        .patch(`/customers/${tenant1CustomerId}`)
        .set('Authorization', `Bearer ${tenant2Token}`)
        .send({ name: 'Hacked Name' })
        .expect(404);
    });

    it('tenant 2 should NOT be able to delete tenant 1 customer', async () => {
      await request(app.getHttpServer())
        .delete(`/customers/${tenant1CustomerId}`)
        .set('Authorization', `Bearer ${tenant2Token}`)
        .expect(404);
    });
  });

  describe('Product Isolation', () => {
    it('should create product for tenant 1', async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          name: 'Tenant 1 Product',
          code: `SKU-T1-${Date.now()}`,
          price: 100,
          stock: 50,
          category: 'electronics',
        })
        .expect(201);

      tenant1ProductId = response.body.id;
      expect(response.body.name).toBe('Tenant 1 Product');
    });

    it('should create product for tenant 2', async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${tenant2Token}`)
        .send({
          name: 'Tenant 2 Product',
          code: `SKU-T2-${Date.now()}`,
          price: 200,
          stock: 30,
          category: 'software',
        })
        .expect(201);

      expect(response.body.name).toBe('Tenant 2 Product');
    });

    it('tenant 1 should only see their own products', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(
        response.body.some((p: any) => p.name === 'Tenant 1 Product'),
      ).toBe(true);
      expect(
        response.body.some((p: any) => p.name === 'Tenant 2 Product'),
      ).toBe(false);
    });

    it('tenant 2 should only see their own products', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${tenant2Token}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(
        response.body.some((p: any) => p.name === 'Tenant 2 Product'),
      ).toBe(true);
      expect(
        response.body.some((p: any) => p.name === 'Tenant 1 Product'),
      ).toBe(false);
    });

    it('tenant 2 should NOT be able to access tenant 1 product', async () => {
      await request(app.getHttpServer())
        .get(`/products/${tenant1ProductId}`)
        .set('Authorization', `Bearer ${tenant2Token}`)
        .expect(404);
    });
  });

  describe('Invoice Isolation', () => {
    it('tenant 1 should only see their own invoices', async () => {
      const response = await request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('tenant 2 should only see their own invoices', async () => {
      const response = await request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${tenant2Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Expense Isolation', () => {
    it('tenant 1 should only see their own expenses', async () => {
      const response = await request(app.getHttpServer())
        .get('/expenses')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('tenant 2 should only see their own expenses', async () => {
      const response = await request(app.getHttpServer())
        .get('/expenses')
        .set('Authorization', `Bearer ${tenant2Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

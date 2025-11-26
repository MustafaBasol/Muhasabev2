import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Helper to build auth header
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('Plan Limits (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let customerId: string;

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

    // Register a FREE plan tenant (default)
    const email = `limits-${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Test123456',
        firstName: 'Plan',
        lastName: 'Limits',
        companyName: `Company Limits ${Date.now()}`,
      })
      .expect(201);

    token = res.body.token;
    expect(token).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Customer limit (FREE: max 1)', () => {
    it('should allow creating the first customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .set(auth(token))
        .send({ name: 'First Customer' })
        .expect(201);

      customerId = res.body.id;
      expect(res.body.name).toBe('First Customer');
    });

    it('should reject creating a second customer with plan limit message', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .set(auth(token))
        .send({ name: 'Second Customer' })
        .expect(400);

      const msg = res.body?.message || '';
      expect(typeof msg).toBe('string');
      expect(msg).toContain('Plan limitine ulaşıldı');
    });
  });

  describe('Supplier limit (FREE: max 1)', () => {
    it('should allow creating the first supplier', async () => {
      const res = await request(app.getHttpServer())
        .post('/suppliers')
        .set(auth(token))
        .send({ name: 'First Supplier' })
        .expect(201);

      expect(res.body.name).toBe('First Supplier');
    });

    it('should reject creating a second supplier with plan limit message', async () => {
      const res = await request(app.getHttpServer())
        .post('/suppliers')
        .set(auth(token))
        .send({ name: 'Second Supplier' })
        .expect(400);

      const msg = res.body?.message || '';
      expect(typeof msg).toBe('string');
      expect(msg).toContain('Plan limitine ulaşıldı');
    });
  });

  describe('Monthly invoice limit (FREE: max 5)', () => {
    const today = new Date().toISOString().split('T')[0];

    it('should allow creating up to 5 invoices in the current month', async () => {
      for (let i = 1; i <= 5; i++) {
        const res = await request(app.getHttpServer())
          .post('/invoices')
          .set(auth(token))
          .send({
            customerId,
            issueDate: today,
            dueDate: today,
            lineItems: [
              {
                description: `Service ${i}`,
                quantity: 1,
                unitPrice: 100,
                taxRate: 18,
              },
            ],
          })
          .expect(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('invoiceNumber');
      }
    });

    it('should reject the 6th invoice with plan limit message', async () => {
      const res = await request(app.getHttpServer())
        .post('/invoices')
        .set(auth(token))
        .send({
          customerId,
          issueDate: today,
          dueDate: today,
          lineItems: [
            {
              description: 'Service 6',
              quantity: 1,
              unitPrice: 100,
              taxRate: 18,
            },
          ],
        })
        .expect(400);

      const msg = res.body?.message || '';
      expect(typeof msg).toBe('string');
      expect(msg).toContain('Plan limitine ulaşıldı');
    });
  });

  describe('Monthly expense limit (FREE: max 5)', () => {
    const today = new Date().toISOString().split('T')[0];

    it('should allow creating up to 5 expenses in the current month', async () => {
      for (let i = 1; i <= 5; i++) {
        const res = await request(app.getHttpServer())
          .post('/expenses')
          .set(auth(token))
          .send({
            description: `Expense ${i}`,
            amount: 10 * i,
            expenseDate: today,
          })
          .expect(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('expenseNumber');
      }
    });

    it('should reject the 6th expense with plan limit message', async () => {
      const res = await request(app.getHttpServer())
        .post('/expenses')
        .set(auth(token))
        .send({
          description: 'Expense 6',
          amount: 60,
          expenseDate: today,
        })
        .expect(400);

      const msg = res.body?.message || '';
      expect(typeof msg).toBe('string');
      expect(msg).toContain('Plan limitine ulaşıldı');
    });
  });
});

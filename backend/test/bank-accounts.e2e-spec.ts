import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Free plan: 1 banka hesabı limiti e2e testi
 */

describe('Bank Accounts (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();

    const registerDto = {
      email: `banktest-${Date.now()}@example.com`,
      password: 'Test123456',
      firstName: 'Bank',
      lastName: 'Tester',
      companyName: `Bank Test Co ${Date.now()}`,
    };

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerDto)
      .expect(201);

    authToken = response.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow creating the first bank account (FREE plan)', async () => {
    const res = await request(app.getHttpServer())
      .post('/bank-accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'İş Bankası TL', iban: 'TR000000000000000000000000' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
  });

  it('should reject creating the second bank account with plan limit message', async () => {
    const res = await request(app.getHttpServer())
      .post('/bank-accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Garanti TL', iban: 'TR111111111111111111111111' })
      .expect(400);

    expect(res.body.message).toMatch(/banka hesabı/i);
  });
});

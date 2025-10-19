import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let tenantId: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user and tenant', async () => {
      const registerDto = {
        email: `test-${Date.now()}@example.com`,
        password: 'Test123456',
        firstName: 'Test',
        lastName: 'User',
        companyName: `Test Company ${Date.now()}`,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tenant');
      expect(response.body.user.email).toBe(registerDto.email);
      expect(response.body.user.role).toBe('tenant_admin');
      expect(response.body.tenant.name).toBe(registerDto.companyName);

      authToken = response.body.token;
      tenantId = response.body.user.tenantId;
    });

    it('should fail with duplicate email', async () => {
      const registerDto = {
        email: 'duplicate@example.com',
        password: 'Test123456',
        firstName: 'Test',
        lastName: 'User',
        companyName: 'Duplicate Company',
      };

      // First registration
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      // Second registration with same email
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(409);
    });

    it('should fail with invalid email', async () => {
      const registerDto = {
        email: 'invalid-email',
        password: 'Test123456',
        firstName: 'Test',
        lastName: 'User',
        companyName: 'Test Company',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });

    it('should fail with missing fields', async () => {
      const registerDto = {
        email: 'test@example.com',
        // Missing password and other required fields
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    const testUser = {
      email: `login-test-${Date.now()}@example.com`,
      password: 'Test123456',
      firstName: 'Login',
      lastName: 'Test',
      companyName: `Login Test Company ${Date.now()}`,
    };

    beforeAll(async () => {
      // Register a user for login tests
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);
    });

    it('should login successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should fail with wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123',
        })
        .expect(401);
    });

    it('should fail with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test123456',
        })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('tenantId');
      expect(response.body.tenantId).toBe(tenantId);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});

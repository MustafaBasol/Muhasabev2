import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { HealthController } from '../health/health.controller';

describe('HealthController', () => {
  let app: INestApplication;
  let queryCalled = false;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: {
            // Simulate successful query for latency measurement
            query: async () => {
              queryCalled = true;
              return [1];
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok statuses and latency', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.appStatus).toBe('ok');
    expect(['ok', 'error']).toContain(res.body.dbStatus);
    expect(typeof res.body.timestamp).toBe('string');
    expect(typeof res.body.dbLatencyMs).toBe('number');
    expect(queryCalled).toBe(true);
  });

  it('GET /health/email returns email provider info', async () => {
    const res = await request(app.getHttpServer()).get('/health/email');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provider');
    expect(res.body).toHaveProperty('fromConfigured');
    expect(res.body).toHaveProperty('verificationRequired');
  });
});

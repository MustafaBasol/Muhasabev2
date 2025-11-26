import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { HealthController } from '../health/health.controller';

type HealthResponse = {
  appStatus: string;
  dbStatus: string;
  timestamp: string;
  dbLatencyMs: number;
};

type EmailHealthResponse = {
  provider: string;
  fromConfigured: boolean;
  verificationRequired: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseHealthResponse = (payload: unknown): HealthResponse => {
  if (!isRecord(payload)) {
    throw new Error('Invalid health response payload');
  }
  const { appStatus, dbStatus, timestamp, dbLatencyMs } = payload;
  if (
    typeof appStatus !== 'string' ||
    typeof dbStatus !== 'string' ||
    typeof timestamp !== 'string' ||
    typeof dbLatencyMs !== 'number'
  ) {
    throw new Error('Invalid health response payload');
  }
  return { appStatus, dbStatus, timestamp, dbLatencyMs };
};

const parseEmailHealthResponse = (payload: unknown): EmailHealthResponse => {
  if (!isRecord(payload)) {
    throw new Error('Invalid email health response payload');
  }
  const { provider, fromConfigured, verificationRequired } = payload;
  if (
    typeof provider !== 'string' ||
    typeof fromConfigured !== 'boolean' ||
    typeof verificationRequired !== 'boolean'
  ) {
    throw new Error('Invalid email health response payload');
  }
  return { provider, fromConfigured, verificationRequired };
};

describe('HealthController', () => {
  let app: INestApplication;
  let queryCalled = false;
  type SupertestTarget = Parameters<typeof request>[0];
  let httpServer: SupertestTarget;

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
    httpServer = app.getHttpServer() as SupertestTarget;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok statuses and latency', async () => {
    const res = await request(httpServer).get('/health');
    const body = parseHealthResponse(res.body);
    expect(res.status).toBe(200);
    expect(body.appStatus).toBe('ok');
    expect(['ok', 'error']).toContain(body.dbStatus);
    expect(typeof body.timestamp).toBe('string');
    expect(typeof body.dbLatencyMs).toBe('number');
    expect(queryCalled).toBe(true);
  });

  it('GET /health/email returns email provider info', async () => {
    const res = await request(httpServer).get('/health/email');
    const body = parseEmailHealthResponse(res.body);
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('provider');
    expect(body).toHaveProperty('fromConfigured');
    expect(body).toHaveProperty('verificationRequired');
  });
});

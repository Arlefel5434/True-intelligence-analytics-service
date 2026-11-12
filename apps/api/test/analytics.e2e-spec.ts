import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Application } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

const origin = 'http://localhost:8080';
const password = '123qwe123qwe';
const companyA = '10000000-0000-4000-8000-000000000001';
const branchA1 = '30000000-0000-4000-8000-000000000001';

describe('analytics API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ip = 210;

  const login = async (email: string) => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', `203.0.113.${ip++}`)
      .send({ email, password })
      .expect(200);
    return agent;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    (app.getHttpAdapter().getInstance() as Application).set('trust proxy', 1);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => prisma.refreshSession.deleteMany());
  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await app.close();
  });

  it('lists only branches available to the client', async () => {
    const client = await login('client.a@example.test');
    const response = await client.get('/api/branches').expect(200);
    expect(response.body).toHaveLength(2);
    expect(
      response.body.every(
        (branch: { companyId: string }) => branch.companyId === companyA,
      ),
    ).toBe(true);
    await client.get('/api/companies').expect(403);
  });

  it('aggregates all company branches and narrows to one branch', async () => {
    const client = await login('client.a@example.test');
    const all = await client
      .get('/api/analytics')
      .query({ from: '2026-10-01', to: '2026-10-05', metric: 'views' })
      .expect(200);
    const one = await client
      .get('/api/analytics')
      .query({
        from: '2026-10-01',
        to: '2026-10-05',
        metric: 'views',
        branchId: branchA1,
      })
      .expect(200);
    expect(all.body.metadata).toMatchObject({ branchCount: 2, dataPoints: 10 });
    expect(one.body.metadata).toMatchObject({ branchCount: 1, dataPoints: 5 });
    expect(all.body.totals.views).toBeGreaterThan(one.body.totals.views);
    expect(all.body.series).toHaveLength(5);
  });

  it('requires an administrator to select a company on scoped endpoints', async () => {
    const admin = await login('admin@example.test');
    await admin.get('/api/branches').expect(400);
    const companies = await admin.get('/api/companies').expect(200);
    expect(companies.body).toHaveLength(2);
    await admin.get('/api/branches').set('X-Company-Id', companyA).expect(200);
  });

  it('validates dates, period, metrics and foreign branches', async () => {
    const client = await login('client.a@example.test');
    await client
      .get('/api/analytics')
      .query({ from: '2026-02-30', to: '2026-03-01', metric: 'views' })
      .expect(400);
    await client
      .get('/api/analytics')
      .query({ from: '2025-01-01', to: '2026-12-31', metric: 'views' })
      .expect(400);
    await client
      .get('/api/analytics')
      .query({ from: '2026-10-01', to: '2026-10-05', metric: 'unknown' })
      .expect(400);
    await client
      .get('/api/analytics')
      .query({
        from: '2026-10-01',
        to: '2026-10-05',
        metric: 'views',
        branchId: '30000000-0000-4000-8000-000000000003',
      })
      .expect(404);
  });
});

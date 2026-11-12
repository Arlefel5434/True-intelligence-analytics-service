import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import cookieParser from 'cookie-parser';
import type { Application } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { ImportLockService } from '../src/imports/import-lock.service.js';
import { ProviderClientService } from '../src/imports/provider-client.service.js';
import type {
  ProviderPage,
  ProviderRecord,
} from '../src/imports/provider.types.js';

const origin = 'http://localhost:8080';
const password = '123qwe123qwe';

function record(branch: string, date = '2027-01-01'): ProviderRecord {
  return {
    externalId: `mock-provider:${branch}:${date}`,
    externalBranchId: branch,
    date,
    views: 100,
    searches: 40,
    websiteClicks: 10,
    calls: 5,
    routeBuilds: 8,
    newReviewsCount: 1,
    averageRating: 4.5,
  };
}

function page(items: ProviderRecord[]): ProviderPage {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 100,
      totalItems: items.length,
      totalPages: 1,
    },
  };
}

describe('statistics imports', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let locks: ImportLockService;
  let ip = 150;
  const provider = {
    getPage:
      jest.fn<
        (from: string, to: string, pageNumber: number) => Promise<ProviderPage>
      >(),
  };

  const login = async (email: string) => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', `198.51.100.${ip++}`)
      .send({ email, password })
      .expect(200);
    return agent;
  };

  beforeAll(async () => {
    process.env.PROVIDER_BASE_URL = 'http://provider.test';
    process.env.PROVIDER_API_KEY = 'test-provider-key';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProviderClientService)
      .useValue(provider)
      .compile();
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
    locks = app.get(ImportLockService);
  });

  beforeEach(async () => {
    provider.getPage.mockReset();
    await prisma.refreshSession.deleteMany();
    await prisma.importRun.deleteMany();
    await prisma.dailyMetric.deleteMany({
      where: { date: { gte: new Date('2027-01-01T00:00:00Z') } },
    });
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await prisma.importRun.deleteMany();
    await prisma.dailyMetric.deleteMany({
      where: { date: { gte: new Date('2027-01-01T00:00:00Z') } },
    });
    await app.close();
  });

  it('allows only administrators to run imports', async () => {
    const client = await login('client.a@example.test');
    await client
      .post('/api/imports/statistics')
      .set('Origin', origin)
      .send({ from: '2027-01-01', to: '2027-01-01' })
      .expect(403);
  });

  it('imports idempotently and reports unchanged records as skipped', async () => {
    provider.getPage.mockResolvedValue(
      page([
        record('mock-branch-a-1'),
        record('mock-branch-a-2'),
        record('mock-branch-b-1'),
      ]),
    );
    const admin = await login('admin@example.test');
    const first = await admin
      .post('/api/imports/statistics')
      .set('Origin', origin)
      .send({ from: '2027-01-01', to: '2027-01-01' })
      .expect(201);
    expect(first.body).toMatchObject({
      status: 'COMPLETED',
      createdCount: 3,
      updatedCount: 0,
      skippedCount: 0,
      warnings: [],
    });

    const second = await admin
      .post('/api/imports/statistics')
      .set('Origin', origin)
      .send({ from: '2027-01-01', to: '2027-01-01' })
      .expect(201);
    expect(second.body).toMatchObject({
      status: 'COMPLETED',
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 3,
    });
    expect(
      await prisma.dailyMetric.count({
        where: { date: new Date('2027-01-01T00:00:00Z') },
      }),
    ).toBe(3);
  });

  it('skips unknown branches with a structured warning', async () => {
    provider.getPage.mockResolvedValue(
      page([record('mock-branch-a-1'), record('unknown-branch')]),
    );
    const admin = await login('admin@example.test');
    const response = await admin
      .post('/api/imports/statistics')
      .set('Origin', origin)
      .send({ from: '2027-01-01', to: '2027-01-01' })
      .expect(201);
    expect(response.body).toMatchObject({
      status: 'COMPLETED_WITH_WARNINGS',
      createdCount: 1,
      skippedCount: 1,
      warnings: [
        expect.objectContaining({
          code: 'UNKNOWN_BRANCH',
          externalBranchId: 'unknown-branch',
        }),
      ],
    });
  });

  it('finalizes a first-page provider failure instead of leaving RUNNING', async () => {
    provider.getPage.mockRejectedValue(new Error('provider unavailable'));
    const admin = await login('admin@example.test');
    const response = await admin
      .post('/api/imports/statistics')
      .set('Origin', origin)
      .send({ from: '2027-01-01', to: '2027-01-01' })
      .expect(201);
    expect(response.body).toMatchObject({
      status: 'FAILED',
      errorMessage: 'No provider pages were imported',
      warnings: [expect.objectContaining({ code: 'PAGE_UNAVAILABLE' })],
    });
    expect(await prisma.importRun.count({ where: { status: 'RUNNING' } })).toBe(
      0,
    );
  });

  it('continues after a failed middle page and reports partial success', async () => {
    provider.getPage.mockImplementation(async (_from, _to, pageNumber) => {
      if (pageNumber === 2) throw new Error('temporary failure');
      const date = pageNumber === 1 ? '2027-01-01' : '2027-01-03';
      return {
        items: [record('mock-branch-a-1', date)],
        pagination: {
          page: pageNumber,
          pageSize: 100,
          totalItems: 3,
          totalPages: 3,
        },
      };
    });
    const admin = await login('admin@example.test');
    const response = await admin
      .post('/api/imports/statistics')
      .set('Origin', origin)
      .send({ from: '2027-01-01', to: '2027-01-03' })
      .expect(201);
    expect(response.body).toMatchObject({
      status: 'COMPLETED_WITH_WARNINGS',
      createdCount: 2,
      warnings: [
        expect.objectContaining({ code: 'PAGE_UNAVAILABLE', page: 2 }),
      ],
    });
  });

  it('returns 409 without creating a run while the source lock is held', async () => {
    const held = await locks.acquire();
    expect(held).not.toBeNull();
    try {
      const admin = await login('admin@example.test');
      await admin
        .post('/api/imports/statistics')
        .set('Origin', origin)
        .send({ from: '2027-01-01', to: '2027-01-01' })
        .expect(409);
      expect(await prisma.importRun.count()).toBe(0);
    } finally {
      await held?.release();
    }
  });
});

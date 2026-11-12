import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureSwagger } from './swagger';

describe('provider statistics HTTP API', () => {
  let app: INestApplication;
  const apiKey = 'e2e-provider-key';

  beforeAll(async () => {
    process.env.PROVIDER_API_KEY = apiKey;
    process.env.MOCK_SCENARIOS_ENABLED = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    configureSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.PROVIDER_API_KEY;
    delete process.env.MOCK_SCENARIOS_ENABLED;
  });

  const validRequest = () =>
    request(app.getHttpServer())
      .get('/v1/statistics')
      .set('X-API-Key', apiKey)
      .query({ from: '2026-10-01', to: '2026-10-02', pageSize: 2 });

  it('protects statistics without revealing whether a key was absent or wrong', async () => {
    const absent = await request(app.getHttpServer())
      .get('/v1/statistics')
      .query({ from: '2026-10-01', to: '2026-10-02' })
      .expect(401);
    const wrong = await request(app.getHttpServer())
      .get('/v1/statistics')
      .set('X-API-Key', 'wrong')
      .query({ from: '2026-10-01', to: '2026-10-02' })
      .expect(401);
    expect(wrong.body.message).toBe(absent.body.message);
  });

  it('returns deterministic, stably paginated records', async () => {
    const first = await validRequest().expect(200);
    const repeated = await validRequest().expect(200);
    expect(repeated.body).toEqual(first.body);
    expect(first.body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalItems: 6,
      totalPages: 3,
    });
    expect(first.body.items[0]).toMatchObject({
      externalId: 'mock-provider:mock-branch-a-1:2026-10-01',
      externalBranchId: 'mock-branch-a-1',
      date: '2026-10-01',
    });
  });

  it('filters known branches and returns an empty page for unknown branches', async () => {
    const known = await request(app.getHttpServer())
      .get('/v1/statistics')
      .set('X-API-Key', apiKey)
      .query({
        from: '2026-10-01',
        to: '2026-10-02',
        externalBranchId: 'mock-branch-a-2',
      })
      .expect(200);
    expect(known.body.pagination.totalItems).toBe(2);
    expect(
      known.body.items.every(
        (item: { externalBranchId: string }) =>
          item.externalBranchId === 'mock-branch-a-2',
      ),
    ).toBe(true);

    const unknown = await request(app.getHttpServer())
      .get('/v1/statistics')
      .set('X-API-Key', apiKey)
      .query({
        from: '2026-10-01',
        to: '2026-10-02',
        externalBranchId: 'unknown-branch',
      })
      .expect(200);
    expect(unknown.body.items).toEqual([]);
    expect(unknown.body.pagination.totalItems).toBe(0);
  });

  it('validates calendar dates, range length, pagination and unknown fields', async () => {
    for (const query of [
      { from: '2026-02-30', to: '2026-03-01' },
      { from: '2026-11-02', to: '2026-11-01' },
      { from: '2026-01-01', to: '2026-02-01' },
      { from: '2026-10-01', to: '2026-10-02', pageSize: 101 },
      { from: '2026-10-01', to: '2026-10-02', unexpected: 'value' },
    ]) {
      await request(app.getHttpServer())
        .get('/v1/statistics')
        .set('X-API-Key', apiKey)
        .query(query)
        .expect(400);
    }
  });

  it('can fail every request or one selected page when scenarios are enabled', async () => {
    const allPages = await validRequest()
      .set('X-Mock-Scenario', 'server-error')
      .expect(500);
    expect(allPages.body.message).toBe('Mock provider failure');

    await validRequest()
      .set('X-Mock-Scenario', 'server-error')
      .set('X-Mock-Fail-Page', '2')
      .expect(200);
    await validRequest()
      .query({ page: 2 })
      .set('X-Mock-Scenario', 'server-error')
      .set('X-Mock-Fail-Page', '2')
      .expect(500);
  });

  it('publishes Swagger UI and the statistics contract without an API key', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);
    const document = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(document.body.paths['/v1/statistics'].get).toBeDefined();
    expect(document.body.components.schemas.StatisticsPageDto).toBeDefined();
  });
});

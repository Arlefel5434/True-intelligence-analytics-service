import { Controller, Get, Param, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Application } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AdminOnly } from '../src/auth/roles.decorator.js';
import { AuthorizationModule } from '../src/authorization/authorization.module.js';
import { BranchAccessService } from '../src/authorization/branch-access.service.js';
import { CompanyAccessService } from '../src/authorization/company-access.service.js';
import { CompanyScoped } from '../src/authorization/company-scoped.decorator.js';
import type { CompanyContext } from '../src/authorization/company-context.types.js';
import { CurrentCompany } from '../src/authorization/current-company.decorator.js';
import { Public } from '../src/auth/public.decorator.js';
import { PrismaService } from '../src/database/prisma.service.js';

const origin = 'http://localhost:8080';
const password = '123qwe123qwe';
const ids = {
  companyA: '10000000-0000-4000-8000-000000000001',
  companyB: '10000000-0000-4000-8000-000000000002',
  missingCompany: '10000000-0000-4000-8000-000000000099',
  branchA1: '30000000-0000-4000-8000-000000000001',
  branchA2: '30000000-0000-4000-8000-000000000002',
  branchB1: '30000000-0000-4000-8000-000000000003',
  missingBranch: '30000000-0000-4000-8000-000000000099',
} as const;

@Controller('test-access')
class TestAccessController {
  constructor(
    private readonly companies: CompanyAccessService,
    private readonly branches: BranchAccessService,
  ) {}

  @Get('public')
  @Public()
  publicRoute(): { public: true } {
    return { public: true };
  }

  @Get('authenticated')
  authenticated(): { authenticated: true } {
    return { authenticated: true };
  }

  @Get('admin')
  @AdminOnly()
  admin(): { admin: true } {
    return { admin: true };
  }

  @Get('company')
  @CompanyScoped()
  company(@CurrentCompany() context: CompanyContext) {
    return this.companies.getCurrent(context);
  }

  @Get('branches')
  @CompanyScoped()
  branchesList(@CurrentCompany() context: CompanyContext) {
    return this.branches.list(context);
  }

  @Get('branches/:id')
  @CompanyScoped()
  branch(@CurrentCompany() context: CompanyContext, @Param('id') id: string) {
    return this.branches.find(context, id);
  }

  @Get('companies')
  @AdminOnly()
  companiesList() {
    return this.companies.listForAdmin();
  }

  @Get('public-company')
  @Public()
  @CompanyScoped()
  publicCompany(@CurrentCompany() context: CompanyContext): CompanyContext {
    return context;
  }
}

describe('company authorization', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ipSequence = 100;

  const nextIp = (): string => `198.51.100.${ipSequence++}`;
  const login = async (email: string) => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', nextIp())
      .send({ email, password })
      .expect(200);
    return agent;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, AuthorizationModule],
      controllers: [TestAccessController],
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
    app.enableCors({
      origin,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-Company-Id'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
    (app.getHttpAdapter().getInstance() as Application).set('trust proxy', 1);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.refreshSession.deleteMany();
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await app.close();
  });

  it('requires authentication by default and keeps explicitly public routes open', async () => {
    await request(app.getHttpServer())
      .get('/api/test-access/authenticated')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/test-access/public')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/test-access/public-company')
      .expect(401);
  });

  it('allows only administrators through admin-only routes', async () => {
    const client = await login('client.a@example.test');
    await client.get('/api/test-access/admin').expect(403);
    const admin = await login('admin@example.test');
    await admin.get('/api/test-access/admin').expect(200);
  });

  it('derives client context from JWT and rejects every company header', async () => {
    const client = await login('client.a@example.test');
    const current = await client.get('/api/test-access/company').expect(200);
    expect(current.body.id).toBe(ids.companyA);

    await client
      .get('/api/test-access/company')
      .set('X-Company-Id', ids.companyA)
      .expect(400);
    await client
      .get('/api/test-access/company')
      .set('X-Company-Id', ids.companyB)
      .expect(400);
  });

  it('requires one valid existing company UUID from administrators', async () => {
    const admin = await login('admin@example.test');
    await admin.get('/api/test-access/company').expect(400);
    await admin
      .get('/api/test-access/company')
      .set('X-Company-Id', 'not-a-uuid')
      .expect(400);
    await admin
      .get('/api/test-access/company')
      .set('X-Company-Id', `${ids.companyA},${ids.companyB}`)
      .expect(400);
    await admin
      .get('/api/test-access/company')
      .set('X-Company-Id', ids.missingCompany)
      .expect(404);
    const selected = await admin
      .get('/api/test-access/company')
      .set('X-Company-Id', ids.companyB)
      .expect(200);
    expect(selected.body.id).toBe(ids.companyB);
  });

  it('scopes client branch lists even when a query tries to choose another company', async () => {
    const client = await login('client.a@example.test');
    const response = await client
      .get(`/api/test-access/branches?companyId=${ids.companyB}`)
      .expect(200);
    expect(response.body.map((branch: { id: string }) => branch.id)).toEqual([
      ids.branchA2,
      ids.branchA1,
    ]);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ companyId: ids.companyA }),
      ]),
    );
  });

  it('returns the same safe 404 for a foreign and an unknown branch', async () => {
    const client = await login('client.a@example.test');
    const foreign = await client
      .get(`/api/test-access/branches/${ids.branchB1}`)
      .expect(404);
    const unknown = await client
      .get(`/api/test-access/branches/${ids.missingBranch}`)
      .expect(404);
    expect(foreign.body.message).toBe('Branch not found');
    expect(unknown.body.message).toBe(foreign.body.message);
  });

  it('keeps an administrator inside the explicitly selected company', async () => {
    const admin = await login('admin@example.test');
    await admin
      .get(`/api/test-access/branches/${ids.branchB1}`)
      .set('X-Company-Id', ids.companyA)
      .expect(404);
    await admin
      .get(`/api/test-access/branches/${ids.branchA1}`)
      .set('X-Company-Id', ids.companyA)
      .expect(200);
  });

  it('lets administrators list companies without selecting one', async () => {
    const admin = await login('admin@example.test');
    const response = await admin.get('/api/test-access/companies').expect(200);
    expect(
      response.body.map((company: { id: string }) => company.id).sort(),
    ).toEqual([ids.companyA, ids.companyB]);
  });

  it('allows the company header in CORS preflight requests', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/test-access/company')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'X-Company-Id')
      .expect(204);
    expect(response.headers['access-control-allow-headers']).toContain(
      'X-Company-Id',
    );
  });
});

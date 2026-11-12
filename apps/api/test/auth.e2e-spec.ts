import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import type { Application } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

const origin = 'http://localhost:8080';
const validCredentials = {
  email: 'client.a@example.test',
  password: 'Demo123!ChangeMe',
};

function cookieFrom(response: request.Response, name: string): string {
  const values = response.headers['set-cookie'];
  const cookies = Array.isArray(values) ? values : values ? [values] : [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Missing ${name} cookie`);
  return cookie.split(';', 1)[0];
}

describe('authentication', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ipSequence = 10;

  const nextIp = (): string => `203.0.113.${ipSequence++}`;

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

  beforeEach(async () => {
    await prisma.refreshSession.deleteMany();
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await app.close();
  });

  it('logs in with httpOnly cookies and returns the safe profile through /me', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', nextIp())
      .send(validCredentials)
      .expect(200);

    expect(login.body).toEqual({
      id: expect.any(String),
      email: validCredentials.email,
      role: 'CLIENT',
      companyId: expect.any(String),
      companyName: 'Северная чашка',
    });
    expect(login.body).not.toHaveProperty('passwordHash');
    expect(login.body).not.toHaveProperty('accessToken');
    expect(login.body).not.toHaveProperty('refreshToken');

    const setCookies = login.headers['set-cookie'] as unknown as string[];
    const accessCookie = setCookies.find((cookie) =>
      cookie.startsWith('tia_access='),
    );
    const refreshCookie = setCookies.find((cookie) =>
      cookie.startsWith('tia_refresh='),
    );
    expect(accessCookie).toEqual(expect.stringContaining('Path=/api'));
    expect(accessCookie).toEqual(expect.stringContaining('HttpOnly'));
    expect(accessCookie).toEqual(expect.stringContaining('SameSite=Lax'));
    expect(refreshCookie).toEqual(expect.stringContaining('Path=/api/auth'));
    expect(refreshCookie).toEqual(expect.stringContaining('HttpOnly'));
    expect(refreshCookie).toEqual(expect.stringContaining('SameSite=Lax'));

    const me = await agent
      .get('/api/auth/me')
      .set('X-Forwarded-For', nextIp())
      .expect(200);
    expect(me.body).toEqual(login.body);
  });

  it('returns the same error for an unknown email and a wrong password', async () => {
    const ip = nextIp();
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', ip)
      .send({ email: 'missing@example.test', password: 'wrong' })
      .expect(401);
    const wrong = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', ip)
      .send({ ...validCredentials, password: 'wrong' })
      .expect(401);
    expect(unknown.body.message).toBe('Invalid email or password');
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('rejects state-changing requests without the configured Origin', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send(validCredentials)
      .expect(403);
  });

  it('rotates refresh tokens, preserves absolute expiry and revokes the family on replay', async () => {
    const ip = nextIp();
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', ip)
      .send(validCredentials)
      .expect(200);
    const originalRefreshCookie = cookieFrom(login, 'tia_refresh');

    await agent
      .post('/api/auth/refresh')
      .set('Origin', origin)
      .set('X-Forwarded-For', ip)
      .expect(204);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: validCredentials.email },
      include: { refreshSessions: { orderBy: { createdAt: 'asc' } } },
    });
    expect(user.refreshSessions).toHaveLength(2);
    expect(user.refreshSessions[0]?.expiresAt.getTime()).toBe(
      user.refreshSessions[1]?.expiresAt.getTime(),
    );
    expect(user.refreshSessions[0]?.replacedById).toBe(
      user.refreshSessions[1]?.id,
    );

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Origin', origin)
      .set('X-Forwarded-For', ip)
      .set('Cookie', originalRefreshCookie)
      .expect(401);
    await agent
      .post('/api/auth/refresh')
      .set('Origin', origin)
      .set('X-Forwarded-For', ip)
      .expect(401);
  });

  it('restores authentication through refresh after the access JWT expires', async () => {
    const ip = nextIp();
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', ip)
      .send(validCredentials)
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    await agent.get('/api/auth/me').set('X-Forwarded-For', ip).expect(401);
    await agent
      .post('/api/auth/refresh')
      .set('Origin', origin)
      .set('X-Forwarded-For', ip)
      .expect(204);
    await agent.get('/api/auth/me').set('X-Forwarded-For', ip).expect(200);
  });

  it('keeps sessions independent and logout revokes only the current session', async () => {
    const first = request.agent(app.getHttpServer());
    const second = request.agent(app.getHttpServer());
    const firstIp = nextIp();
    const secondIp = nextIp();

    await first
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', firstIp)
      .send(validCredentials)
      .expect(200);
    await second
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', secondIp)
      .send(validCredentials)
      .expect(200);

    const logout = await first
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('X-Forwarded-For', firstIp)
      .expect(204);
    expect(
      (logout.headers['set-cookie'] as unknown as string[]).join('\n'),
    ).toContain('tia_refresh=');

    await first
      .post('/api/auth/refresh')
      .set('Origin', origin)
      .set('X-Forwarded-For', firstIp)
      .expect(401);
    await second
      .post('/api/auth/refresh')
      .set('Origin', origin)
      .set('X-Forwarded-For', secondIp)
      .expect(204);
  });

  it('rate limits repeated login attempts by client IP', async () => {
    const ip = nextIp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', origin)
        .set('X-Forwarded-For', ip)
        .send({ ...validCredentials, password: 'wrong' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', ip)
      .send({ ...validCredentials, password: 'wrong' })
      .expect(429);
  });
});

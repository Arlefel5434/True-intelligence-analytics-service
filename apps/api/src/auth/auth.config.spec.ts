import { parseDuration, readAuthConfig } from './auth.config.js';

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
  APP_ORIGIN: 'http://localhost:8080',
  COOKIE_SECURE: 'false',
};

describe('auth config', () => {
  it('parses supported duration units', () => {
    expect(parseDuration('15m', 'TTL')).toBe(900);
    expect(parseDuration('7d', 'TTL')).toBe(604_800);
  });

  it('loads explicit local settings', () => {
    expect(readAuthConfig(baseEnv)).toMatchObject({
      accessTtlSeconds: 900,
      refreshTtlSeconds: 604_800,
      appOrigin: 'http://localhost:8080',
      cookieSecure: false,
    });
  });

  it('rejects equal secrets', () => {
    expect(() =>
      readAuthConfig({
        ...baseEnv,
        JWT_REFRESH_SECRET: baseEnv.JWT_ACCESS_SECRET,
      }),
    ).toThrow('JWT secrets must be different');
  });

  it('rejects malformed durations and origins', () => {
    expect(() => readAuthConfig({ ...baseEnv, JWT_ACCESS_TTL: '900' })).toThrow(
      'JWT_ACCESS_TTL',
    );
    expect(() =>
      readAuthConfig({ ...baseEnv, APP_ORIGIN: 'http://localhost:8080/' }),
    ).toThrow('APP_ORIGIN');
  });

  it('requires strong secrets and secure cookies for a non-local production origin', () => {
    const production = {
      ...baseEnv,
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://analytics.example.test',
    };
    expect(() => readAuthConfig(production)).toThrow('at least 32 characters');
    expect(() =>
      readAuthConfig({
        ...production,
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      }),
    ).toThrow('COOKIE_SECURE must be true');
  });
});

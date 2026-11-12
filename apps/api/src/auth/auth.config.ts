import { JWT_AUDIENCE, JWT_ISSUER } from './auth.constants.js';

export type AuthConfig = {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  appOrigin: string;
  cookieSecure: boolean;
  issuer: string;
  audience: string;
};

const durationPattern = /^(\d+)(s|m|h|d)$/;
const durationUnits = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;

export function parseDuration(value: string, name: string): number {
  const match = durationPattern.exec(value);
  if (!match)
    throw new Error(`${name} must use the format <positive integer><s|m|h|d>`);

  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount < 1)
    throw new Error(`${name} must be positive`);

  return amount * durationUnits[match[2] as keyof typeof durationUnits];
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readBoolean(env: NodeJS.ProcessEnv, name: string): boolean {
  const value = required(env, name);
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function readOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('APP_ORIGIN must be an absolute URL');
  }

  if (url.origin !== value || url.username || url.password) {
    throw new Error(
      'APP_ORIGIN must contain only scheme, host and optional port',
    );
  }
  return url.origin;
}

export function readAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const accessSecret = required(env, 'JWT_ACCESS_SECRET');
  const refreshSecret = required(env, 'JWT_REFRESH_SECRET');
  const cookieSecure = readBoolean(env, 'COOKIE_SECURE');
  const nodeEnv = env.NODE_ENV ?? 'development';
  const appOrigin = readOrigin(required(env, 'APP_ORIGIN'));
  const originUrl = new URL(appOrigin);
  const localDemo =
    originUrl.protocol === 'http:' &&
    (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1');

  if (accessSecret === refreshSecret)
    throw new Error('JWT secrets must be different');
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    if (accessSecret.length < 32 || refreshSecret.length < 32) {
      throw new Error(
        'JWT secrets must contain at least 32 characters outside development',
      );
    }
    if (!cookieSecure && !localDemo)
      throw new Error(
        'COOKIE_SECURE must be true outside development, test and local demo',
      );
  }

  return {
    accessSecret,
    refreshSecret,
    accessTtlSeconds: parseDuration(
      required(env, 'JWT_ACCESS_TTL'),
      'JWT_ACCESS_TTL',
    ),
    refreshTtlSeconds: parseDuration(
      required(env, 'JWT_REFRESH_TTL'),
      'JWT_REFRESH_TTL',
    ),
    appOrigin,
    cookieSecure,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };
}

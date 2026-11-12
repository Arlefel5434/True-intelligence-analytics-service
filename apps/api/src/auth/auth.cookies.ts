import type { CookieOptions, Response } from 'express';
import {
  ACCESS_COOKIE_NAME,
  ACCESS_COOKIE_PATH,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
} from './auth.constants.js';
import type { AuthConfig } from './auth.config.js';
import type { IssuedSession } from './auth.types.js';

function baseCookieOptions(config: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
  };
}

export function setAuthCookies(
  response: Response,
  config: AuthConfig,
  session: IssuedSession,
): void {
  response.cookie(ACCESS_COOKIE_NAME, session.accessToken, {
    ...baseCookieOptions(config),
    path: ACCESS_COOKIE_PATH,
    maxAge: config.accessTtlSeconds * 1_000,
  });
  response.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
    ...baseCookieOptions(config),
    path: REFRESH_COOKIE_PATH,
    expires: session.refreshExpiresAt,
  });
}

export function clearAuthCookies(response: Response, config: AuthConfig): void {
  response.clearCookie(ACCESS_COOKIE_NAME, {
    ...baseCookieOptions(config),
    path: ACCESS_COOKIE_PATH,
  });
  response.clearCookie(REFRESH_COOKIE_NAME, {
    ...baseCookieOptions(config),
    path: REFRESH_COOKIE_PATH,
  });
}

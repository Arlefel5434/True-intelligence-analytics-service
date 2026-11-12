import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../generated/prisma/client.js';
import { ACCESS_COOKIE_NAME, AUTH_CONFIG } from './auth.constants.js';
import type { AuthConfig } from './auth.config.js';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types.js';

function cookieExtractor(request: Request): string | null {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[ACCESS_COOKIE_NAME];
  return typeof token === 'string' ? token : null;
}

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(AUTH_CONFIG) config: AuthConfig) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.accessSecret,
      algorithms: ['HS256'],
      issuer: config.issuer,
      audience: config.audience,
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    const validRole =
      payload.role === UserRole.ADMIN || payload.role === UserRole.CLIENT;
    const validCompany =
      (payload.role === UserRole.ADMIN && payload.companyId === null) ||
      (payload.role === UserRole.CLIENT &&
        typeof payload.companyId === 'string');
    if (typeof payload.sub !== 'string' || !validRole || !validCompany) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}

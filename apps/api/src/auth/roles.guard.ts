import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from './auth.types.js';
import { ROLES_KEY } from './roles.decorator.js';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new UnauthorizedException();
    if (!roles.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}

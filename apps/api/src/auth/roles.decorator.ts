import { applyDecorators, SetMetadata } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

export const AdminOnly = (): MethodDecorator & ClassDecorator =>
  applyDecorators(Roles(UserRole.ADMIN));

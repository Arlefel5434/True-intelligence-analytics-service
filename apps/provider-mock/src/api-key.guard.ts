import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ProviderConfig } from './config';
import { PROVIDER_CONFIG } from './provider.constants';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(PROVIDER_CONFIG) private readonly config: ProviderConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const candidate = request.header('X-API-Key') ?? '';
    if (!timingSafeEqual(digest(candidate), digest(this.config.apiKey))) {
      throw new UnauthorizedException('Invalid API credentials');
    }
    return true;
  }
}

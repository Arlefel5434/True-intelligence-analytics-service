import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import {
  COMPANY_CONTEXT_REQUEST_KEY,
  COMPANY_ID_HEADER,
  COMPANY_SCOPED_KEY,
} from './authorization.constants.js';
import { CompanyContextService } from './company-context.service.js';
import type { RequestWithCompanyContext } from './company-context.types.js';

type CompanyRequest = RequestWithCompanyContext & { user?: AuthenticatedUser };

@Injectable()
export class CompanyContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly companyContextService: CompanyContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const companyScoped = this.reflector.getAllAndOverride<boolean>(
      COMPANY_SCOPED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!companyScoped) return true;

    const request = context.switchToHttp().getRequest<CompanyRequest>();
    if (!request.user) throw new UnauthorizedException();
    request[COMPANY_CONTEXT_REQUEST_KEY] =
      await this.companyContextService.resolve(
        request.user,
        request.headers[COMPANY_ID_HEADER],
      );
    return true;
  }
}

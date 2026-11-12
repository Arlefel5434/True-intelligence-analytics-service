import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { COMPANY_CONTEXT_REQUEST_KEY } from './authorization.constants.js';
import type {
  CompanyContext,
  RequestWithCompanyContext,
} from './company-context.types.js';

export const CurrentCompany = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CompanyContext => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithCompanyContext>();
    const companyContext = request[COMPANY_CONTEXT_REQUEST_KEY];
    if (!companyContext) {
      throw new InternalServerErrorException('Company context is unavailable');
    }
    return companyContext;
  },
);

import { SetMetadata } from '@nestjs/common';
import { COMPANY_SCOPED_KEY } from './authorization.constants.js';

export const CompanyScoped = (): MethodDecorator & ClassDecorator =>
  SetMetadata(COMPANY_SCOPED_KEY, true);

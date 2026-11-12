import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/client.js';
import { COMPANY_CONTEXT_REQUEST_KEY } from './authorization.constants.js';

export type CompanyContext = Readonly<{
  userId: string;
  role: UserRole;
  companyId: string;
}>;

export type CompanySummary = Readonly<{
  id: string;
  name: string;
}>;

export type BranchSummary = Readonly<{
  id: string;
  companyId: string;
  externalId: string;
  name: string;
  address: string;
}>;

export type RequestWithCompanyContext = Request & {
  [COMPANY_CONTEXT_REQUEST_KEY]?: CompanyContext;
};

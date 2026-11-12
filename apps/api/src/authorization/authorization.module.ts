import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from '../auth/roles.guard.js';
import { BranchAccessService } from './branch-access.service.js';
import { CompanyAccessService } from './company-access.service.js';
import { CompanyContextGuard } from './company-context.guard.js';
import { CompanyContextService } from './company-context.service.js';

@Module({
  providers: [
    CompanyContextService,
    CompanyAccessService,
    BranchAccessService,
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CompanyContextGuard },
  ],
  exports: [CompanyContextService, CompanyAccessService, BranchAccessService],
})
export class AuthorizationModule {}

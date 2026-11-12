import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/roles.decorator.js';
import { BranchAccessService } from '../authorization/branch-access.service.js';
import { CompanyAccessService } from '../authorization/company-access.service.js';
import { CompanyScoped } from '../authorization/company-scoped.decorator.js';
import type { CompanyContext } from '../authorization/company-context.types.js';
import { CurrentCompany } from '../authorization/current-company.decorator.js';

class CompanyDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  name!: string;
}

class BranchDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  companyId!: string;
  @ApiProperty()
  externalId!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  address!: string;
}

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(
    private readonly companies: CompanyAccessService,
    private readonly branches: BranchAccessService,
  ) {}

  @Get('companies')
  @AdminOnly()
  @ApiOkResponse({ type: [CompanyDto] })
  companiesList() {
    return this.companies.listForAdmin();
  }

  @Get('branches')
  @CompanyScoped()
  @ApiOkResponse({ type: [BranchDto] })
  branchesList(@CurrentCompany() context: CompanyContext) {
    return this.branches.list(context);
  }
}

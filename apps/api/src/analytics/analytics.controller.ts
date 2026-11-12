import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CompanyScoped } from '../authorization/company-scoped.decorator.js';
import type { CompanyContext } from '../authorization/company-context.types.js';
import { CurrentCompany } from '../authorization/current-company.decorator.js';
import { AnalyticsQueryDto, AnalyticsResponseDto } from './analytics.dto.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@Controller('analytics')
@CompanyScoped()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @ApiOkResponse({ type: AnalyticsResponseDto })
  get(
    @CurrentCompany() context: CompanyContext,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    return this.analytics.get(context, query);
  }
}

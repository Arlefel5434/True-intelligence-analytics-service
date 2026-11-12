import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyGuard } from './api-key.guard';
import { StatisticsPageDto, StatisticsQueryDto } from './statistics.dto';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@Controller('v1/statistics')
@UseGuards(ApiKeyGuard)
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get()
  @ApiOperation({ summary: 'Get deterministic daily statistics' })
  @ApiHeader({ name: 'X-API-Key', required: true })
  @ApiHeader({ name: 'X-Mock-Scenario', required: false })
  @ApiHeader({ name: 'X-Mock-Fail-Page', required: false })
  @ApiOkResponse({ type: StatisticsPageDto })
  @ApiUnauthorizedResponse({ description: 'Invalid API credentials' })
  getStatistics(
    @Query() query: StatisticsQueryDto,
    @Headers('x-mock-scenario') scenario?: string,
    @Headers('x-mock-fail-page') failPage?: string,
  ): StatisticsPageDto {
    return this.statistics.getPage(query, scenario, failPage);
  }
}

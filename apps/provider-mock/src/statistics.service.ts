import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ProviderConfig } from './config';
import { PROVIDER_CONFIG } from './provider.constants';
import type {
  StatisticRecordDto,
  StatisticsPageDto,
  StatisticsQueryDto,
} from './statistics.dto';

export const EXTERNAL_BRANCH_IDS = [
  'mock-branch-a-1',
  'mock-branch-a-2',
  'mock-branch-b-1',
] as const;

const DAY_MS = 86_400_000;

function parseDate(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(`${value} is not a valid calendar date`);
  }
  return timestamp;
}

export function generateRecord(
  externalBranchId: string,
  branchIndex: number,
  date: string,
): StatisticRecordDto {
  const day = Math.floor(parseDate(date) / DAY_MS);
  const seed = Math.abs(day * 17 + branchIndex * 31);
  const newReviewsCount = seed % 6 === 0 ? 2 : seed % 11 === 0 ? 1 : 0;
  return {
    externalId: `mock-provider:${externalBranchId}:${date}`,
    externalBranchId,
    date,
    views: 80 + (seed % 240),
    searches: 30 + (seed % 90),
    websiteClicks: 8 + (seed % 35),
    calls: 2 + (seed % 18),
    routeBuilds: 5 + (seed % 30),
    newReviewsCount,
    averageRating: newReviewsCount === 0 ? null : 3.5 + (seed % 7) * 0.25,
  };
}

@Injectable()
export class StatisticsService {
  constructor(
    @Inject(PROVIDER_CONFIG) private readonly config: ProviderConfig,
  ) {}

  getPage(
    query: StatisticsQueryDto,
    scenario: string | undefined,
    failPageHeader: string | undefined,
  ): StatisticsPageDto {
    this.applyScenario(query.page, scenario, failPageHeader);
    if (
      query.externalBranchId !== undefined &&
      query.externalBranchId !== query.externalBranchId.trim()
    ) {
      throw new BadRequestException(
        'externalBranchId must not have surrounding whitespace',
      );
    }
    const from = parseDate(query.from);
    const to = parseDate(query.to);
    if (from > to) throw new BadRequestException('from must not be after to');
    const days = Math.floor((to - from) / DAY_MS) + 1;
    if (days > 31)
      throw new BadRequestException('Date range must not exceed 31 days');

    const branches = query.externalBranchId
      ? EXTERNAL_BRANCH_IDS.filter((id) => id === query.externalBranchId)
      : [...EXTERNAL_BRANCH_IDS];
    const records: StatisticRecordDto[] = [];
    for (let timestamp = from; timestamp <= to; timestamp += DAY_MS) {
      const date = new Date(timestamp).toISOString().slice(0, 10);
      for (const branch of branches) {
        records.push(
          generateRecord(branch, EXTERNAL_BRANCH_IDS.indexOf(branch), date),
        );
      }
    }
    const totalItems = records.length;
    const start = (query.page - 1) * query.pageSize;
    return {
      items: records.slice(start, start + query.pageSize),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  private applyScenario(
    page: number,
    scenario: string | undefined,
    failPageHeader: string | undefined,
  ): void {
    if (scenario === undefined && failPageHeader === undefined) return;
    if (!this.config.mockScenariosEnabled) {
      throw new BadRequestException('Mock scenarios are disabled');
    }
    if (scenario !== 'server-error') {
      throw new BadRequestException('Unknown mock scenario');
    }
    let failPage: number | undefined;
    if (failPageHeader !== undefined) {
      failPage = Number(failPageHeader);
      if (!Number.isInteger(failPage) || failPage < 1) {
        throw new BadRequestException(
          'X-Mock-Fail-Page must be a positive integer',
        );
      }
    }
    if (failPage === undefined || page === failPage) {
      throw new InternalServerErrorException('Mock provider failure');
    }
  }
}

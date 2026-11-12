import { BadRequestException, Injectable } from '@nestjs/common';
import { BranchAccessService } from '../authorization/branch-access.service.js';
import type { CompanyContext } from '../authorization/company-context.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AnalyticsMetric,
  type AnalyticsQueryDto,
  type AnalyticsResponseDto,
  type AnalyticsTotalsDto,
} from './analytics.dto.js';

const DAY_MS = 86_400_000;

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('from and to must be valid calendar dates');
  }
  return date;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchAccessService,
  ) {}

  async get(
    context: CompanyContext,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    const from = parseDate(query.from);
    const to = parseDate(query.to);
    const days = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
    if (days < 1 || days > 366) {
      throw new BadRequestException(
        'Analytics range must be between 1 and 366 days',
      );
    }

    const branchIds = query.branchId
      ? [(await this.branches.find(context, query.branchId)).id]
      : (await this.branches.list(context)).map((branch) => branch.id);
    const metrics = await this.prisma.dailyMetric.findMany({
      where: { branchId: { in: branchIds }, date: { gte: from, lte: to } },
      select: {
        date: true,
        views: true,
        searches: true,
        websiteClicks: true,
        calls: true,
        routeBuilds: true,
        newReviewsCount: true,
        averageRating: true,
      },
      orderBy: { date: 'asc' },
    });

    const totals: AnalyticsTotalsDto = {
      views: 0,
      searches: 0,
      websiteClicks: 0,
      calls: 0,
      routeBuilds: 0,
      newReviewsCount: 0,
      averageRating: null,
    };
    let totalRatingWeight = 0;
    const byDate = new Map<
      string,
      AnalyticsTotalsDto & { ratingWeight: number }
    >();
    for (const metric of metrics) {
      totals.views += metric.views;
      totals.searches += metric.searches;
      totals.websiteClicks += metric.websiteClicks;
      totals.calls += metric.calls;
      totals.routeBuilds += metric.routeBuilds;
      totals.newReviewsCount += metric.newReviewsCount;
      totalRatingWeight +=
        Number(metric.averageRating ?? 0) * metric.newReviewsCount;

      const date = metric.date.toISOString().slice(0, 10);
      const daily = byDate.get(date) ?? {
        views: 0,
        searches: 0,
        websiteClicks: 0,
        calls: 0,
        routeBuilds: 0,
        newReviewsCount: 0,
        averageRating: null,
        ratingWeight: 0,
      };
      daily.views += metric.views;
      daily.searches += metric.searches;
      daily.websiteClicks += metric.websiteClicks;
      daily.calls += metric.calls;
      daily.routeBuilds += metric.routeBuilds;
      daily.newReviewsCount += metric.newReviewsCount;
      daily.ratingWeight +=
        Number(metric.averageRating ?? 0) * metric.newReviewsCount;
      byDate.set(date, daily);
    }
    totals.averageRating =
      totals.newReviewsCount === 0
        ? null
        : Number((totalRatingWeight / totals.newReviewsCount).toFixed(2));

    const series = [...byDate.entries()].map(([date, daily]) => ({
      date,
      value:
        query.metric === AnalyticsMetric.AVERAGE_RATING
          ? daily.newReviewsCount === 0
            ? null
            : Number((daily.ratingWeight / daily.newReviewsCount).toFixed(2))
          : daily[query.metric],
    }));
    return {
      filters: {
        from: query.from,
        to: query.to,
        branchId: query.branchId ?? null,
        metric: query.metric,
      },
      totals,
      series,
      metadata: { branchCount: branchIds.length, dataPoints: metrics.length },
    };
  }
}

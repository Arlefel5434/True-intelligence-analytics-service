import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  DataSource,
  ImportStatus,
  Prisma,
  type ImportRun,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { MAX_PROVIDER_PAGES, PROVIDER_PAGE_SIZE } from './import.constants.js';
import { ImportLockService } from './import-lock.service.js';
import type { ImportRunResponse, ImportWarning } from './import.types.js';
import { ProviderClientService } from './provider-client.service.js';
import type { ProviderPage, ProviderRecord } from './provider.types.js';

const DAY_MS = 86_400_000;

class RejectedPageError extends Error {}

type Counts = { created: number; updated: number; skipped: number };

function parseCalendarDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new RejectedPageError('Invalid calendar date');
  }
  return date;
}

function sameMetric(
  existing: {
    views: number;
    searches: number;
    websiteClicks: number;
    calls: number;
    routeBuilds: number;
    newReviewsCount: number;
    averageRating: Prisma.Decimal | null;
  },
  record: ProviderRecord,
): boolean {
  return (
    existing.views === record.views &&
    existing.searches === record.searches &&
    existing.websiteClicks === record.websiteClicks &&
    existing.calls === record.calls &&
    existing.routeBuilds === record.routeBuilds &&
    existing.newReviewsCount === record.newReviewsCount &&
    (existing.averageRating === null
      ? record.averageRating === null
      : Number(existing.averageRating) === record.averageRating)
  );
}

@Injectable()
export class StatisticsImportService {
  private readonly logger = new Logger(StatisticsImportService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: ProviderClientService,
    private readonly locks: ImportLockService,
  ) {}

  async run(
    from: string,
    to: string,
    userId: string,
  ): Promise<ImportRunResponse> {
    let dateFrom: Date;
    let dateTo: Date;
    try {
      dateFrom = parseCalendarDate(from);
      dateTo = parseCalendarDate(to);
    } catch {
      throw new BadRequestException('from and to must be valid calendar dates');
    }
    const days =
      Math.floor((dateTo.getTime() - dateFrom.getTime()) / DAY_MS) + 1;
    if (days < 1 || days > 31)
      throw new BadRequestException(
        'Import date range must be between 1 and 31 days',
      );

    const lock = await this.locks.acquire();
    if (!lock)
      throw new ConflictException('Statistics import is already running');
    try {
      const run = await this.prisma.importRun.create({
        data: {
          id: randomUUID(),
          source: DataSource.MOCK_PROVIDER,
          dateFrom,
          dateTo,
          triggeredById: userId,
        },
      });
      this.logger.log(
        JSON.stringify({ event: 'import_started', runId: run.id, from, to }),
      );
      return await this.execute(run, from, to, dateFrom, dateTo);
    } finally {
      await lock.release();
    }
  }

  private async execute(
    run: ImportRun,
    from: string,
    to: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<ImportRunResponse> {
    const warnings: ImportWarning[] = [];
    const counts: Counts = { created: 0, updated: 0, skipped: 0 };
    let savedPages = 0;
    let totalPages: number | undefined;

    try {
      for (
        let pageNumber = 1;
        pageNumber <= (totalPages ?? 1);
        pageNumber += 1
      ) {
        let page: ProviderPage;
        try {
          page = await this.provider.getPage(from, to, pageNumber);
        } catch {
          this.addWarning(warnings, {
            code: 'PAGE_UNAVAILABLE',
            page: pageNumber,
            message: 'Provider page is unavailable',
          });
          if (pageNumber === 1) break;
          continue;
        }

        if (totalPages === undefined) {
          totalPages = page.pagination.totalPages;
          if (totalPages > MAX_PROVIDER_PAGES) {
            this.addWarning(warnings, {
              code: 'INVALID_PAGE',
              page: pageNumber,
              message: 'Provider pagination exceeds the safety limit',
            });
            break;
          }
        }
        if (!this.paginationMatches(page, pageNumber, totalPages)) {
          counts.skipped += page.items.length;
          this.addWarning(warnings, {
            code: 'INVALID_PAGE',
            page: pageNumber,
            message: 'Provider pagination changed during import',
          });
          continue;
        }

        try {
          this.validatePage(page, dateFrom, dateTo);
          const pageCounts = await this.persistPage(page, pageNumber, warnings);
          counts.created += pageCounts.created;
          counts.updated += pageCounts.updated;
          counts.skipped += pageCounts.skipped;
          savedPages += 1;
        } catch (error) {
          counts.skipped += page.items.length;
          this.addWarning(warnings, {
            code: 'INVALID_PAGE',
            page: pageNumber,
            message:
              error instanceof RejectedPageError
                ? error.message
                : 'Provider page could not be stored',
          });
        }
      }

      const status =
        savedPages === 0
          ? ImportStatus.FAILED
          : warnings.length > 0
            ? ImportStatus.COMPLETED_WITH_WARNINGS
            : ImportStatus.COMPLETED;
      const errorMessage =
        status === ImportStatus.FAILED
          ? 'No provider pages were imported'
          : null;
      const completed = await this.finish(
        run.id,
        status,
        counts,
        warnings,
        errorMessage,
      );
      this.logger.log(
        JSON.stringify({
          event: 'import_finished',
          runId: run.id,
          status,
          ...counts,
          warnings: warnings.length,
        }),
      );
      return this.toResponse(completed, warnings);
    } catch {
      const completed = await this.finish(
        run.id,
        ImportStatus.FAILED,
        counts,
        warnings,
        'Statistics import failed',
      );
      this.logger.error(
        JSON.stringify({
          event: 'import_failed',
          runId: run.id,
          ...counts,
          warnings: warnings.length,
        }),
      );
      return this.toResponse(completed, warnings);
    }
  }

  private paginationMatches(
    page: ProviderPage,
    number: number,
    total: number,
  ): boolean {
    return (
      page.pagination.page === number &&
      page.pagination.pageSize === PROVIDER_PAGE_SIZE &&
      page.pagination.totalPages === total
    );
  }

  private validatePage(page: ProviderPage, from: Date, to: Date): void {
    const ids = new Set<string>();
    for (const record of page.items) {
      const date = parseCalendarDate(record.date);
      if (date < from || date > to)
        throw new RejectedPageError(
          'Record date is outside the requested range',
        );
      if (ids.has(record.externalId))
        throw new RejectedPageError('Duplicate external ID in provider page');
      ids.add(record.externalId);
    }
  }

  private async persistPage(
    page: ProviderPage,
    pageNumber: number,
    warnings: ImportWarning[],
  ): Promise<Counts> {
    const branchIds = [
      ...new Set(page.items.map((item) => item.externalBranchId)),
    ];
    const branches = await this.prisma.branch.findMany({
      where: { externalId: { in: branchIds } },
      select: { id: true, externalId: true },
    });
    const byExternalId = new Map(
      branches.map((branch) => [branch.externalId, branch.id]),
    );
    const unknown = new Set(branchIds.filter((id) => !byExternalId.has(id)));
    for (const externalBranchId of unknown) {
      this.addWarning(warnings, {
        code: 'UNKNOWN_BRANCH',
        page: pageNumber,
        externalBranchId,
        message: 'External branch is not mapped',
      });
    }
    const known = page.items.filter((item) =>
      byExternalId.has(item.externalBranchId),
    );
    const counts = await this.prisma.$transaction(async (transaction) => {
      const result: Counts = { created: 0, updated: 0, skipped: 0 };
      for (const record of known) {
        const branchId = byExternalId.get(record.externalBranchId)!;
        const date = parseCalendarDate(record.date);
        const byExternal = await transaction.dailyMetric.findUnique({
          where: {
            source_externalId: {
              source: DataSource.MOCK_PROVIDER,
              externalId: record.externalId,
            },
          },
        });
        const byDate = await transaction.dailyMetric.findUnique({
          where: { branchId_date: { branchId, date } },
        });
        if (
          (byExternal &&
            (byExternal.branchId !== branchId ||
              byExternal.date.getTime() !== date.getTime())) ||
          (byDate && byDate.externalId !== record.externalId)
        ) {
          throw new RejectedPageError(
            'Provider record identity conflicts with stored metrics',
          );
        }
        const data = {
          branchId,
          date,
          views: record.views,
          searches: record.searches,
          websiteClicks: record.websiteClicks,
          calls: record.calls,
          routeBuilds: record.routeBuilds,
          newReviewsCount: record.newReviewsCount,
          averageRating: record.averageRating,
          source: DataSource.MOCK_PROVIDER,
          externalId: record.externalId,
        };
        if (!byExternal) {
          await transaction.dailyMetric.create({
            data: { id: randomUUID(), ...data },
          });
          result.created += 1;
        } else if (sameMetric(byExternal, record)) {
          result.skipped += 1;
        } else {
          await transaction.dailyMetric.update({
            where: {
              source_externalId: {
                source: DataSource.MOCK_PROVIDER,
                externalId: record.externalId,
              },
            },
            data,
          });
          result.updated += 1;
        }
      }
      return result;
    });
    counts.skipped += page.items.length - known.length;
    return counts;
  }

  private addWarning(warnings: ImportWarning[], warning: ImportWarning): void {
    if (warnings.length < 100) warnings.push(warning);
    else if (warnings.at(-1)?.code !== 'WARNINGS_TRUNCATED') {
      warnings[99] = {
        code: 'WARNINGS_TRUNCATED',
        page: warning.page,
        message: 'Additional warnings were omitted',
      };
    }
  }

  private finish(
    id: string,
    status: ImportStatus,
    counts: Counts,
    warnings: ImportWarning[],
    errorMessage: string | null,
  ): Promise<ImportRun> {
    return this.prisma.importRun.update({
      where: { id },
      data: {
        status,
        createdCount: counts.created,
        updatedCount: counts.updated,
        skippedCount: counts.skipped,
        warnings: warnings as unknown as Prisma.InputJsonValue,
        errorMessage,
        finishedAt: new Date(),
      },
    });
  }

  private toResponse(
    run: ImportRun,
    warnings: ImportWarning[],
  ): ImportRunResponse {
    return {
      id: run.id,
      source: 'MOCK_PROVIDER',
      dateFrom: run.dateFrom.toISOString().slice(0, 10),
      dateTo: run.dateTo.toISOString().slice(0, 10),
      status: run.status,
      createdCount: run.createdCount,
      updatedCount: run.updatedCount,
      skippedCount: run.skippedCount,
      warnings,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt!.toISOString(),
    };
  }
}

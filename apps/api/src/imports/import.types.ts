import type { ImportStatus } from '../generated/prisma/client.js';

export type ImportWarning = Readonly<{
  code:
    | 'UNKNOWN_BRANCH'
    | 'INVALID_PAGE'
    | 'PAGE_UNAVAILABLE'
    | 'WARNINGS_TRUNCATED';
  page: number;
  message: string;
  externalBranchId?: string;
}>;

export type ImportRunResponse = Readonly<{
  id: string;
  source: 'MOCK_PROVIDER';
  dateFrom: string;
  dateTo: string;
  status: ImportStatus;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  warnings: ImportWarning[];
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string;
}>;

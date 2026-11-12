import type { ImportStatus } from '../generated/prisma/client.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class ImportWarningDto {
  @ApiProperty() code!: string;
  @ApiProperty() page!: number;
  @ApiProperty() message!: string;
  @ApiPropertyOptional() externalBranchId?: string;
}

export class ImportRunResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['MOCK_PROVIDER'] }) source!: 'MOCK_PROVIDER';
  @ApiProperty() dateFrom!: string;
  @ApiProperty() dateTo!: string;
  @ApiProperty({
    enum: ['RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED'],
  })
  status!: ImportStatus;
  @ApiProperty() createdCount!: number;
  @ApiProperty() updatedCount!: number;
  @ApiProperty() skippedCount!: number;
  @ApiProperty({ type: [ImportWarningDto] }) warnings!: ImportWarningDto[];
  @ApiProperty({ nullable: true }) errorMessage!: string | null;
  @ApiProperty() startedAt!: string;
  @ApiProperty() finishedAt!: string;
}

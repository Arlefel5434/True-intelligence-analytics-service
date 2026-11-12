import { Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class RunStatisticsImportDto {
  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE_PATTERN)
  from!: string;

  @ApiProperty({ example: '2026-10-31' })
  @Matches(DATE_PATTERN)
  to!: string;
}

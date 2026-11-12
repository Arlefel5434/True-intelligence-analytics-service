import { Matches } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class RunStatisticsImportDto {
  @Matches(DATE_PATTERN)
  from!: string;

  @Matches(DATE_PATTERN)
  to!: string;
}

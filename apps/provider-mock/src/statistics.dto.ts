import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class StatisticsQueryDto {
  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE_PATTERN)
  from!: string;

  @ApiProperty({ example: '2026-10-31' })
  @Matches(DATE_PATTERN)
  to!: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 50;

  @ApiPropertyOptional({ example: 'mock-branch-a-1', maxLength: 128 })
  @IsString()
  @MaxLength(128)
  @IsOptional()
  externalBranchId?: string;
}

export class StatisticRecordDto {
  @ApiProperty() externalId!: string;
  @ApiProperty() externalBranchId!: string;
  @ApiProperty({ example: '2026-10-01' }) date!: string;
  @ApiProperty() views!: number;
  @ApiProperty() searches!: number;
  @ApiProperty() websiteClicks!: number;
  @ApiProperty() calls!: number;
  @ApiProperty() routeBuilds!: number;
  @ApiProperty() newReviewsCount!: number;
  @ApiProperty({ nullable: true, example: 4.5 }) averageRating!: number | null;
}

export class PaginationDto {
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() totalItems!: number;
  @ApiProperty() totalPages!: number;
}

export class StatisticsPageDto {
  @ApiProperty({ type: [StatisticRecordDto] }) items!: StatisticRecordDto[];
  @ApiProperty({ type: PaginationDto }) pagination!: PaginationDto;
}

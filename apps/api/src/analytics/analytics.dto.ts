import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AnalyticsMetric {
  VIEWS = 'views',
  SEARCHES = 'searches',
  WEBSITE_CLICKS = 'websiteClicks',
  CALLS = 'calls',
  ROUTE_BUILDS = 'routeBuilds',
  NEW_REVIEWS_COUNT = 'newReviewsCount',
  AVERAGE_RATING = 'averageRating',
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class AnalyticsQueryDto {
  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE_PATTERN)
  from!: string;

  @ApiProperty({ example: '2026-10-31' })
  @Matches(DATE_PATTERN)
  to!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ enum: AnalyticsMetric, default: AnalyticsMetric.VIEWS })
  @IsEnum(AnalyticsMetric)
  metric: AnalyticsMetric = AnalyticsMetric.VIEWS;
}

export class AnalyticsFiltersDto {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty({ type: String, nullable: true }) branchId!: string | null;
  @ApiProperty({ enum: AnalyticsMetric }) metric!: AnalyticsMetric;
}

export class AnalyticsTotalsDto {
  @ApiProperty() views!: number;
  @ApiProperty() searches!: number;
  @ApiProperty() websiteClicks!: number;
  @ApiProperty() calls!: number;
  @ApiProperty() routeBuilds!: number;
  @ApiProperty() newReviewsCount!: number;
  @ApiProperty({ type: Number, nullable: true }) averageRating!: number | null;
}

export class AnalyticsSeriesPointDto {
  @ApiProperty() date!: string;
  @ApiProperty({ type: Number, nullable: true }) value!: number | null;
}

export class AnalyticsMetadataDto {
  @ApiProperty() branchCount!: number;
  @ApiProperty() dataPoints!: number;
}

export class AnalyticsResponseDto {
  @ApiProperty({ type: AnalyticsFiltersDto }) filters!: AnalyticsFiltersDto;
  @ApiProperty({ type: AnalyticsTotalsDto }) totals!: AnalyticsTotalsDto;
  @ApiProperty({ type: [AnalyticsSeriesPointDto] })
  series!: AnalyticsSeriesPointDto[];
  @ApiProperty({ type: AnalyticsMetadataDto }) metadata!: AnalyticsMetadataDto;
}

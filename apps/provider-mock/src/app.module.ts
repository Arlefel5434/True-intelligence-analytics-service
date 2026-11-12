import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { readProviderConfig } from './config';
import { HealthController } from './health.controller';
import { PROVIDER_CONFIG } from './provider.constants';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  controllers: [HealthController, StatisticsController],
  providers: [
    { provide: PROVIDER_CONFIG, useFactory: readProviderConfig },
    ApiKeyGuard,
    StatisticsService,
  ],
})
export class AppModule {}

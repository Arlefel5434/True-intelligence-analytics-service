import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { CatalogController } from './catalog.controller.js';

@Module({
  imports: [AuthorizationModule],
  controllers: [AnalyticsController, CatalogController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}

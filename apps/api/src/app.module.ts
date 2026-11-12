import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { ImportModule } from './imports/import.module.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuthorizationModule,
    ImportModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

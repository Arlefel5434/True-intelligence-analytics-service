import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { ImportModule } from './imports/import.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, AuthorizationModule, ImportModule],
  controllers: [HealthController],
})
export class AppModule {}

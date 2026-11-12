import { Module } from '@nestjs/common';
import { IMPORT_CONFIG } from './import.constants.js';
import { readImportConfig } from './import.config.js';
import { ImportController } from './import.controller.js';
import { ImportLockService } from './import-lock.service.js';
import { ProviderClientService } from './provider-client.service.js';
import { StatisticsImportService } from './statistics-import.service.js';

@Module({
  controllers: [ImportController],
  providers: [
    { provide: IMPORT_CONFIG, useFactory: readImportConfig },
    ProviderClientService,
    ImportLockService,
    StatisticsImportService,
  ],
  exports: [ProviderClientService, ImportLockService, StatisticsImportService],
})
export class ImportModule {}

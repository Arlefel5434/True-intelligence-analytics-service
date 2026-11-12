import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { RunStatisticsImportDto } from './dto/run-statistics-import.dto.js';
import {
  ImportRunResponseDto,
  type ImportRunResponse,
} from './import.types.js';
import { StatisticsImportService } from './statistics-import.service.js';

@Controller('imports')
@ApiTags('imports')
export class ImportController {
  constructor(private readonly imports: StatisticsImportService) {}

  @Post('statistics')
  @AdminOnly()
  @ApiCreatedResponse({ type: ImportRunResponseDto })
  runStatisticsImport(
    @Body() body: RunStatisticsImportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ImportRunResponse> {
    return this.imports.run(body.from, body.to, user.sub);
  }
}

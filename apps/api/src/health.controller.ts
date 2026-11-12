import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';

export type HealthResponse = {
  status: 'ok';
  service: 'api';
};

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live(): HealthResponse {
    return { status: 'ok', service: 'api' };
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'api' };
  }
}

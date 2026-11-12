import { Controller, Get } from '@nestjs/common';

export type HealthResponse = {
  status: 'ok';
  service: 'provider-mock';
};

@Controller('health')
export class HealthController {
  @Get('live')
  live(): HealthResponse {
    return { status: 'ok', service: 'provider-mock' };
  }
}

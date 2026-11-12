import { jest } from '@jest/globals';
import { HealthController } from './health.controller.js';
import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from './database/prisma.service.js';

describe('HealthController', () => {
  const queryRaw = jest.fn(async () => [{ '?column?': 1 }]);
  const controller = new HealthController({
    $queryRaw: queryRaw,
  } as unknown as PrismaService);

  it('reports that the API is alive', () => {
    expect(controller.live()).toEqual({
      status: 'ok',
      service: 'api',
    });
  });

  it('reports readiness after checking the database', async () => {
    await expect(controller.ready()).resolves.toEqual({
      status: 'ok',
      service: 'api',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports database failure while liveness remains healthy', async () => {
    const failing = new HealthController({
      $queryRaw: jest.fn(async () => {
        throw new Error('connection failed');
      }),
    } as unknown as PrismaService);
    expect(failing.live().status).toBe('ok');
    await expect(failing.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

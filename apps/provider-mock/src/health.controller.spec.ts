import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports that the provider mock is alive', () => {
    expect(new HealthController().live()).toEqual({
      status: 'ok',
      service: 'provider-mock',
    });
  });
});

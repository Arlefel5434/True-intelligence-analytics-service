import { generateRecord, StatisticsService } from './statistics.service';

describe('StatisticsService', () => {
  const service = new StatisticsService({
    apiKey: 'not-used',
    mockScenariosEnabled: true,
  });

  it('generates the same record for the same branch and date', () => {
    const first = generateRecord('mock-branch-a-1', 0, '2026-10-12');
    expect(generateRecord('mock-branch-a-1', 0, '2026-10-12')).toEqual(first);
    expect(first.externalId).toBe('mock-provider:mock-branch-a-1:2026-10-12');
  });

  it('keeps pagination stable across page sizes', () => {
    const firstPage = service.getPage(
      { from: '2026-10-01', to: '2026-10-03', page: 1, pageSize: 4 },
      undefined,
      undefined,
    );
    const largerPage = service.getPage(
      { from: '2026-10-01', to: '2026-10-03', page: 1, pageSize: 8 },
      undefined,
      undefined,
    );
    expect(largerPage.items.slice(0, 4)).toEqual(firstPage.items);
  });
});

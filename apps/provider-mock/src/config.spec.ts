import { readPort, readProviderConfig } from './config';

describe('readPort', () => {
  it('uses the fallback when PORT is absent', () => {
    expect(readPort(undefined, 3001)).toBe(3001);
  });

  it('rejects an invalid PORT', () => {
    expect(() => readPort('70000', 3001)).toThrow(
      'PORT must be an integer between 1 and 65535',
    );
  });
});

describe('readProviderConfig', () => {
  it('reads the API key without exposing or modifying it', () => {
    expect(
      readProviderConfig({
        PROVIDER_API_KEY: 'test-key',
        MOCK_SCENARIOS_ENABLED: 'true',
      }),
    ).toEqual({ apiKey: 'test-key', mockScenariosEnabled: true });
  });

  it('fails fast without an API key', () => {
    expect(() => readProviderConfig({})).toThrow(
      'PROVIDER_API_KEY is required',
    );
  });

  it('rejects ambiguous scenario flags', () => {
    expect(() =>
      readProviderConfig({
        PROVIDER_API_KEY: 'test-key',
        MOCK_SCENARIOS_ENABLED: '1',
      }),
    ).toThrow('MOCK_SCENARIOS_ENABLED must be true or false');
  });
});

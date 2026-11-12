import { readPort } from './config.js';

describe('readPort', () => {
  it('uses the fallback when PORT is absent', () => {
    expect(readPort(undefined, 3000)).toBe(3000);
  });

  it('rejects an invalid PORT', () => {
    expect(() => readPort('not-a-port', 3000)).toThrow(
      'PORT must be an integer between 1 and 65535',
    );
  });
});

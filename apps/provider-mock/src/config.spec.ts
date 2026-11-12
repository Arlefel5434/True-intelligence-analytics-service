import { readPort } from './config';

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

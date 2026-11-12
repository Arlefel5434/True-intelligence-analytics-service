import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { jest } from '@jest/globals';
import { ApiErrorFilter } from './error.filter.js';

describe('ApiErrorFilter', () => {
  const invoke = (error: unknown) => {
    const headers = new Map<string, string>();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = {
      getHeader: (key: string) => headers.get(key),
      setHeader: (key: string, value: string) => headers.set(key, value),
      status,
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/api/test' }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    new ApiErrorFilter().catch(error, host);
    return { headers, json, status };
  };

  it('returns validation details with a correlation ID', () => {
    const result = invoke(new BadRequestException(['from is invalid']));
    expect(result.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(result.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: ['from is invalid'],
        correlationId: expect.any(String),
      }),
    );
    expect(result.headers.get('X-Correlation-Id')).toBeTruthy();
  });

  it('does not expose internal errors', () => {
    const result = invoke(new Error('database password leaked'));
    expect(result.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        message: 'Сервис временно недоступен',
      }),
    );
    expect(JSON.stringify(result.json.mock.calls)).not.toContain(
      'password leaked',
    );
  });
});

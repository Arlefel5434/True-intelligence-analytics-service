import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    const raw =
      typeof body === 'object' && body !== null && 'message' in body
        ? body.message
        : typeof body === 'string'
          ? body
          : null;
    const message =
      status >= 500
        ? 'Сервис временно недоступен'
        : Array.isArray(raw)
          ? 'Некорректные данные запроса'
          : typeof raw === 'string'
            ? raw
            : exception instanceof HttpException
              ? exception.message
              : 'Ошибка запроса';
    const correlationId =
      response.getHeader('X-Correlation-Id')?.toString() ?? randomUUID();
    response.setHeader('X-Correlation-Id', correlationId);
    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          event: 'request_failed',
          correlationId,
          method: request.method,
          path: request.path,
          status,
        }),
      );
    } else if (status === 401 || status === 403) {
      this.logger.warn(
        JSON.stringify({
          event: 'access_denied',
          correlationId,
          method: request.method,
          path: request.path,
          status,
        }),
      );
    }
    response.status(status).json({
      code:
        status >= 500
          ? 'INTERNAL_ERROR'
          : status === 400
            ? 'VALIDATION_ERROR'
            : status === 401
              ? 'UNAUTHORIZED'
              : status === 403
                ? 'FORBIDDEN'
                : status === 404
                  ? 'NOT_FOUND'
                  : status === 409
                    ? 'CONFLICT'
                    : 'REQUEST_ERROR',
      message,
      status,
      correlationId,
      ...(Array.isArray(raw) && status === 400
        ? {
            details: raw.filter(
              (item): item is string => typeof item === 'string',
            ),
          }
        : {}),
    });
  }
}

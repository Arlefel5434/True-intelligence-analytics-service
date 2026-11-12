import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function correlationMiddleware(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('X-Correlation-Id', randomUUID());
  next();
}

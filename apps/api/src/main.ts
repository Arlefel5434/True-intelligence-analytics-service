import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { Application } from 'express';
import { AppModule } from './app.module.js';
import { AUTH_CONFIG } from './auth/auth.constants.js';
import type { AuthConfig } from './auth/auth.config.js';
import { readPort } from './config.js';
import { configureSwagger } from './swagger.js';
import { ApiErrorFilter } from './http/error.filter.js';
import { correlationMiddleware } from './http/correlation.middleware.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  configureSwagger(app);
  const authConfig = app.get<AuthConfig>(AUTH_CONFIG);

  app.use(correlationMiddleware);
  app.use(cookieParser());
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: authConfig.appOrigin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Company-Id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  const expressApp = app.getHttpAdapter().getInstance() as Application;
  expressApp.set('trust proxy', 1);
  expressApp.disable('x-powered-by');
  expressApp.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  const port = readPort(process.env.PORT, 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

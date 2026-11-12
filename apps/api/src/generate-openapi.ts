import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { createOpenApiDocument } from './swagger.js';

process.env.DATABASE_URL ??= 'postgresql://build:build@localhost:5432/build';
process.env.PROVIDER_BASE_URL ??= 'http://provider-mock:3001';
process.env.PROVIDER_API_KEY ??= 'openapi-generation-key';
process.env.JWT_ACCESS_SECRET ??= 'openapi_access_secret_at_least_32_chars';
process.env.JWT_REFRESH_SECRET ??= 'openapi_refresh_secret_at_least_32_chars';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_TTL ??= '7d';
process.env.APP_ORIGIN ??= 'http://localhost:8080';
process.env.COOKIE_SECURE ??= 'false';

const app = await NestFactory.create(AppModule, {
  logger: ['error'],
  abortOnError: false,
});
app.setGlobalPrefix('api');
const document = createOpenApiDocument(app);
await writeFile(
  resolve(process.cwd(), '../../packages/api-client/openapi.json'),
  `${JSON.stringify(document, null, 2)}\n`,
  'utf8',
);
await app.close();

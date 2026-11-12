import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('True Intelligence Analytics API')
    .setVersion('1.0')
    .addCookieAuth('tia_access')
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function configureSwagger(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, createOpenApiDocument(app), {
    jsonDocumentUrl: 'api/docs-json',
  });
}

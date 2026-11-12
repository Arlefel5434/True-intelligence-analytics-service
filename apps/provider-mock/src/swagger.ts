import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Mock statistics provider')
    .setDescription('Deterministic external statistics source for TIA')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Key' }, 'api-key')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { readPort } from './config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  const port = readPort(process.env.PORT, 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

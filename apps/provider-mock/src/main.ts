import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readPort } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = readPort(process.env.PORT, 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

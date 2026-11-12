import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readPort } from './config';
import { configureSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  configureSwagger(app);
  const port = readPort(process.env.PORT, 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

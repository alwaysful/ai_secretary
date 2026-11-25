import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 별표 id 목록 등
  app.useBodyParser('json', { limit: '5mb' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  const port = Number(process.env.CERT_PORT ?? 3100);
  // 기본 루프백만 (AURA 백엔드가 호출)
  const host = process.env.CERT_HOST ?? '127.0.0.1';
  await app.listen(port, host);
  new Logger('Bootstrap').log(`AURA 자격증 서비스: http://${host}:${port}`);
}

void bootstrap();

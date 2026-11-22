import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ModelErrorFilter, PrismaErrorFilter } from './common/errors';
import { EnvVars } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 공부 집중 화면 캡처(base64) 수신용
  app.useBodyParser('json', { limit: '5mb' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new PrismaErrorFilter(), new ModelErrorFilter());
  app.enableShutdownHooks();

  const config = app.get(ConfigService<EnvVars, true>);
  const port = config.get('PORT', { infer: true });
  const host = config.get('HOST', { infer: true });
  await app.listen(port, host);
  new Logger('Bootstrap').log(`AURA backend: http://${host}:${port}`);
}

void bootstrap();

import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ModelErrorFilter, PrismaErrorFilter } from './common/errors';
import { EnvVars } from './config/env';
import { BufferedLogger } from './admin/log-buffer';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: new BufferedLogger() });
  // 화면 캡처·OCR 이미지·STT 음성(base64) 수신용
  app.useBodyParser('json', { limit: '40mb' });
  // Android 앱(Capacitor WebView, http://localhost)에서 직접 호출
  app.enableCors({ origin: ['http://localhost', 'https://localhost', 'capacitor://localhost'] });
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

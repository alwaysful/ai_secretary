import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVars } from '../../config/env';
import { BaseModel } from './base-model';
import { OllamaModel } from './ollama.model';

@Module({
  providers: [
    {
      provide: BaseModel,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>) =>
        new OllamaModel({
          baseUrl: config.get('OLLAMA_BASE_URL', { infer: true }),
          model: config.get('OLLAMA_MODEL', { infer: true }),
          keepAlive: config.get('OLLAMA_KEEP_ALIVE', { infer: true }),
          timeoutMs: config.get('MODEL_TIMEOUT_MS', { infer: true }),
        }),
    },
  ],
  exports: [BaseModel],
})
export class ModelsModule {}

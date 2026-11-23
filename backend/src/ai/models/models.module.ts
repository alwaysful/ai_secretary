import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVars } from '../../config/env';
import { AiRouteService } from '../providers/ai-route.service';
import { BaseModel } from './base-model';
import { OllamaModel } from './ollama.model';
import { RoutedModel } from './routed.model';

@Module({
  providers: [
    AiRouteService,
    {
      provide: BaseModel,
      inject: [ConfigService, AiRouteService],
      useFactory: (config: ConfigService<EnvVars, true>, routes: AiRouteService) =>
        new RoutedModel(
          new OllamaModel({
            baseUrl: config.get('OLLAMA_BASE_URL', { infer: true }),
            model: config.get('OLLAMA_MODEL', { infer: true }),
            keepAlive: config.get('OLLAMA_KEEP_ALIVE', { infer: true }),
            timeoutMs: config.get('MODEL_TIMEOUT_MS', { infer: true }),
          }),
          routes,
          config.get('MODEL_TIMEOUT_MS', { infer: true }),
        ),
    },
  ],
  exports: [BaseModel, AiRouteService],
})
export class ModelsModule {}

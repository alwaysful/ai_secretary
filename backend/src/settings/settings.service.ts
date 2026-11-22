import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseModel, ModelError } from '../ai/models/base-model';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface SettingsView {
  model: string;
  systemPrompt: string;
  defaults: { model: string; systemPrompt: string };
}

/** 모델·시스템 프롬프트 설정. DB(AppSettings id=1)에 저장, 없으면 .env 값. */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly log = new Logger(SettingsService.name);
  private prompt: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly model: BaseModel,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const row = await this.prisma.appSettings.findUnique({ where: { id: 1 } });
      this.prompt = row?.systemPrompt ?? null;
      if (row?.model) {
        await this.model.switchTo(row.model).catch((e: Error) => this.log.warn(`saved model unavailable: ${e.message}`));
      }
    } catch (e) {
      this.log.warn(`settings not loaded: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    }
  }

  systemPrompt(): string {
    return this.prompt ?? this.config.get('SYSTEM_PROMPT', { infer: true });
  }

  get(): SettingsView {
    return {
      model: this.model.name,
      systemPrompt: this.systemPrompt(),
      defaults: {
        model: this.config.get('OLLAMA_MODEL', { infer: true }),
        systemPrompt: this.config.get('SYSTEM_PROMPT', { infer: true }),
      },
    };
  }

  models(): Promise<string[]> {
    return this.model.listModels();
  }

  /** systemPrompt: '' 이면 기본값으로 되돌림 */
  async update(input: { model?: string; systemPrompt?: string }): Promise<SettingsView> {
    if (input.model !== undefined) {
      try {
        await this.model.switchTo(input.model);
      } catch (e) {
        if (e instanceof ModelError && e.code === 'NOT_FOUND') {
          throw new NotFoundException({ code: 'MODEL_NOT_FOUND', message: `설치되지 않은 모델: ${input.model}` });
        }
        if (e instanceof ModelError) throw new BadRequestException({ code: 'OLLAMA_DOWN', message: e.message });
        throw e;
      }
    }
    const prompt = input.systemPrompt === undefined ? undefined : input.systemPrompt.trim() || null;
    const data = {
      ...(input.model !== undefined ? { model: this.model.name } : {}),
      ...(prompt !== undefined ? { systemPrompt: prompt } : {}),
    };
    await this.prisma.appSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    if (prompt !== undefined) this.prompt = prompt;
    return this.get();
  }
}

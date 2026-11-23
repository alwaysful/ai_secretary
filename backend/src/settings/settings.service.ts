import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseModel, ModelError } from '../ai/models/base-model';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface Permissions {
  pcControl: boolean;
  screenRead: boolean;
  mic: boolean;
  webcam: boolean;
}

/** faster-whisper 모델 크기 */
export const STT_MODELS = ['tiny', 'base', 'small', 'medium', 'large-v3-turbo', 'large-v3'] as const;

export interface SettingsView {
  model: string;
  systemPrompt: string;
  /** AI PC 조작 허용 */
  pcControl: boolean;
  /** 화면 읽기 허용 */
  screenRead: boolean;
  /** 마이크 허용 */
  mic: boolean;
  /** 웹캠 허용 */
  webcam: boolean;
  /** OCR 비전 모델 */
  ocrModel: string;
  /** STT whisper 모델 */
  sttModel: string;
  defaults: { model: string; systemPrompt: string; ocrModel: string; sttModel: string };
}

/** 모델(채팅·OCR·STT)·시스템 프롬프트·권한 설정. DB(AppSettings id=1)에 저장, 없으면 .env 값. */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly log = new Logger(SettingsService.name);
  private prompt: string | null = null;
  private pc = true;
  private screen = true;
  private micOn = true;
  private cam = true;
  private ocr: string | null = null;
  private stt: string | null = null;
  private readonly listeners: ((p: Permissions) => void)[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly model: BaseModel,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const row = await this.prisma.appSettings.findUnique({ where: { id: 1 } });
      this.prompt = row?.systemPrompt ?? null;
      this.pc = row?.pcControl ?? true;
      this.screen = row?.screenRead ?? true;
      this.micOn = row?.mic ?? true;
      this.cam = row?.webcam ?? true;
      this.ocr = row?.ocrModel ?? null;
      this.stt = row?.sttModel ?? null;
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

  /** PC 조작: 스위치 켜짐 + 화면 읽기 켜짐 둘 다 필요 */
  pcControl(): boolean {
    return this.pc && this.screen;
  }

  screenRead(): boolean {
    return this.screen;
  }

  mic(): boolean {
    return this.micOn;
  }

  webcam(): boolean {
    return this.cam;
  }

  private defaultOcr(): string {
    return (
      this.config.get('OCR_VISION_MODEL', { infer: true }) ||
      this.config.get('PC_VISION_MODEL', { infer: true }) ||
      this.config.get('STUDY_VISION_MODEL', { infer: true })
    );
  }

  private defaultStt(): string {
    return this.config.get('STT_MODEL', { infer: true }) || 'small';
  }

  /** OCR 비전 모델: DB → .env */
  ocrModel(): string {
    return this.ocr || this.defaultOcr();
  }

  /** STT whisper 모델: DB → .env */
  sttModel(): string {
    return this.stt || this.defaultStt();
  }

  onPermissionsChange(cb: (p: Permissions) => void): void {
    this.listeners.push(cb);
  }

  async setPermissions(input: Partial<Permissions>): Promise<SettingsView> {
    const data: Partial<Permissions> = {};
    for (const k of ['pcControl', 'screenRead', 'mic', 'webcam'] as const) {
      if (input[k] !== undefined) data[k] = input[k];
    }
    await this.prisma.appSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    if (data.pcControl !== undefined) this.pc = data.pcControl;
    if (data.screenRead !== undefined) this.screen = data.screenRead;
    if (data.mic !== undefined) this.micOn = data.mic;
    if (data.webcam !== undefined) this.cam = data.webcam;
    const now = { pcControl: this.pc, screenRead: this.screen, mic: this.micOn, webcam: this.cam };
    for (const cb of this.listeners) cb(now);
    return this.get();
  }

  get(): SettingsView {
    return {
      model: this.model.name,
      systemPrompt: this.systemPrompt(),
      pcControl: this.pc,
      screenRead: this.screen,
      mic: this.micOn,
      webcam: this.cam,
      ocrModel: this.ocrModel(),
      sttModel: this.sttModel(),
      defaults: {
        model: this.config.get('OLLAMA_MODEL', { infer: true }),
        systemPrompt: this.config.get('SYSTEM_PROMPT', { infer: true }),
        ocrModel: this.defaultOcr(),
        sttModel: this.defaultStt(),
      },
    };
  }

  models(): Promise<string[]> {
    return this.model.listModels();
  }

  /** 이미지 입력 가능한 모델만 (Ollama /api/show capabilities). 확인 실패한 모델은 포함 */
  async visionModels(): Promise<string[]> {
    const all = await this.listOrThrow();
    const base = this.config.get('OLLAMA_BASE_URL', { infer: true }).replace(/\/+$/, '');
    const checks = await Promise.all(
      all.map(async (name) => {
        try {
          const res = await fetch(`${base}/api/show`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: name }),
            signal: AbortSignal.timeout(5_000),
          });
          if (!res.ok) return true;
          const body = (await res.json()) as { capabilities?: string[] };
          return !body.capabilities || body.capabilities.includes('vision');
        } catch {
          return true;
        }
      }),
    );
    return all.filter((_, i) => checks[i]);
  }

  private async listOrThrow(): Promise<string[]> {
    try {
      return await this.model.listModels();
    } catch (e) {
      if (e instanceof ModelError) throw new BadRequestException({ code: 'OLLAMA_DOWN', message: e.message });
      throw e;
    }
  }

  /** systemPrompt: '' 이면 기본값으로 되돌림 */
  async update(input: { model?: string; systemPrompt?: string; ocrModel?: string; sttModel?: string }): Promise<SettingsView> {
    const ocr = input.ocrModel === undefined ? undefined : input.ocrModel.trim() || null;
    const stt = input.sttModel === undefined ? undefined : input.sttModel.trim() || null;
    if (stt && !(STT_MODELS as readonly string[]).includes(stt)) {
      throw new BadRequestException({ code: 'BAD_STT_MODEL', message: `지원 안 하는 STT 모델: ${stt}` });
    }
    if (ocr) {
      const installed = await this.listOrThrow();
      if (!installed.some((n) => n === ocr || n === `${ocr}:latest`)) {
        throw new NotFoundException({ code: 'MODEL_NOT_FOUND', message: `설치되지 않은 모델: ${ocr}` });
      }
    }
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
      ...(ocr !== undefined ? { ocrModel: ocr } : {}),
      ...(stt !== undefined ? { sttModel: stt } : {}),
    };
    await this.prisma.appSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    if (prompt !== undefined) this.prompt = prompt;
    if (ocr !== undefined) this.ocr = ocr;
    if (stt !== undefined) this.stt = stt;
    return this.get();
  }
}

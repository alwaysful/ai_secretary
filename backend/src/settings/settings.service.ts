import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseModel, ModelError } from '../ai/models/base-model';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AiRouteService, KeyInfo, Route, Source } from '../ai/providers/ai-route.service';
import {
  AiFeature,
  API_PROVIDERS,
  apiListModels,
  ApiProvider,
  CATALOG,
  PROVIDER_LABEL,
  supports,
} from '../ai/providers/api-providers';

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
  /** 기능별 로컬/API 선택 */
  routes: Record<AiFeature, Route>;
  /** API 키 등록 여부 (마스킹만) */
  apiKeys: Record<ApiProvider, KeyInfo>;
  /** 공급자 목록. features: 지원 기능 */
  providers: { id: ApiProvider; label: string; features: AiFeature[] }[];
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
    private readonly routes: AiRouteService,
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
      model: this.model.localName,
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
      routes: this.routes.allRoutes(),
      apiKeys: this.routes.keyInfo(),
      providers: API_PROVIDERS.map((id) => ({
        id,
        label: PROVIDER_LABEL[id],
        features: (['chat', 'ocr', 'stt'] as AiFeature[]).filter((f) => supports(id, f)),
      })),
    };
  }

  /** API 경로 정보 (로컬이면 null) */
  aiApi(f: AiFeature) {
    return this.routes.api(f);
  }

  /** 기능별 로컬/API 선택. api면 공급자 필수, 모델 비우면 공급자 기본 모델 */
  async setRoute(feature: AiFeature, source: Source, provider?: ApiProvider, model?: string): Promise<SettingsView> {
    if (source === 'api') {
      if (!provider) throw new BadRequestException({ code: 'NO_PROVIDER', message: 'API 공급자를 고르세요' });
      if (!supports(provider, feature)) {
        throw new BadRequestException({ code: 'UNSUPPORTED', message: `${PROVIDER_LABEL[provider]}는 이 기능 미지원` });
      }
      const m = model?.trim() || CATALOG[provider][feature][0];
      await this.routes.setRoute(feature, { source, provider, model: m });
    } else {
      const prev = this.routes.route(feature);
      await this.routes.setRoute(feature, { ...prev, source: 'local' });
    }
    return this.get();
  }

  /** 공급자 모델 목록. 키 있으면 실시간 조회, 실패·없으면 기본 목록 */
  async apiModels(provider: ApiProvider, feature: AiFeature): Promise<{ models: string[]; live: boolean; error?: string }> {
    const base = CATALOG[provider][feature];
    const key = this.routes.key(provider);
    if (!key || !supports(provider, feature)) return { models: base, live: false };
    try {
      const live = await apiListModels(provider, key, feature, { timeoutMs: 15_000 });
      // 추천(기본 목록) 먼저, 나머지 뒤
      const rec = base.filter((m) => live.includes(m));
      return { models: [...rec, ...live.filter((m) => !rec.includes(m))], live: true };
    } catch (e) {
      return { models: base, live: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** 키 연결 테스트. key 없으면 저장된 키로 */
  async testKey(provider: ApiProvider, key?: string): Promise<{ ok: boolean; message: string; count?: number }> {
    const k = key?.trim() || this.routes.key(provider);
    if (!k) return { ok: false, message: '키 없음' };
    try {
      const list = await apiListModels(provider, k, 'chat', { timeoutMs: 15_000 });
      return { ok: true, message: `연결 성공. 모델 ${list.length}개`, count: list.length };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  async setKey(provider: ApiProvider, key: string): Promise<SettingsView> {
    if (!key.trim()) throw new BadRequestException({ code: 'NO_KEY', message: '키를 입력하세요' });
    await this.routes.setKey(provider, key);
    return this.get();
  }

  async deleteKey(provider: ApiProvider): Promise<SettingsView> {
    await this.routes.deleteKey(provider);
    return this.get();
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
      ...(input.model !== undefined ? { model: this.model.localName } : {}),
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

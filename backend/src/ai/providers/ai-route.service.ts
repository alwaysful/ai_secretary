import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decrypt, encrypt } from '../../common/crypto';
import { EnvVars } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AiFeature, API_PROVIDERS, ApiProvider, CATALOG, isProvider, maskKey, supports } from './api-providers';

export type Source = 'local' | 'api';

export interface Route {
  source: Source;
  provider: ApiProvider | null;
  model: string | null;
}

export interface KeyInfo {
  set: boolean;
  hint: string | null;
}

const FEATURES: AiFeature[] = ['chat', 'ocr', 'stt'];
const COLS = {
  chat: ['chatSource', 'chatProvider', 'chatApiModel'],
  ocr: ['ocrSource', 'ocrProvider', 'ocrApiModel'],
  stt: ['sttSource', 'sttProvider', 'sttApiModel'],
} as const;

/** 기능(채팅·OCR·STT)별 로컬/API 선택 + 암호화된 API 키 보관 */
@Injectable()
export class AiRouteService implements OnModuleInit {
  private readonly log = new Logger(AiRouteService.name);
  private readonly routes: Record<AiFeature, Route> = {
    chat: { source: 'local', provider: null, model: null },
    ocr: { source: 'local', provider: null, model: null },
    stt: { source: 'local', provider: null, model: null },
  };
  private readonly keys = new Map<ApiProvider, { plain: string; hint: string }>();
  private secretHex: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const row = (await this.prisma.appSettings.findUnique({ where: { id: 1 } })) as Record<string, unknown> | null;
      for (const f of FEATURES) {
        const [s, p, m] = COLS[f];
        const provider = isProvider(row?.[p]) ? (row?.[p] as ApiProvider) : null;
        const source: Source = row?.[s] === 'api' && provider && supports(provider, f) ? 'api' : 'local';
        this.routes[f] = { source, provider, model: (row?.[m] as string | null) ?? null };
      }
      for (const k of await this.prisma.apiKey.findMany()) {
        if (!isProvider(k.provider)) continue;
        try {
          this.keys.set(k.provider, { plain: decrypt(k.cipher, this.secret()), hint: k.hint });
        } catch {
          this.log.warn(`${k.provider} API 키 복호화 실패 (암호화 키 바뀜?). 설정에서 다시 입력 필요`);
        }
      }
    } catch (e) {
      this.log.warn(`AI 경로 설정 로드 실패: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    }
  }

  /** TOKEN_ENC_KEY 있으면 사용, 없으면 backend/.aura-secret 자동 생성 */
  private secret(): string {
    if (this.secretHex) return this.secretHex;
    const env = this.config.get('TOKEN_ENC_KEY', { infer: true });
    if (env) return (this.secretHex = env);
    const file = resolve(process.cwd(), '.aura-secret');
    if (existsSync(file)) {
      const hex = readFileSync(file, 'utf8').trim();
      if (/^[0-9a-fA-F]{64}$/.test(hex)) return (this.secretHex = hex);
    }
    const hex = randomBytes(32).toString('hex');
    writeFileSync(file, hex, { mode: 0o600 });
    return (this.secretHex = hex);
  }

  route(f: AiFeature): Route {
    return { ...this.routes[f] };
  }

  allRoutes(): Record<AiFeature, Route> {
    return { chat: this.route('chat'), ocr: this.route('ocr'), stt: this.route('stt') };
  }

  /** API 경로면 provider·model·key. 키 없으면 null 대신 key '' */
  api(f: AiFeature): { provider: ApiProvider; model: string; key: string } | null {
    const r = this.routes[f];
    if (r.source !== 'api' || !r.provider) return null;
    return { provider: r.provider, model: r.model || CATALOG[r.provider][f][0], key: this.keys.get(r.provider)?.plain ?? '' };
  }

  key(p: ApiProvider): string | null {
    return this.keys.get(p)?.plain ?? null;
  }

  keyInfo(): Record<ApiProvider, KeyInfo> {
    const out = {} as Record<ApiProvider, KeyInfo>;
    for (const p of API_PROVIDERS) {
      const k = this.keys.get(p);
      out[p] = { set: !!k, hint: k?.hint ?? null };
    }
    return out;
  }

  async setRoute(f: AiFeature, r: Route): Promise<void> {
    const [s, p, m] = COLS[f];
    const data = { [s]: r.source, [p]: r.provider, [m]: r.model };
    await this.prisma.appSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    this.routes[f] = { ...r };
  }

  async setKey(p: ApiProvider, key: string): Promise<void> {
    const plain = key.trim();
    const hint = maskKey(plain);
    const cipher = encrypt(plain, this.secret());
    await this.prisma.apiKey.upsert({ where: { provider: p }, create: { provider: p, cipher, hint }, update: { cipher, hint } });
    this.keys.set(p, { plain, hint });
  }

  async deleteKey(p: ApiProvider): Promise<void> {
    await this.prisma.apiKey.deleteMany({ where: { provider: p } });
    this.keys.delete(p);
  }
}

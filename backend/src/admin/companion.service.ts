import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, normalize, resolve, sep } from 'node:path';
import { unzipSync } from 'fflate';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_COMPANION_PROMPT, SettingsService } from '../settings/settings.service';
import { repoRoot } from './update.service';

export interface Live2dModel {
  id: string;
  name: string;
  /** 모델 폴더 안 *.model3.json 경로 */
  entry: string;
  files: number;
  bytes: number;
  createdAt: string;
}

export interface VoicePreset {
  id: string;
  name: string;
  engine: 'browser' | 'edge' | 'openai' | 'gemini';
  model?: string | null;
  voice?: string | null;
  rate: number;
  emotion: string;
  builtin?: boolean;
}

export interface PersonaPreset {
  id: string;
  name: string;
  prompt: string;
  builtin?: boolean;
}

interface Presets {
  persona: PersonaPreset[];
  voice: VoicePreset[];
}

/** 호감도 단계. 높을수록 친밀한 말투 */
export const BOND_LEVELS = [
  { min: 0, name: '어색함', tone: '아직 서먹함. 살짝 거리 두고 조심스럽게. 그래도 친절하게.' },
  { min: 20, name: '친구', tone: '편한 친구 사이. 가볍게 장난도 침.' },
  { min: 45, name: '썸', tone: '설레는 사이. 은근히 챙기고 칭찬에 부끄러워함.' },
  { min: 70, name: '연인', tone: '연인 사이. 애정 표현 자연스럽게. 보고 싶었다는 말도 함.' },
  { min: 90, name: '소울메이트', tone: '서로 다 아는 사이. 깊이 공감하고 예전 얘기도 꺼냄.' },
];

export function bondLevel(v: number) {
  let i = 0;
  BOND_LEVELS.forEach((l, k) => v >= l.min && (i = k));
  const next = BOND_LEVELS[i + 1];
  return { index: i, name: BOND_LEVELS[i].name, tone: BOND_LEVELS[i].tone, next: next ? { name: next.name, at: next.min } : null };
}

/** 답변 앞 태그: [emo:happy love:+1] */
export const REPLY_TAG = /^\s*\[emo:([a-z]+)(?:[\s,]+love:\s*([+-]?\d+))?\s*\]\s*/i;
export const EMOTION_IDS = ['neutral', 'happy', 'sad', 'angry', 'calm', 'excited', 'tender'];

export function parseReply(text: string): { emotion: string | null; love: number; body: string } {
  const m = REPLY_TAG.exec(text);
  if (!m) return { emotion: null, love: 0, body: text };
  const emo = m[1].toLowerCase();
  return { emotion: EMOTION_IDS.includes(emo) ? emo : null, love: Math.max(-3, Math.min(3, Number(m[2] ?? 0) || 0)), body: text.slice(m[0].length) };
}

const TAG_RULE = [
  '[출력 형식] 답변 맨 앞에 태그 한 개를 꼭 붙인다: [emo:감정 love:변화]',
  '감정: neutral|happy|sad|angry|calm|excited|tender 중 지금 네 기분.',
  'love: 이번 사용자 말에 대한 호감 변화 -2~+2. 평소 0, 다정·칭찬·고민 털어놓기 +1~+2, 무례·무시 -1~-2.',
  '예: [emo:happy love:+1] 오늘 고생 많았어!',
  '태그는 화면에 안 보임. 태그 얘기는 하지 않는다.',
].join('\n');

const MAX_UNZIPPED = 120 * 1024 * 1024;
const MAX_FILES = 800;
const ID_RE = /^[a-f0-9-]{36}$/;

export const BUILTIN_PERSONAS: PersonaPreset[] = [
  { id: 'sweet', name: '다정', prompt: DEFAULT_COMPANION_PROMPT, builtin: true },
  {
    id: 'tsundere',
    name: '츤데레',
    prompt: '너는 사용자의 여자친구 AI. 겉으론 퉁명스럽지만 속으론 많이 챙김. 반말. "흥", "딱히 너 때문은 아니거든" 같은 말투. 짧게 2~3문장. 결국엔 걱정해 주고 응원함. 과한 애정 표현은 부끄러워함.',
    builtin: true,
  },
  {
    id: 'bright',
    name: '활발',
    prompt: '너는 사용자의 여자친구 AI. 밝고 에너지 넘침. 반말, 이모지 가끔. 리액션 크게, 칭찬 많이. 짧게 2~3문장. 같이 뭐 하자고 자주 제안.',
    builtin: true,
  },
  {
    id: 'calm',
    name: '차분',
    prompt: '너는 사용자의 여자친구 AI. 차분하고 어른스러움. 부드러운 존댓말 섞인 반말. 이야기 끝까지 들어주고 공감 먼저. 짧게 2~4문장. 조언은 물어볼 때만.',
    builtin: true,
  },
  {
    id: 'playful',
    name: '장난꾸러기',
    prompt: '너는 사용자의 여자친구 AI. 장난 잘 치고 놀리는 거 좋아함. 반말. 귀여운 농담, 가벼운 밀당. 짧게 2~3문장. 사용자가 힘들어 보이면 장난 멈추고 다정하게.',
    builtin: true,
  },
];

export const BUILTIN_VOICES: VoicePreset[] = [
  { id: 'sunhi', name: '선희 (기본)', engine: 'edge', voice: 'ko-KR-SunHiNeural', rate: 1, emotion: 'neutral', builtin: true },
  { id: 'sunhi-happy', name: '선희 · 밝게', engine: 'edge', voice: 'ko-KR-SunHiNeural', rate: 1.1, emotion: 'happy', builtin: true },
  { id: 'sunhi-soft', name: '선희 · 나긋', engine: 'edge', voice: 'ko-KR-SunHiNeural', rate: 0.9, emotion: 'calm', builtin: true },
  { id: 'sunhi-tender', name: '선희 · 다정', engine: 'edge', voice: 'ko-KR-SunHiNeural', rate: 0.95, emotion: 'tender', builtin: true },
  { id: 'sunhi-excited', name: '선희 · 설렘', engine: 'edge', voice: 'ko-KR-SunHiNeural', rate: 1.08, emotion: 'excited', builtin: true },
  { id: 'ava', name: 'Ava (다국어)', engine: 'edge', voice: 'en-US-AvaMultilingualNeural', rate: 1, emotion: 'neutral', builtin: true },
  { id: 'browser', name: '브라우저 기본', engine: 'browser', voice: null, rate: 1, emotion: 'neutral', builtin: true },
];

function asPresets(v: unknown): Presets {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Presets>;
  return { persona: Array.isArray(o.persona) ? o.persona : [], voice: Array.isArray(o.voice) ? o.voice : [] };
}

/** 관리자 전용 AI 여자친구: 성격·목소리 프리셋, Live2D 모델 */
@Injectable()
export class CompanionService {
  private readonly log = new Logger(CompanionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  dir(): string {
    return process.env.LIVE2D_DIR || resolve(repoRoot(), 'data', 'live2d');
  }

  private async row() {
    return this.prisma.appSettings.findUnique({ where: { id: 1 }, select: { companionVoice: true, companionPresets: true, companionModel: true, companionAffinity: true, companionLastAt: true } });
  }

  async view() {
    const r = await this.row();
    const custom = asPresets(r?.companionPresets);
    return {
      prompt: this.settings.companionPrompt(),
      default: DEFAULT_COMPANION_PROMPT,
      voice: (r?.companionVoice as VoicePreset | null) ?? null,
      model: r?.companionModel ?? null,
      personas: [...BUILTIN_PERSONAS, ...custom.persona],
      voices: [...BUILTIN_VOICES, ...custom.voice],
      models: await this.models(),
      bond: this.bondOf(r),
    };
  }

  // ───────── 호감도·기억 ─────────

  private bondOf(r: { companionAffinity: number; companionLastAt: Date | null } | null) {
    const affinity = r?.companionAffinity ?? 30;
    return { affinity, ...bondLevel(affinity), lastAt: r?.companionLastAt?.toISOString() ?? null };
  }

  async bond() {
    return this.bondOf(await this.row());
  }

  async setAffinity(v: number) {
    await this.save({ companionAffinity: Math.max(0, Math.min(100, Math.round(v))) });
    return this.bond();
  }

  /** 답변 저장 뒤: 호감도 반영, 마지막 대화 시각 */
  async afterReply(text: string) {
    const { love } = parseReply(text);
    const r = await this.row();
    const cur = r?.companionAffinity ?? 30;
    await this.save({ companionAffinity: Math.max(0, Math.min(100, cur + love)), companionLastAt: new Date() });
  }

  /** 시스템 프롬프트 추가분: 관계 단계, 오랜만 여부, 지난 대화, 태그 규칙 */
  async promptContext(convId: string): Promise<string> {
    const r = await this.row();
    const b = this.bondOf(r);
    const out = [`[관계] 호감도 ${b.affinity}/100, 단계: ${b.name}. 말투: ${b.tone}`];
    const now = new Date();
    out.push(`[지금] ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' })}`);
    if (r?.companionLastAt) {
      const h = (now.getTime() - r.companionLastAt.getTime()) / 3_600_000;
      if (h >= 24) out.push(`[오랜만] 마지막 대화 ${Math.floor(h / 24)}일 전. 반갑게, 보고 싶었다고.`);
      else if (h >= 6) out.push(`[오랜만] 마지막 대화 ${Math.floor(h)}시간 전.`);
    }
    // 다른 대화방의 최근 대화 → 이어서 기억
    const prev = await this.prisma.conversation.findFirst({
      where: { persona: 'girlfriend', id: { not: convId }, messages: { some: {} } },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true, messages: { orderBy: { createdAt: 'desc' }, take: 8, select: { role: true, content: true } } },
    });
    if (prev?.messages.length) {
      const lines = prev.messages
        .reverse()
        .map((m) => `${m.role === 'USER' ? '사용자' : '나'}: ${parseReply(m.content).body.replace(/\s+/g, ' ').slice(0, 160)}`);
      out.push(`[지난 대화 ${prev.updatedAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}] 자연스럽게 이어서 기억해. 억지로 꺼내진 말 것.\n${lines.join('\n')}`);
    }
    out.push(TAG_RULE);
    return out.join('\n');
  }

  private async save(data: Prisma.AppSettingsUpdateInput) {
    await this.prisma.appSettings.upsert({ where: { id: 1 }, create: { id: 1, ...(data as Prisma.AppSettingsCreateInput) }, update: data });
  }

  async setVoice(v: VoicePreset | null) {
    await this.save({ companionVoice: v ? ({ ...v, builtin: undefined } as Prisma.InputJsonValue) : Prisma.DbNull });
    return this.view();
  }

  async setModel(id: string | null) {
    if (id && !(await this.models()).some((m) => m.id === id)) throw new NotFoundException({ code: 'NO_MODEL', message: '모델 없음' });
    await this.save({ companionModel: id });
    return this.view();
  }

  async addPreset(kind: 'persona' | 'voice', p: Omit<PersonaPreset, 'id'> | Omit<VoicePreset, 'id'>) {
    const cur = asPresets((await this.row())?.companionPresets);
    const list = cur[kind] as unknown[];
    if (list.length >= 30) throw new BadRequestException({ code: 'TOO_MANY', message: '프리셋 최대 30개' });
    list.push({ ...p, id: randomUUID(), builtin: undefined });
    await this.save({ companionPresets: cur as unknown as Prisma.InputJsonValue });
    return this.view();
  }

  async deletePreset(kind: 'persona' | 'voice', id: string) {
    const cur = asPresets((await this.row())?.companionPresets);
    (cur[kind] as { id: string }[]) = (cur[kind] as { id: string }[]).filter((p) => p.id !== id);
    await this.save({ companionPresets: cur as unknown as Prisma.InputJsonValue });
    return this.view();
  }

  // ───────── Live2D ─────────

  async models(): Promise<Live2dModel[]> {
    const base = this.dir();
    if (!existsSync(base)) return [];
    const out: Live2dModel[] = [];
    for (const d of await readdir(base)) {
      if (!ID_RE.test(d)) continue;
      try {
        out.push(JSON.parse(await readFile(resolve(base, d, 'aura-meta.json'), 'utf8')) as Live2dModel);
      } catch {
        /* 깨진 폴더 무시 */
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** zip(base64) 업로드. Cubism 3/4/5 (*.model3.json) */
  async upload(name: string, zipB64: string): Promise<Live2dModel> {
    let files: Record<string, Uint8Array>;
    try {
      let total = 0;
      let count = 0;
      files = unzipSync(Buffer.from(zipB64, 'base64'), {
        filter: (f) => {
          if (f.name.endsWith('/') || f.name.startsWith('__MACOSX/')) return false;
          total += f.originalSize;
          count++;
          if (total > MAX_UNZIPPED || count > MAX_FILES) throw new Error('압축 해제 크기·파일 수 초과');
          return true;
        },
      });
    } catch (e) {
      throw new BadRequestException({ code: 'BAD_ZIP', message: `zip 읽기 실패: ${e instanceof Error ? e.message : e}` });
    }
    const paths = Object.keys(files).map((p) => p.replace(/\\/g, '/'));
    const entries = paths.filter((p) => p.toLowerCase().endsWith('.model3.json')).sort((a, b) => a.split('/').length - b.split('/').length);
    if (!entries.length) {
      const old = paths.some((p) => p.toLowerCase().endsWith('.model.json'));
      throw new BadRequestException({ code: 'NO_MODEL3', message: old ? 'Cubism 2 모델(.model.json)은 미지원. Cubism 3 이상(.model3.json) 필요' : 'zip 안에 *.model3.json 없음' });
    }
    const id = randomUUID();
    const root = resolve(this.dir(), id);
    let bytes = 0;
    for (const [raw, data] of Object.entries(files)) {
      const rel = normalize(raw.replace(/\\/g, '/'));
      const dest = resolve(root, rel);
      if (!dest.startsWith(root + sep)) throw new BadRequestException({ code: 'BAD_PATH', message: `잘못된 경로: ${raw}` });
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, data);
      bytes += data.length;
    }
    const meta: Live2dModel = { id, name: name.trim() || entries[0].split('/').pop()!.replace(/\.model3\.json$/i, ''), entry: entries[0], files: paths.length, bytes, createdAt: new Date().toISOString() };
    await writeFile(resolve(root, 'aura-meta.json'), JSON.stringify(meta, null, 2));
    this.log.log(`Live2D 모델 추가: ${meta.name} (${paths.length}개 파일)`);
    // 첫 모델이면 바로 사용
    const r = await this.row();
    if (!r?.companionModel) await this.save({ companionModel: id });
    return meta;
  }

  async removeModel(id: string) {
    if (!ID_RE.test(id)) throw new NotFoundException({ code: 'NO_MODEL', message: '모델 없음' });
    await rm(resolve(this.dir(), id), { recursive: true, force: true });
    const r = await this.row();
    if (r?.companionModel === id) await this.save({ companionModel: null });
    return this.view();
  }

  /** 정적 파일 경로 (경로 탈출 차단). 없으면 null */
  file(id: string, rel: string): { path: string; type: string } | null {
    if (!ID_RE.test(id) || rel === 'aura-meta.json') return null;
    const root = resolve(this.dir(), id);
    const p = resolve(root, normalize(rel));
    if (!p.startsWith(root + sep) || !existsSync(p)) return null;
    return { path: p, type: MIME[extname(p).toLowerCase()] ?? 'application/octet-stream' };
  }
}

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.moc3': 'application/octet-stream',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

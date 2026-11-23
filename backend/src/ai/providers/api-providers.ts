import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage, ModelError } from '../models/base-model';

export const API_PROVIDERS = ['gemini', 'anthropic', 'openai'] as const;
export type ApiProvider = (typeof API_PROVIDERS)[number];
export type AiFeature = 'chat' | 'ocr' | 'stt';

export const PROVIDER_LABEL: Record<ApiProvider, string> = {
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI',
};

/** 기본 목록(키 없을 때·실시간 조회 실패 시). 첫 항목이 기본값. Anthropic은 STT 없음 */
export const CATALOG: Record<ApiProvider, Record<AiFeature, string[]>> = {
  gemini: {
    chat: ['gemini-3.8-flash', 'gemini-4-argon', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
    ocr: ['gemini-3.8-flash', 'gemini-4-argon', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
    stt: ['gemini-3.5-transcribe', 'gemini-3.8-flash', 'gemini-3.6-flash'],
  },
  anthropic: {
    chat: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'],
    ocr: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'],
    stt: [],
  },
  openai: {
    chat: ['gpt-6.1-terra', 'gpt-6.2-sol', 'gpt-6.2-astra', 'gpt-6-luna'],
    ocr: ['gpt-6.1-terra', 'gpt-6.2-sol', 'gpt-6.2-astra', 'gpt-6-luna'],
    stt: ['gpt-transcribe', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'],
  },
};

export function supports(provider: ApiProvider, feature: AiFeature): boolean {
  return CATALOG[provider][feature].length > 0;
}

export function isProvider(v: unknown): v is ApiProvider {
  return typeof v === 'string' && (API_PROVIDERS as readonly string[]).includes(v);
}

export interface CallOpts {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs: number;
  /** 사용량 기록용 기능 구분 */
  feature?: AiFeature;
}

/** API 호출 1회 토큰 사용량 */
export interface UsageRecord {
  provider: ApiProvider;
  model: string;
  feature: AiFeature;
  inputTokens: number;
  outputTokens: number;
  audioSec?: number;
}

let usageSink: ((u: UsageRecord) => void) | null = null;

/** 사용량 수신자 등록 (UsageService) */
export function onApiUsage(fn: ((u: UsageRecord) => void) | null): void {
  usageSink = fn;
}

function report(p: ApiProvider, model: string, o: CallOpts, input: number | undefined, output: number | undefined, audioSec?: number): void {
  if (!usageSink) return;
  const u: UsageRecord = { provider: p, model, feature: o.feature ?? 'chat', inputTokens: Math.max(0, input ?? 0), outputTokens: Math.max(0, output ?? 0), audioSec };
  if (!u.inputTokens && !u.outputTokens && !audioSec) return;
  try {
    usageSink(u);
  } catch {
    /* 기록 실패는 무시 */
  }
}

type ClaudeUsage = { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };
function reportClaude(model: string, o: CallOpts, u: ClaudeUsage | undefined): void {
  if (!u) return;
  report('anthropic', model, o, (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), u.output_tokens ?? 0);
}

type OaUsage = { input_tokens?: number; output_tokens?: number };
function reportOpenai(model: string, o: CallOpts, raw: unknown): void {
  const u = (raw as { usage?: OaUsage })?.usage;
  if (u) report('openai', model, o, u.input_tokens, u.output_tokens);
}

type GeminiUsage = { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
function reportGemini(model: string, o: CallOpts, u: GeminiUsage | undefined): void {
  if (u) report('gemini', model, o, u.promptTokenCount, (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0));
}

const geminiUsage = (raw: unknown) => (raw as { usageMetadata?: GeminiUsage })?.usageMetadata;

const OPENAI = 'https://api.openai.com/v1';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

/** base64 앞부분으로 이미지 타입 추정 */
export function imageMime(b64: string): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('R0lG')) return 'image/gif';
  if (b64.startsWith('UklG')) return 'image/webp';
  return 'image/png';
}

function splitSystem(messages: ChatMessage[]): { system: string; rest: ChatMessage[] } {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');
  // 첫 메시지는 user여야 하는 공급자 대비
  while (rest.length && rest[0].role !== 'user') rest.shift();
  return { system, rest };
}

function signalOf(o: CallOpts): AbortSignal {
  const t = AbortSignal.timeout(o.timeoutMs);
  return o.signal ? AbortSignal.any([o.signal, t]) : t;
}

function toErr(provider: ApiProvider, e: unknown, signal?: AbortSignal): ModelError {
  if (e instanceof ModelError) return e;
  if (signal?.aborted) return new ModelError('ABORTED', 'request aborted', e);
  if (e instanceof Anthropic.APIError) return statusErr(provider, e.status ?? 0, e.message);
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
    return new ModelError('TIMEOUT', `${PROVIDER_LABEL[provider]} 응답 시간 초과`, e);
  }
  return new ModelError('UNAVAILABLE', `${PROVIDER_LABEL[provider]} 연결 실패: ${(e as Error)?.message ?? e}`, e);
}

function statusErr(provider: ApiProvider, status: number, text: string): ModelError {
  const label = PROVIDER_LABEL[provider];
  const body = text.replace(/\s+/g, ' ').slice(0, 300);
  if (status === 401 || status === 403) return new ModelError('UNAVAILABLE', `${label} API 키 오류 (${status}): ${body}`);
  if (status === 404) return new ModelError('NOT_FOUND', `${label} 모델 없음 (404): ${body}`);
  if (status === 429) return new ModelError('UNAVAILABLE', `${label} 사용량 한도 초과 (429): ${body}`);
  return new ModelError('BAD_RESPONSE', `${label} ${status}: ${body}`);
}

async function http(provider: ApiProvider, url: string, init: RequestInit, o: CallOpts): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: signalOf(o) });
  } catch (e) {
    throw toErr(provider, e, o.signal);
  }
  if (!res.ok) throw statusErr(provider, res.status, await res.text().catch(() => ''));
  return res;
}

/** SSE data: 줄 파싱 */
async function* sse(provider: ApiProvider, res: Response, signal?: AbortSignal): AsyncGenerator<unknown> {
  if (!res.body) throw new ModelError('BAD_RESPONSE', 'empty response body');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      let chunk: Awaited<ReturnType<typeof reader.read>>;
      try {
        chunk = await reader.read();
      } catch (e) {
        throw toErr(provider, e, signal);
      }
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          yield JSON.parse(data);
        } catch {
          /* 무시 */
        }
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

// ───────── Anthropic (공식 SDK) ─────────

function claude(key: string, o: CallOpts): Anthropic {
  return new Anthropic({ apiKey: key, timeout: o.timeoutMs, maxRetries: 1 });
}

/** 5세대 이상만 effort 지원. 채팅은 빠르게 low */
function claudeExtras(model: string): Record<string, unknown> {
  return /^claude-(opus|sonnet|haiku|fable|mythos)-5/.test(model) ? { output_config: { effort: 'low' } } : {};
}

function claudeMessages(rest: ChatMessage[]): Anthropic.MessageParam[] {
  return rest.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
}

function claudeText(msg: Anthropic.Message): string {
  if (msg.stop_reason === 'refusal') throw new ModelError('BAD_RESPONSE', 'Claude가 요청을 거절함');
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

// ───────── OpenAI (Responses API) ─────────

type OaContent = { type: 'input_text'; text: string } | { type: 'input_image'; image_url: string };

function openaiBody(model: string, system: string, input: unknown[], o: CallOpts, stream: boolean) {
  return {
    model,
    ...(system ? { instructions: system } : {}),
    input,
    ...(o.maxTokens ? { max_output_tokens: o.maxTokens } : {}),
    stream,
    store: false,
  };
}

function openaiText(raw: unknown): string {
  const data = raw as { output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  return (data.output ?? [])
    .filter((it) => it.type === 'message')
    .flatMap((it) => it.content ?? [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text ?? '')
    .join('');
}

function openaiHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// ───────── Gemini (REST) ─────────

type GeminiPart = { text?: string; thought?: boolean; inline_data?: { mime_type: string; data: string } };

function geminiBody(system: string, contents: unknown[], o: CallOpts) {
  const generationConfig: Record<string, number> = {};
  if (o.maxTokens) generationConfig.maxOutputTokens = o.maxTokens;
  if (o.temperature !== undefined) generationConfig.temperature = o.temperature;
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig,
  };
}

function geminiText(raw: unknown): string {
  const data = raw as { candidates?: { content?: { parts?: GeminiPart[] } }[]; promptFeedback?: { blockReason?: string } };
  if (data.promptFeedback?.blockReason) throw new ModelError('BAD_RESPONSE', `Gemini 차단: ${data.promptFeedback.blockReason}`);
  return (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join('');
}

function geminiHeaders(key: string): Record<string, string> {
  return { 'x-goog-api-key': key, 'Content-Type': 'application/json' };
}

function geminiContents(rest: ChatMessage[]) {
  return rest.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
}

const modelPath = (model: string) => `${GEMINI}/models/${encodeURIComponent(model.replace(/^models\//, ''))}`;

// ───────── 공개 함수 ─────────

export async function apiGenerate(p: ApiProvider, key: string, model: string, messages: ChatMessage[], o: CallOpts): Promise<string> {
  const { system, rest } = splitSystem(messages);
  if (p === 'anthropic') {
    try {
      const msg = await claude(key, o).messages.create(
        {
          model,
          max_tokens: o.maxTokens ?? 16000,
          ...(system ? { system } : {}),
          messages: claudeMessages(rest),
          ...claudeExtras(model),
        } as Anthropic.MessageCreateParamsNonStreaming,
        { signal: o.signal },
      );
      reportClaude(model, o, msg.usage);
      return claudeText(msg);
    } catch (e) {
      throw toErr(p, e, o.signal);
    }
  }
  if (p === 'openai') {
    const input = rest.map((m) => ({ role: m.role, content: m.content }));
    const res = await http(p, `${OPENAI}/responses`, { method: 'POST', headers: openaiHeaders(key), body: JSON.stringify(openaiBody(model, system, input, o, false)) }, o);
    const raw = await res.json();
    reportOpenai(model, o, raw);
    return openaiText(raw);
  }
  const res = await http(p, `${modelPath(model)}:generateContent`, { method: 'POST', headers: geminiHeaders(key), body: JSON.stringify(geminiBody(system, geminiContents(rest), o)) }, o);
  const raw = await res.json();
  reportGemini(model, o, geminiUsage(raw));
  return geminiText(raw);
}

export async function* apiStream(p: ApiProvider, key: string, model: string, messages: ChatMessage[], o: CallOpts): AsyncGenerator<string> {
  const { system, rest } = splitSystem(messages);
  if (p === 'anthropic') {
    try {
      const stream = claude(key, o).messages.stream(
        {
          model,
          max_tokens: o.maxTokens ?? 16000,
          ...(system ? { system } : {}),
          messages: claudeMessages(rest),
          ...claudeExtras(model),
        } as Anthropic.MessageStreamParams,
        { signal: o.signal },
      );
      let inTok = 0;
      let outTok = 0;
      try {
        for await (const ev of stream) {
          if (ev.type === 'message_start') {
            const u = ev.message.usage;
            inTok = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
            outTok = u.output_tokens ?? 0;
          } else if (ev.type === 'message_delta') outTok = ev.usage.output_tokens ?? outTok;
          else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield ev.delta.text;
        }
      } finally {
        // 중단돼도 받은 만큼 기록
        report('anthropic', model, o, inTok, outTok);
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') throw new ModelError('BAD_RESPONSE', 'Claude가 요청을 거절함');
    } catch (e) {
      throw toErr(p, e, o.signal);
    }
    return;
  }
  if (p === 'openai') {
    const input = rest.map((m) => ({ role: m.role, content: m.content }));
    const res = await http(p, `${OPENAI}/responses`, { method: 'POST', headers: openaiHeaders(key), body: JSON.stringify(openaiBody(model, system, input, o, true)) }, o);
    for await (const raw of sse(p, res, o.signal)) {
      const ev = raw as { type?: string; delta?: string; error?: { message?: string }; response?: { error?: { message?: string }; usage?: OaUsage } };
      if (ev.type === 'response.output_text.delta' && ev.delta) yield ev.delta;
      else if (ev.type === 'response.completed' || ev.type === 'response.incomplete') reportOpenai(model, o, ev.response);
      else if (ev.type === 'error' || ev.type === 'response.failed') {
        throw new ModelError('BAD_RESPONSE', `OpenAI: ${ev.error?.message ?? ev.response?.error?.message ?? ev.type}`);
      }
    }
    return;
  }
  const res = await http(p, `${modelPath(model)}:streamGenerateContent?alt=sse`, { method: 'POST', headers: geminiHeaders(key), body: JSON.stringify(geminiBody(system, geminiContents(rest), o)) }, o);
  let usage: GeminiUsage | undefined;
  try {
    for await (const raw of sse(p, res, o.signal)) {
      usage = geminiUsage(raw) ?? usage;
      const t = geminiText(raw);
      if (t) yield t;
    }
  } finally {
    reportGemini(model, o, usage);
  }
}

/** 이미지 + 지시문 → 텍스트 (OCR) */
export async function apiVision(p: ApiProvider, key: string, model: string, system: string, prompt: string, imageB64: string, o: CallOpts): Promise<string> {
  const mime = imageMime(imageB64);
  if (p === 'anthropic') {
    try {
      const msg = await claude(key, o).messages.create(
        {
          model,
          max_tokens: o.maxTokens ?? 8192,
          system,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mime, data: imageB64 } },
                { type: 'text', text: prompt },
              ],
            },
          ],
          ...claudeExtras(model),
        } as Anthropic.MessageCreateParamsNonStreaming,
        { signal: o.signal },
      );
      reportClaude(model, o, msg.usage);
      return claudeText(msg);
    } catch (e) {
      throw toErr(p, e, o.signal);
    }
  }
  if (p === 'openai') {
    const content: OaContent[] = [
      { type: 'input_image', image_url: `data:${mime};base64,${imageB64}` },
      { type: 'input_text', text: prompt },
    ];
    const res = await http(p, `${OPENAI}/responses`, { method: 'POST', headers: openaiHeaders(key), body: JSON.stringify(openaiBody(model, system, [{ role: 'user', content }], o, false)) }, o);
    const raw = await res.json();
    reportOpenai(model, o, raw);
    return openaiText(raw);
  }
  const contents = [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: imageB64 } }, { text: prompt }] }];
  const res = await http(p, `${modelPath(model)}:generateContent`, { method: 'POST', headers: geminiHeaders(key), body: JSON.stringify(geminiBody(system, contents, { ...o, temperature: 0 })) }, o);
  const raw = await res.json();
  reportGemini(model, o, geminiUsage(raw));
  return geminiText(raw);
}

/** 음성 → 텍스트. Anthropic 미지원 */
export async function apiTranscribe(
  p: ApiProvider,
  key: string,
  model: string,
  audio: Buffer,
  mime: string,
  ext: string,
  language: string | undefined,
  o: CallOpts,
): Promise<{ text: string; language: string }> {
  if (p === 'anthropic') throw new ModelError('NOT_FOUND', 'Anthropic은 음성 인식(STT) 미지원');
  if (p === 'openai') {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), `audio.${ext}`);
    form.append('model', model);
    form.append('response_format', 'json');
    if (language) form.append('language', language);
    const res = await http(p, `${OPENAI}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form }, o);
    const data = (await res.json()) as { text?: string; language?: string; duration?: number; usage?: { type?: string; seconds?: number; input_tokens?: number; output_tokens?: number } };
    const u = data.usage;
    if (u?.type === 'duration' || (!u && data.duration)) report(p, model, o, 0, 0, Math.ceil(u?.seconds ?? data.duration ?? 0));
    else if (u) report(p, model, o, u.input_tokens, u.output_tokens);
    return { text: data.text ?? '', language: data.language ?? language ?? '' };
  }
  if (audio.length > 19 * 1024 * 1024) throw new ModelError('BAD_RESPONSE', 'Gemini 음성은 19MB 이하만 가능');
  const lang = language ? ` 언어: ${language}.` : '';
  const contents = [
    {
      role: 'user',
      parts: [
        { inline_data: { mime_type: mime.split(';')[0], data: audio.toString('base64') } },
        { text: `이 음성을 들리는 그대로 받아 적어.${lang} 번역·요약·설명 금지. 받아 적은 글만 출력.` },
      ],
    },
  ];
  const res = await http(p, `${modelPath(model)}:generateContent`, { method: 'POST', headers: geminiHeaders(key), body: JSON.stringify(geminiBody('', contents, { ...o, temperature: 0 })) }, o);
  const raw = await res.json();
  reportGemini(model, o, geminiUsage(raw));
  return { text: geminiText(raw).trim(), language: language ?? '' };
}

const NOT_CHAT = /(embed|tts|audio|realtime|transcri|whisper|image|dall-e|moderation|search|live|veo|imagen|aqa|computer-use|babbage|davinci|codex)/i;

/** 키로 실제 사용 가능한 모델 목록 조회 (연결 테스트 겸용) */
export async function apiListModels(p: ApiProvider, key: string, feature: AiFeature, o: CallOpts): Promise<string[]> {
  let ids: string[] = [];
  if (p === 'anthropic') {
    try {
      for await (const m of claude(key, o).models.list({ limit: 100 })) ids.push(m.id);
    } catch (e) {
      throw toErr(p, e, o.signal);
    }
    return feature === 'stt' ? [] : ids.filter((id) => id.startsWith('claude-'));
  }
  if (p === 'openai') {
    const res = await http(p, `${OPENAI}/models`, { headers: openaiHeaders(key) }, o);
    ids = (((await res.json()) as { data?: { id: string }[] }).data ?? []).map((m) => m.id);
    if (feature === 'stt') return ids.filter((id) => /transcribe|whisper/i.test(id) && !/realtime|live/i.test(id)).sort();
    return ids.filter((id) => /^(gpt-|o\d|chatgpt)/i.test(id) && !NOT_CHAT.test(id)).sort().reverse();
  }
  const res = await http(p, `${GEMINI}/models?pageSize=1000`, { headers: geminiHeaders(key) }, o);
  const models = ((await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }).models ?? [];
  ids = models
    .filter((m) => (m.supportedGenerationMethods ?? ['generateContent']).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((id) => id.startsWith('gemini'));
  if (feature === 'stt') return ids.filter((id) => /transcribe/i.test(id) || (!NOT_CHAT.test(id) && /flash|pro|argon/i.test(id))).sort().reverse();
  return ids.filter((id) => !NOT_CHAT.test(id)).sort().reverse();
}

/** 키 표시용 마스킹: sk-...abcd */
export function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return '••••';
  return `${k.slice(0, 4)}••••${k.slice(-4)}`;
}

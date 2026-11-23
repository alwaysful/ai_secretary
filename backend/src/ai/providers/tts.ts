import { ModelError } from '../models/base-model';
import { CallOpts, PROVIDER_LABEL } from './api-providers';

/** browser: 브라우저 speechSynthesis(무료·오프라인), edge: edge-tts(무료·온라인·자연스러움), openai/gemini: API(과금) */
export const TTS_ENGINES = ['browser', 'edge', 'openai', 'gemini'] as const;
export type TtsEngine = (typeof TTS_ENGINES)[number];
export type ServerTtsEngine = Exclude<TtsEngine, 'browser'>;

export const isTtsEngine = (v: unknown): v is TtsEngine => typeof v === 'string' && (TTS_ENGINES as readonly string[]).includes(v);

/** 첫 항목 = 기본값 */
export const TTS_MODELS: Record<ServerTtsEngine, string[]> = {
  edge: [],
  openai: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
  gemini: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'],
};

export const TTS_VOICES: Record<ServerTtsEngine, string[]> = {
  edge: ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural', 'ko-KR-HyunsuMultilingualNeural', 'en-US-AvaMultilingualNeural', 'en-US-EmmaMultilingualNeural', 'ja-JP-NanamiNeural'],
  openai: ['nova', 'shimmer', 'coral', 'sage', 'alloy', 'ash', 'ballad', 'echo', 'fable', 'onyx', 'verse', 'marin', 'cedar'],
  gemini: ['Kore', 'Leda', 'Aoede', 'Zephyr', 'Callirrhoe', 'Autonoe', 'Despina', 'Erinome', 'Laomedeia', 'Achernar', 'Sulafat', 'Vindemiatrix', 'Puck', 'Charon', 'Fenrir', 'Orus', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Algenib', 'Rasalgethi', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Sadachbia', 'Sadaltager'],
};

export const TTS_MAX_CHARS = 4000;

export const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'calm', 'excited', 'tender'] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** API 엔진용 연기 지시 */
const EMOTION_PROMPT: Record<Emotion, { en: string; adverb: string }> = {
  neutral: { en: '', adverb: '' },
  happy: { en: 'Speak in a bright, joyful, smiling tone.', adverb: 'cheerfully' },
  sad: { en: 'Speak in a sad, low, slightly trembling tone, slower.', adverb: 'sadly' },
  angry: { en: 'Speak in an irritated, angry, sharp tone.', adverb: 'angrily' },
  calm: { en: 'Speak in a calm, soft, relaxed and steady tone.', adverb: 'calmly' },
  excited: { en: 'Speak in a fluttering, excited, slightly breathless tone, like being in love.', adverb: 'excitedly' },
  tender: { en: 'Speak in a warm, affectionate, gentle tone, like talking to a loved one.', adverb: 'tenderly and warmly' },
};

/** 감정 지시 미지원 엔진(edge·tts-1)용 속도·높낮이 보정 */
export const EMOTION_PROSODY: Record<Emotion, { rate: number; pitchHz: number }> = {
  neutral: { rate: 1, pitchHz: 0 },
  happy: { rate: 1.08, pitchHz: 25 },
  sad: { rate: 0.85, pitchHz: -25 },
  angry: { rate: 1.12, pitchHz: -10 },
  calm: { rate: 0.92, pitchHz: -8 },
  excited: { rate: 1.12, pitchHz: 35 },
  tender: { rate: 0.95, pitchHz: 10 },
};

export interface SpeechOut {
  audio: Buffer;
  mime: string;
}

/** 16bit mono PCM → WAV */
export function pcmToWav(pcm: Buffer, rate = 24_000): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function post(engine: 'openai' | 'gemini', url: string, headers: Record<string, string>, body: unknown, o: CallOpts): Promise<Response> {
  const label = PROVIDER_LABEL[engine];
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(o.timeoutMs) });
  } catch (e) {
    throw new ModelError('UNAVAILABLE', `${label} TTS 연결 실패: ${(e as Error)?.message ?? e}`, e);
  }
  if (!res.ok) {
    const t = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new ModelError('UNAVAILABLE', `${label} API 키 오류 (${res.status}): ${t}`);
    if (res.status === 404) throw new ModelError('NOT_FOUND', `${label} TTS 모델 없음: ${t}`);
    throw new ModelError('BAD_RESPONSE', `${label} TTS ${res.status}: ${t}`);
  }
  return res;
}

/** 텍스트 → 음성 (OpenAI·Gemini API) */
export async function apiSpeak(engine: 'openai' | 'gemini', key: string, model: string, voice: string, text: string, speed: number, emotion: Emotion, o: CallOpts): Promise<SpeechOut> {
  const em = EMOTION_PROMPT[emotion];
  if (engine === 'openai') {
    // tts-1 계열은 instructions 미지원 → 속도로만 보정
    const steerable = !/^tts-1/.test(model);
    const sp = steerable ? speed : speed * EMOTION_PROSODY[emotion].rate;
    const res = await post(
      'openai',
      'https://api.openai.com/v1/audio/speech',
      { Authorization: `Bearer ${key}` },
      { model, voice, input: text, response_format: 'mp3', ...(sp !== 1 ? { speed: Math.min(4, Math.max(0.25, sp)) } : {}), ...(steerable && em.en ? { instructions: em.en } : {}) },
      o,
    );
    return { audio: Buffer.from(await res.arrayBuffer()), mime: 'audio/mpeg' };
  }
  const res = await post(
    'gemini',
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': key },
    {
      contents: [{ parts: [{ text: em.adverb ? `Say ${em.adverb}: ${text}` : text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    },
    o,
  );
  const raw = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
  const part = raw.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!part?.data) throw new ModelError('BAD_RESPONSE', 'Gemini TTS 응답에 음성 없음');
  const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? '')?.[1] ?? 24_000);
  return { audio: pcmToWav(Buffer.from(part.data, 'base64'), rate), mime: 'audio/wav' };
}

/** 키로 TTS 모델 실시간 조회 */
export async function apiTtsModels(engine: 'openai' | 'gemini', key: string): Promise<string[]> {
  const o = { timeoutMs: 15_000 };
  if (engine === 'openai') {
    const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(o.timeoutMs) });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    return (((await res.json()) as { data?: { id: string }[] }).data ?? []).map((m) => m.id).filter((id) => /tts/i.test(id)).sort();
  }
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(o.timeoutMs) });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  return (((await res.json()) as { models?: { name: string }[] }).models ?? [])
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((id) => /tts/i.test(id))
    .sort()
    .reverse();
}

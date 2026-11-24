import { useEffect, useState } from 'react';
import { api, Emotion, TtsEngine, TtsSettings } from './api';
import { stripTag } from './companionReply';

/** 설정 캐시. 설정 화면 저장 시 setTtsSettings로 갱신 */
let cfg: TtsSettings | null = null;
let loading: Promise<TtsSettings> | null = null;

const FALLBACK: TtsSettings = { engine: 'browser', model: null, voice: null, rate: 1, autoRead: false };

export function loadTts(force = false): Promise<TtsSettings> {
  if (cfg && !force) return Promise.resolve(cfg);
  if (!loading || force) {
    loading = api
      .settings()
      .then((s) => (cfg = s.tts ?? FALLBACK))
      .catch(() => cfg ?? FALLBACK)
      .finally(() => (loading = null));
  }
  return loading;
}

export function setTtsSettings(t: TtsSettings): void {
  cfg = t;
  emit();
}

export function useTtsSettings(): TtsSettings | null {
  const [t, setT] = useState<TtsSettings | null>(cfg);
  useEffect(() => {
    void loadTts().then(setT);
    return subscribe(() => setT(cfg));
  }, []);
  return t;
}

/** 마크다운·코드·URL 제거 → 읽을 글 */
export function speakable(md: string): string {
  return stripTag(md)
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```[\s\S]*?```/g, ' 코드 생략. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~|#]+/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// ───── 감정 (모든 화면 공유, 브라우저에 기억) ─────

export const EMOTIONS: { id: Emotion; icon: string; label: string }[] = [
  { id: 'neutral', icon: '😐', label: '기본' },
  { id: 'happy', icon: '😄', label: '기쁨' },
  { id: 'sad', icon: '😢', label: '슬픔' },
  { id: 'angry', icon: '😠', label: '화남' },
  { id: 'calm', icon: '😌', label: '차분' },
  { id: 'excited', icon: '🥰', label: '설렘' },
  { id: 'tender', icon: '🤗', label: '다정' },
];

/** 브라우저 엔진 보정 (서버 edge와 같은 비율) */
const PROSODY: Record<Emotion, { rate: number; pitch: number }> = {
  neutral: { rate: 1, pitch: 1 },
  happy: { rate: 1.08, pitch: 1.25 },
  sad: { rate: 0.85, pitch: 0.75 },
  angry: { rate: 1.12, pitch: 0.9 },
  calm: { rate: 0.92, pitch: 0.92 },
  excited: { rate: 1.12, pitch: 1.35 },
  tender: { rate: 0.95, pitch: 1.1 },
};

const EMO_KEY = 'aura.ttsEmotion';
let emotion: Emotion = (() => {
  try {
    const v = localStorage.getItem(EMO_KEY) as Emotion | null;
    return v && v in PROSODY ? v : 'neutral';
  } catch {
    return 'neutral';
  }
})();

export function setEmotion(e: Emotion): void {
  emotion = e;
  try {
    localStorage.setItem(EMO_KEY, e);
  } catch {
    /* 무시 */
  }
  emit();
}

export function useEmotion(): [Emotion, (e: Emotion) => void] {
  const [e, setE] = useState<Emotion>(emotion);
  useEffect(() => subscribe(() => setE(emotion)), []);
  return [e, setEmotion];
}

// ───── 재생 상태 (어디서 읽는 중인지) ─────

let current: string | null = null;
let audio: HTMLAudioElement | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

function emit(): void {
  for (const fn of listeners) fn();
  // Live2D 입모양 등 외부 연결용
  window.dispatchEvent(new CustomEvent('aura-tts', { detail: { id: current, audio } }));
}

function setCurrent(id: string | null): void {
  current = id;
  emit();
}

/** 지금 읽는 항목 id */
export function useSpeaking(): string | null {
  const [id, setId] = useState<string | null>(current);
  useEffect(() => subscribe(() => setId(current)), []);
  return id;
}

export function stopSpeaking(): void {
  seq++;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  if (audio) {
    audio.pause();
    audio.src = '';
    audio = null;
  }
  if (current !== null) setCurrent(null);
}

export const browserTtsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** 브라우저 목소리 목록 (비동기로 채워짐) */
export function useBrowserVoices(): SpeechSynthesisVoice[] {
  const [v, setV] = useState<SpeechSynthesisVoice[]>(() => (browserTtsSupported() ? speechSynthesis.getVoices() : []));
  useEffect(() => {
    if (!browserTtsSupported()) return;
    const on = () => setV(speechSynthesis.getVoices());
    on();
    speechSynthesis.addEventListener('voiceschanged', on);
    return () => speechSynthesis.removeEventListener('voiceschanged', on);
  }, []);
  return v;
}

/** 브라우저 엔진: 긴 글은 끊김 방지로 문장 단위 */
function chunks(text: string, max = 180): string[] {
  const parts = text.match(/[^.!?。！？\n]+[.!?。！？]*\s*|\n/g) ?? [text];
  const out: string[] = [];
  let buf = '';
  for (const p of parts) {
    if ((buf + p).length > max && buf) {
      out.push(buf.trim());
      buf = '';
    }
    buf += p;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

function pickVoice(name: string | null): SpeechSynthesisVoice | undefined {
  const all = speechSynthesis.getVoices();
  return (name && all.find((v) => v.name === name)) || all.find((v) => v.lang.toLowerCase().startsWith('ko'));
}

function speakBrowser(text: string, t: TtsSettings, emo: Emotion, my: number): Promise<void> {
  if (!browserTtsSupported()) return Promise.reject(new Error('이 브라우저는 음성 합성 미지원'));
  const voice = pickVoice(t.voice);
  return new Promise((done, fail) => {
    const list = chunks(text);
    let i = 0;
    const next = () => {
      if (my !== seq) return done();
      if (i >= list.length) return done();
      const u = new SpeechSynthesisUtterance(list[i++]);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'ko-KR';
      u.rate = Math.min(2, t.rate * PROSODY[emo].rate);
      u.pitch = PROSODY[emo].pitch;
      u.onend = next;
      u.onerror = (e) => (e.error === 'interrupted' || e.error === 'canceled' ? done() : fail(new Error(`음성 합성 오류: ${e.error}`)));
      speechSynthesis.speak(u);
    };
    next();
  });
}

async function speakServer(text: string, o: { engine: TtsEngine; model?: string; voice?: string; rate?: number; emotion?: Emotion }, my: number): Promise<void> {
  const r = await api.tts(text, o);
  if (my !== seq) return;
  const a = new Audio(`data:${r.mime};base64,${r.audio}`);
  audio = a;
  emit();
  await new Promise<void>((done, fail) => {
    a.onended = () => done();
    a.onpause = () => done();
    a.onerror = () => fail(new Error('오디오 재생 실패'));
    a.play().catch(fail);
  });
}

let voiceOverride: Partial<TtsSettings> | null = null;

/** 화면 전용 목소리 (AI 여자친구). null = 전역 설정 */
export function setVoiceOverride(v: Partial<TtsSettings> | null): void {
  voiceOverride = v;
}

/**
 * 읽기. 같은 id 다시 누르면 정지(토글).
 * override: 설정 화면 미리 듣기용
 */
export async function speak(id: string, text: string, override?: Partial<TtsSettings> & { emotion?: Emotion }): Promise<void> {
  if (current === id) return stopSpeaking();
  stopSpeaking();
  const clean = speakable(text);
  if (!clean) return;
  const my = ++seq;
  setCurrent(id);
  try {
    const t = { ...(await loadTts()), ...voiceOverride, ...override };
    const emo = override?.emotion ?? emotion;
    if (t.engine === 'browser') await speakBrowser(clean, t, emo, my);
    else await speakServer(clean, { engine: t.engine, ...(t.model ? { model: t.model } : {}), ...(t.voice ? { voice: t.voice } : {}), rate: t.rate, emotion: emo }, my);
  } finally {
    if (my === seq) {
      audio = null;
      setCurrent(null);
    }
  }
}

export const ENGINE_LABEL: Record<TtsEngine, string> = {
  browser: '브라우저 내장 (무료·오프라인)',
  edge: 'edge-tts (무료·자연스러움·인터넷)',
  openai: 'OpenAI TTS (API 과금)',
  gemini: 'Gemini TTS (API 과금)',
};

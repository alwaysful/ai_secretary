import { useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api';

export type VoiceEngine = 'server' | 'browser';
export type VoiceState = 'off' | 'wait' | 'listening' | 'hearing' | 'thinking';

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};
const RecCtor = (): (new () => Rec) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const browserSttSupported = () => typeof window !== 'undefined' && !!RecCtor();

const blobB64 = (b: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => fail(r.error);
    r.readAsDataURL(b);
  });

const SPEECH_RMS = 0.035;
const SILENCE_MS = 1100;
const MAX_MS = 25_000;
const IDLE_MS = 15_000;

/**
 * 핸즈프리 음성 대화. paused(답변 생성·읽는 중) 동안 쉼 → 끝나면 다시 듣기.
 * server: 녹음 + 음량으로 말 끝 감지 → /tools/stt (로컬 Whisper 또는 API)
 * browser: Web Speech API (Chrome은 구글 서버로 전송)
 */
export function useVoiceTalk(o: { enabled: boolean; paused: boolean; engine: VoiceEngine; onText: (t: string) => void }) {
  const [state, setState] = useState<VoiceState>('off');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const [hold, setHold] = useState(false);
  const onText = useRef(o.onText);
  onText.current = o.onText;

  // 보낸 뒤 답변 시작(paused)까지 대기. 시작 안 되면 10초 뒤 풀기
  useEffect(() => {
    if (!hold) return;
    if (o.paused) return setHold(false);
    const t = setTimeout(() => setHold(false), 10_000);
    return () => clearTimeout(t);
  }, [hold, o.paused]);

  const active = o.enabled && !o.paused && !hold;

  useEffect(() => {
    if (!o.enabled) {
      setState('off');
      setLevel(0);
      return;
    }
    if (!active) {
      setState('wait');
      setLevel(0);
      return;
    }
    setError('');
    let dead = false;
    const deliver = (t: string) => {
      const text = t.trim();
      if (!text || dead) return false;
      setHold(true);
      onText.current(text);
      return true;
    };

    if (o.engine === 'browser') {
      const C = RecCtor();
      if (!C) {
        setError('이 브라우저는 음성 인식 미지원. 서버 STT 사용.');
        return;
      }
      let rec: Rec | null = null;
      let restart = 0;
      const go = () => {
        if (dead) return;
        rec = new C();
        rec.lang = 'ko-KR';
        rec.continuous = false;
        rec.interimResults = true;
        let got = false;
        rec.onresult = (e) => {
          setState('hearing');
          const r = e.results[e.results.length - 1];
          if (r?.isFinal && deliver(r[0].transcript)) got = true;
        };
        rec.onerror = (e) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            dead = true;
            setError('마이크 권한 거부됨');
          }
        };
        rec.onend = () => {
          if (!got && !dead) restart = window.setTimeout(go, 250);
        };
        setState('listening');
        try {
          rec.start();
        } catch {
          restart = window.setTimeout(go, 500);
        }
      };
      go();
      return () => {
        dead = true;
        clearTimeout(restart);
        try {
          rec?.abort();
        } catch {
          /* 무시 */
        }
      };
    }

    // ── server STT ──
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('마이크 사용 불가 (https 또는 localhost 필요)');
      return;
    }
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let timer = 0;
    let rec: MediaRecorder | null = null;
    (async () => {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (dead) return;
      ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

      const cycle = () => {
        if (dead || !stream) return;
        const chunks: Blob[] = [];
        rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        const t0 = Date.now();
        let spokeAt = 0;
        let lastLoud = 0;
        let keep = false;
        rec.onstop = async () => {
          if (dead) return;
          if (!keep) return cycle();
          setState('thinking');
          setLevel(0);
          try {
            const type = rec?.mimeType || mime || 'audio/webm';
            const r = await api.stt(await blobB64(new Blob(chunks, { type })), type, 'ko', 'mic');
            if (!deliver(r.text)) cycle();
          } catch (e) {
            setError(`음성 인식 실패: ${e instanceof Error ? e.message : e}`);
            if (!dead) timer = window.setTimeout(cycle, 1500);
          }
        };
        rec.start(250);
        setState('listening');
        const tick = () => {
          if (dead || rec?.state !== 'recording') return;
          an.getFloatTimeDomainData(buf);
          let s = 0;
          for (const v of buf) s += v * v;
          const rms = Math.sqrt(s / buf.length);
          setLevel(Math.min(1, rms * 8));
          const now = Date.now();
          if (rms > SPEECH_RMS) {
            if (!spokeAt) {
              spokeAt = now;
              setState('hearing');
            }
            lastLoud = now;
          }
          const done = spokeAt && now - lastLoud > SILENCE_MS;
          if (done || now - t0 > MAX_MS) {
            keep = !!spokeAt && lastLoud - spokeAt > 300;
            return rec.stop();
          }
          if (!spokeAt && now - t0 > IDLE_MS) return rec.stop(); // 버리고 새로
          timer = window.setTimeout(tick, 80);
        };
        tick();
      };
      cycle();
    })().catch((e: unknown) => setError(`마이크 권한 실패: ${e instanceof Error ? e.message : e}`));

    return () => {
      dead = true;
      clearTimeout(timer);
      try {
        if (rec?.state === 'recording') rec.stop();
      } catch {
        /* 무시 */
      }
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, [o.enabled, active, o.engine]);

  return { state, level, error };
}

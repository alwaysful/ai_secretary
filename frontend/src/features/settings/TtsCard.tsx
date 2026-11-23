import { useEffect, useState } from 'react';
import { api, TtsEngine, TtsOptions, TtsSettings } from '../../shared/api';
import { EmotionPicker } from '../../shared/TtsControls';
import { browserTtsSupported, ENGINE_LABEL, setTtsSettings, speak, useBrowserVoices, useSpeaking } from '../../shared/tts';

const ENGINES: TtsEngine[] = ['browser', 'edge', 'openai', 'gemini'];
const SAMPLE = '안녕하세요. 저는 AURA예요. 오늘 하루도 같이 힘내 봐요.';
const same = (a: TtsSettings, b: TtsSettings) =>
  a.engine === b.engine && (a.model ?? '') === (b.model ?? '') && (a.voice ?? '') === (b.voice ?? '') && a.rate === b.rate && a.autoRead === b.autoRead;

/** TTS 엔진·모델·목소리·속도·자동 읽기 */
export function TtsCard(props: { initial: TtsSettings }) {
  const [saved, setSaved] = useState(props.initial);
  const [t, setT] = useState(props.initial);
  const [opts, setOpts] = useState<TtsOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const browserVoices = useBrowserVoices();
  const previewing = useSpeaking() === 'tts-preview';

  useEffect(() => {
    if (t.engine === 'browser') return setOpts(null);
    let alive = true;
    setOpts(null);
    api.ttsOptions(t.engine).then(
      (o) => alive && setOpts(o),
      () => alive && setOpts({ models: [], voices: [], live: false, keySet: false }),
    );
    return () => {
      alive = false;
    };
  }, [t.engine]);

  const voices =
    t.engine === 'browser'
      ? [...browserVoices].sort((a, b) => Number(b.lang.startsWith('ko')) - Number(a.lang.startsWith('ko'))).map((v) => ({ id: v.name, label: `${v.name} (${v.lang})` }))
      : (opts?.voices ?? []).map((v) => ({ id: v, label: v }));
  const withCur = (list: { id: string; label: string }[], cur: string | null) => (cur && !list.some((x) => x.id === cur) ? [{ id: cur, label: cur }, ...list] : list);
  const models = opts ? (t.model && !opts.models.includes(t.model) ? [t.model, ...opts.models] : opts.models) : [];

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const s = await api.saveTts({ engine: t.engine, model: t.model ?? '', voice: t.voice ?? '', rate: t.rate, autoRead: t.autoRead });
      setSaved(s.tts);
      setT(s.tts);
      setTtsSettings(s.tts);
      setMsg({ ok: true, text: 'TTS 저장됨.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const preview = () => {
    setMsg(null);
    speak('tts-preview', SAMPLE, t).catch((e: unknown) => setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) }));
  };

  return (
    <section className="card">
      <h2>🔊 TTS (글 → 음성)</h2>
      <label className="field">
        <span>엔진</span>
        <select value={t.engine} onChange={(e) => setT({ ...t, engine: e.target.value as TtsEngine, model: null, voice: null })}>
          {ENGINES.map((e) => (
            <option key={e} value={e}>
              {ENGINE_LABEL[e]}
            </option>
          ))}
        </select>
      </label>
      {(t.engine === 'openai' || t.engine === 'gemini') && (
        <label className="field">
          <span>모델</span>
          <select value={t.model ?? models[0] ?? ''} disabled={!opts} onChange={(e) => setT({ ...t, model: e.target.value })}>
            {models.map((m, i) => (
              <option key={m} value={m}>
                {m}
                {i === 0 && !t.model ? ' (기본)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>목소리</span>
        <select value={t.voice ?? ''} onChange={(e) => setT({ ...t, voice: e.target.value || null })}>
          <option value="">기본{t.engine === 'browser' ? ' (한국어 첫 목소리)' : opts?.voices[0] ? ` (${opts.voices[0]})` : ''}</option>
          {withCur(voices, t.voice).map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>속도 {t.rate.toFixed(2)}x</span>
        <input type="range" min={0.5} max={2} step={0.05} value={t.rate} onChange={(e) => setT({ ...t, rate: Number(e.target.value) })} />
      </label>
      <label className="switch-row">
        <input type="checkbox" checked={t.autoRead} onChange={(e) => setT({ ...t, autoRead: e.target.checked })} />
        <span>
          AI 채팅 답변 자동 읽기
          <small className="muted">끄면 답변마다 🔊 버튼으로 읽기. AI 여자친구 화면은 따로 켜고 끔.</small>
        </span>
      </label>
      <div className="field">
        <span>미리 듣기 감정</span>
        <EmotionPicker compact />
      </div>
      {t.engine === 'browser' && !browserTtsSupported() && <p className="error">이 브라우저는 음성 합성 미지원.</p>}
      {opts && !opts.keySet && <p className="error">API 키 없음. 아래 API 키에서 입력.</p>}
      {opts?.error && <p className="error">실시간 모델 목록 실패: {opts.error}</p>}
      <div className="chips">
        <button className="ghost" onClick={preview}>
          {previewing ? '■ 정지' : '▶ 미리 듣기'}
        </button>
        <button className="primary" disabled={busy || same(t, saved)} onClick={() => void save()}>
          {busy ? '저장 중…' : 'TTS 저장'}
        </button>
      </div>
      {msg && <p className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</p>}
      <p className="muted">
        브라우저: 무료·오프라인, Windows 기본 목소리(기계음 조금). edge-tts: 무료, MS 신경망 목소리라 자연스러움, 인터넷 필요(start-aura.bat가 자동 설치).
        <br />
        OpenAI·Gemini: 가장 자연스럽고 감정 연기 가능, 사용량 과금. 로컬 PC 부담 없음.
      </p>
    </section>
  );
}

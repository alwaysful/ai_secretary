import { useRef, useState } from 'react';
import { api, CompanionView, TtsEngine, VoicePreset } from '../../shared/api';
import { currentToken } from '../../shared/adminToken';
import { EMOTIONS, ENGINE_LABEL, setEmotion, speak, useEmotion } from '../../shared/tts';
import { CompanionPersona } from '../admin/CompanionPersona';

type Tab = 'model' | 'voice' | 'persona';
const err = (e: unknown) => (e instanceof Error ? e.message : String(e));
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;
const ENGINES: TtsEngine[] = ['edge', 'browser', 'openai', 'gemini'];
const MAX_ZIP = 30 * 1024 * 1024;

function toB64(f: File): Promise<string> {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => fail(r.error ?? new Error('파일 읽기 실패'));
    r.readAsDataURL(f);
  });
}

const sameVoice = (a: VoicePreset | null, b: VoicePreset) =>
  !!a && a.engine === b.engine && (a.voice ?? null) === (b.voice ?? null) && (a.model ?? null) === (b.model ?? null) && a.rate === b.rate;

/** 관리자 전용 AI 여자친구 꾸미기: Live2D 모델·음성 프리셋·성격 프리셋 */
export function CompanionStudio(props: { view: CompanionView; onChange: (v: CompanionView) => void; onClose: () => void }) {
  const v = props.view;
  const [tab, setTab] = useState<Tab>('model');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [emo] = useEmotion();
  const fileRef = useRef<HTMLInputElement>(null);
  const [upName, setUpName] = useState('');
  // 새 음성 프리셋
  const [nv, setNv] = useState<Omit<VoicePreset, 'id' | 'emotion'>>({ name: '', engine: 'edge', voice: 'ko-KR-SunHiNeural', model: null, rate: 1 });
  const [personaName, setPersonaName] = useState('');

  const call = async (fn: (t: string) => Promise<CompanionView | unknown>, done?: string) => {
    const t = currentToken();
    if (!t) return setMsg('관리자 세션 없음');
    setBusy(true);
    setMsg('');
    try {
      const r = await fn(t);
      if (r && typeof r === 'object' && 'personas' in r) props.onChange(r as CompanionView);
      if (done) setMsg(done);
    } catch (e) {
      setMsg(err(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return setMsg('zip 파일 선택');
    if (!/\.zip$/i.test(f.name)) return setMsg('zip 파일만');
    if (f.size > MAX_ZIP) return setMsg(`최대 30MB (지금 ${mb(f.size)})`);
    await call(async (t) => {
      const zip = await toB64(f);
      await api.adminUploadLive2d(t, upName || f.name.replace(/\.zip$/i, ''), zip);
      return api.adminCompanion(t);
    }, '업로드 완료');
    if (fileRef.current) fileRef.current.value = '';
    setUpName('');
  };

  const applyVoice = (p: VoicePreset) => {
    setEmotion(p.emotion as never);
    void call((t) => api.adminSetCompanionVoice(t, { name: p.name, engine: p.engine, model: p.model ?? null, voice: p.voice ?? null, rate: p.rate, emotion: p.emotion }), `목소리: ${p.name}`);
  };
  const preview = (p: Pick<VoicePreset, 'engine' | 'model' | 'voice' | 'rate'> & { emotion?: string }) =>
    void speak('cmp-preview', '안녕! 오늘 하루 어땠어? 나 계속 기다렸어.', {
      engine: p.engine,
      model: p.model ?? null,
      voice: p.voice ?? null,
      rate: p.rate,
      emotion: (p.emotion ?? emo) as never,
    }).catch((e: unknown) => setMsg(err(e)));

  return (
    <div className="cmp-studio">
      <div className="cmp-tabs" role="tablist">
        {(
          [
            ['model', '🧍 Live2D'],
            ['voice', '🎙 목소리'],
            ['persona', '💕 성격'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="ghost" onClick={props.onClose}>
          닫기
        </button>
      </div>

      {tab === 'model' && (
        <div className="cmp-sec">
          <ul className="cmp-list">
            <li className={!v.model ? 'on' : ''}>
              <button className="cmp-pick" disabled={busy} onClick={() => void call((t) => api.adminSetCompanionModel(t, null), '모델 끔')}>
                <b>모델 없음</b>
                <small className="muted">이모지 자리 표시</small>
              </button>
            </li>
            {v.models.map((m) => (
              <li key={m.id} className={v.model === m.id ? 'on' : ''}>
                <button className="cmp-pick" disabled={busy} onClick={() => void call((t) => api.adminSetCompanionModel(t, m.id), `모델: ${m.name}`)}>
                  <b>{m.name}</b>
                  <small className="muted">
                    {m.files}개 파일 · {mb(m.bytes)}
                  </small>
                </button>
                <button
                  className="ghost danger-text"
                  disabled={busy}
                  onClick={() => window.confirm(`${m.name} 삭제?`) && void call((t) => api.adminDeleteLive2d(t, m.id), '삭제됨')}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <div className="cmp-upload">
            <input ref={fileRef} type="file" accept=".zip,application/zip" />
            <input className="rename" placeholder="이름 (선택)" value={upName} maxLength={60} onChange={(e) => setUpName(e.target.value)} />
            <button className="primary" disabled={busy} onClick={() => void upload()}>
              {busy ? '처리 중…' : '업로드'}
            </button>
          </div>
          <p className="muted small">Cubism 3 이상 모델 폴더를 zip으로 (*.model3.json, .moc3, 텍스처 포함). 30MB 이하. 첫 업로드는 바로 적용.</p>
        </div>
      )}

      {tab === 'voice' && (
        <div className="cmp-sec">
          <ul className="cmp-list">
            <li className={!v.voice ? 'on' : ''}>
              <button className="cmp-pick" disabled={busy} onClick={() => void call((t) => api.adminSetCompanionVoice(t, null), '전역 TTS 설정 사용')}>
                <b>전역 설정 따름</b>
                <small className="muted">설정 → TTS</small>
              </button>
            </li>
            {v.voices.map((p) => (
              <li key={p.id} className={sameVoice(v.voice, p) ? 'on' : ''}>
                <button className="cmp-pick" disabled={busy} onClick={() => applyVoice(p)}>
                  <b>{p.name}</b>
                  <small className="muted">
                    {ENGINE_LABEL[p.engine]} · {p.voice ?? '기본'} · {p.rate}x · {EMOTIONS.find((e) => e.id === p.emotion)?.label ?? p.emotion}
                  </small>
                </button>
                <button className="ghost" onClick={() => preview(p)} aria-label="미리 듣기">
                  ▶
                </button>
                {!p.builtin && (
                  <button className="ghost danger-text" disabled={busy} onClick={() => void call((t) => api.adminDeletePreset(t, 'voice', p.id), '삭제됨')}>
                    삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
          <h4>새 프리셋</h4>
          <div className="cmp-form">
            <input className="rename" placeholder="이름" maxLength={40} value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} />
            <select value={nv.engine} onChange={(e) => setNv({ ...nv, engine: e.target.value as TtsEngine })}>
              {ENGINES.map((e) => (
                <option key={e} value={e}>
                  {ENGINE_LABEL[e]}
                </option>
              ))}
            </select>
            <input className="rename" placeholder="목소리 (예: ko-KR-SunHiNeural)" value={nv.voice ?? ''} onChange={(e) => setNv({ ...nv, voice: e.target.value || null })} />
            {(nv.engine === 'openai' || nv.engine === 'gemini') && (
              <input className="rename" placeholder="모델 (비우면 기본)" value={nv.model ?? ''} onChange={(e) => setNv({ ...nv, model: e.target.value || null })} />
            )}
            <label className="field">
              <span>속도 {nv.rate.toFixed(2)}x</span>
              <input type="range" min={0.5} max={2} step={0.05} value={nv.rate} onChange={(e) => setNv({ ...nv, rate: Number(e.target.value) })} />
            </label>
            <p className="muted small">감정: 지금 고른 감정 ({EMOTIONS.find((e) => e.id === emo)?.label}) 저장</p>
            <div className="chips">
              <button className="ghost" onClick={() => preview({ ...nv })}>
                ▶ 미리 듣기
              </button>
              <button className="primary" disabled={busy || !nv.name.trim()} onClick={() => void call((t) => api.adminAddVoice(t, { ...nv, name: nv.name.trim(), emotion: emo }), '저장됨')}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'persona' && (
        <div className="cmp-sec">
          <ul className="cmp-list">
            {v.personas.map((p) => (
              <li key={p.id} className={v.prompt === p.prompt ? 'on' : ''}>
                <button className="cmp-pick" disabled={busy} onClick={() => void call((t) => api.adminSetCompanion(t, p.prompt === v.default ? '' : p.prompt), `성격: ${p.name}`)}>
                  <b>{p.name}</b>
                  <small className="muted cmp-clip">{p.prompt}</small>
                </button>
                {!p.builtin && (
                  <button className="ghost danger-text" disabled={busy} onClick={() => void call((t) => api.adminDeletePreset(t, 'persona', p.id), '삭제됨')}>
                    삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
          <h4>직접 편집</h4>
          <CompanionPersona key={v.prompt} onSaved={props.onChange} />
          <div className="cmp-form row">
            <input className="rename" placeholder="지금 성격을 프리셋으로 저장: 이름" maxLength={40} value={personaName} onChange={(e) => setPersonaName(e.target.value)} />
            <button
              className="ghost"
              disabled={busy || !personaName.trim()}
              onClick={() => void call((t) => api.adminAddPersona(t, personaName.trim(), v.prompt), '프리셋 저장됨').then(() => setPersonaName(''))}
            >
              저장
            </button>
          </div>
        </div>
      )}
      {msg && <p className="muted small">{msg}</p>}
    </div>
  );
}

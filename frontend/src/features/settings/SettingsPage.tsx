import { ReactNode, useEffect, useState } from 'react';
import { AiFeature, AiRoute, api, ApiError, ApiProvider, Settings } from '../../shared/api';
import { TtsCard } from './TtsCard';

type PermKey = 'screenRead' | 'pcControl' | 'mic' | 'webcam';

const PERMS: { key: PermKey; icon: string; label: string; desc: string }[] = [
  { key: 'screenRead', icon: '👁️', label: '화면 읽기', desc: 'AI가 내 화면을 캡처해 분석 (공부 집중 딴짓 감시, PC 조작)' },
  { key: 'pcControl', icon: '🖱️', label: 'PC 조작', desc: 'AI가 내 마우스·키보드를 직접 움직임. 끄면 실행 중인 작업도 멈춤' },
  { key: 'mic', icon: '🎤', label: '마이크', desc: '도구 탭 음성 녹음(STT). 끄면 녹음 차단, 파일 변환은 가능' },
  { key: 'webcam', icon: '📷', label: '웹캠', desc: '공부 집중 자세·졸음 분석. 끄면 카메라 안 켬' },
];

function ModelSelect(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  def: string;
  loading: boolean;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)} disabled={props.loading}>
        {props.options.map((m) => (
          <option key={m} value={m}>
            {m}
            {m === props.def ? ' (기본)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

const FEATURES: AiFeature[] = ['chat', 'ocr', 'stt'];
const routeChanged = (a: AiRoute, b: AiRoute) => a.source !== b.source || a.provider !== b.provider || (a.model ?? '') !== (b.model ?? '');

const FEATURE_LABEL: Record<AiFeature, string> = { chat: '💬 AI 채팅', ocr: '🖼️ OCR (이미지 → 글자)', stt: '🎙️ STT (음성 → 글자)' };

/** 기능 하나: 로컬/API → 공급자 → 모델 */
function FeatureModel(props: {
  feature: AiFeature;
  settings: Settings;
  route: AiRoute;
  onRoute: (r: AiRoute) => void;
  local: ReactNode;
}) {
  const { feature, settings, route } = props;
  const providers = settings.providers.filter((p) => p.features.includes(feature));
  const [list, setList] = useState<{ models: string[]; live: boolean; error?: string } | null>(null);
  const keySet = route.provider ? settings.apiKeys[route.provider]?.set : false;

  useEffect(() => {
    if (route.source !== 'api' || !route.provider) return;
    let alive = true;
    setList(null);
    api.apiModels(route.provider, feature).then(
      (r) => alive && setList(r),
      () => alive && setList({ models: [], live: false }),
    );
    return () => {
      alive = false;
    };
  }, [route.source, route.provider, feature, keySet]);

  const models = list ? (route.model && !list.models.includes(route.model) ? [route.model, ...list.models] : list.models) : [];
  const setSource = (source: 'local' | 'api') => {
    if (source === 'api' && !route.provider) props.onRoute({ source, provider: providers[0]?.id ?? null, model: null });
    else props.onRoute({ ...route, source });
  };

  return (
    <div className="feature-model">
      <div className="feature-head">
        <strong>{FEATURE_LABEL[feature]}</strong>
        <div className="seg">
          <button className={route.source === 'local' ? 'on' : ''} onClick={() => setSource('local')}>
            로컬
          </button>
          <button className={route.source === 'api' ? 'on' : ''} onClick={() => setSource('api')}>
            API
          </button>
        </div>
      </div>
      {route.source === 'local' ? (
        props.local
      ) : (
        <>
          <label className="field">
            <span>공급자</span>
            <select
              value={route.provider ?? ''}
              onChange={(e) => props.onRoute({ source: 'api', provider: e.target.value as ApiProvider, model: null })}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {settings.apiKeys[p.id]?.set ? '' : ' (키 없음)'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>모델</span>
            <select
              value={route.model ?? models[0] ?? ''}
              disabled={!list}
              onChange={(e) => props.onRoute({ ...route, model: e.target.value })}
            >
              {models.map((m, i) => (
                <option key={m} value={m}>
                  {m}
                  {i === 0 && !route.model ? ' (기본)' : ''}
                </option>
              ))}
            </select>
          </label>
          {!keySet && <p className="error">이 공급자 API 키 없음. 아래 API 키에서 입력.</p>}
          {list && !list.live && keySet && list.error && <p className="error">실시간 목록 실패: {list.error}</p>}
          {list && !list.live && !keySet && <p className="muted">추천 모델 목록. 키 입력 시 실제 사용 가능 목록 표시.</p>}
        </>
      )}
    </div>
  );
}

/** API 키 입력·테스트·삭제. 키 원문은 다시 표시 안 함 */
function ApiKeys(props: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [draft, setDraft] = useState<Partial<Record<ApiProvider, string>>>({});
  const [busy, setBusy] = useState<ApiProvider | null>(null);
  const [res, setRes] = useState<Partial<Record<ApiProvider, { ok: boolean; text: string }>>>({});

  const run = async (p: ApiProvider, fn: () => Promise<void>) => {
    setBusy(p);
    try {
      await fn();
    } catch (e) {
      setRes((r) => ({ ...r, [p]: { ok: false, text: e instanceof Error ? e.message : String(e) } }));
    } finally {
      setBusy(null);
    }
  };
  const save = (p: ApiProvider) =>
    run(p, async () => {
      const key = draft[p]?.trim() ?? '';
      const t = await api.testApiKey(p, key);
      if (!t.ok) {
        setRes((r) => ({ ...r, [p]: { ok: false, text: `저장 안 함. ${t.message}` } }));
        return;
      }
      props.onSaved(await api.saveApiKey(p, key));
      setDraft((d) => ({ ...d, [p]: '' }));
      setRes((r) => ({ ...r, [p]: { ok: true, text: `저장됨. ${t.message}` } }));
    });
  const test = (p: ApiProvider) =>
    run(p, async () => {
      const t = await api.testApiKey(p);
      setRes((r) => ({ ...r, [p]: { ok: t.ok, text: t.message } }));
    });
  const remove = (p: ApiProvider) =>
    run(p, async () => {
      props.onSaved(await api.deleteApiKey(p));
      setRes((r) => ({ ...r, [p]: { ok: true, text: '삭제됨.' } }));
    });

  return (
    <section className="card">
      <h2>API 키</h2>
      {props.settings.providers.map((p) => {
        const k = props.settings.apiKeys[p.id];
        return (
          <div className="api-key" key={p.id}>
            <div className="feature-head">
              <strong>{p.label}</strong>
              <span className="muted">{k?.set ? `등록됨 ${k.hint}` : '없음'}</span>
            </div>
            <div className="chips">
              <input
                type="password"
                className="rename"
                autoComplete="off"
                placeholder={k?.set ? '새 키로 바꾸기' : 'API 키 붙여넣기'}
                value={draft[p.id] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
              />
              <button className="primary" disabled={busy === p.id || !draft[p.id]?.trim()} onClick={() => void save(p.id)}>
                저장
              </button>
              {k?.set && (
                <>
                  <button className="ghost" disabled={busy === p.id} onClick={() => void test(p.id)}>
                    연결 테스트
                  </button>
                  <button className="ghost" disabled={busy === p.id} onClick={() => void remove(p.id)}>
                    삭제
                  </button>
                </>
              )}
            </div>
            {busy === p.id && <p className="muted">확인 중…</p>}
            {res[p.id] && <p className={res[p.id]!.ok ? 'ok-text' : 'error'}>{res[p.id]!.text}</p>}
          </div>
        );
      })}
      <p className="muted">
        키는 암호화돼 DB에 저장. 화면엔 앞·뒤 4자리만 표시. 입력은 PC에서만 가능. 저장 전 연결 테스트 자동 실행.
        {props.settings.providers.some((p) => !p.features.includes('stt')) && ' Anthropic은 STT 미지원.'}
      </p>
    </section>
  );
}

export function SettingsPage(props: { onBack: () => void; onModels: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [modelsError, setModelsError] = useState('');
  const [model, setModel] = useState('');
  const [ocrModel, setOcrModel] = useState('');
  const [sttModel, setSttModel] = useState('');
  const [vision, setVision] = useState<string[] | null>(null);
  const [sttList, setSttList] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [routes, setRoutes] = useState<Record<AiFeature, AiRoute> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.settings().then(
      (s) => {
        setSettings(s);
        setModel(s.model);
        setOcrModel(s.ocrModel);
        setSttModel(s.sttModel);
        setPrompt(s.systemPrompt);
        setRoutes(s.routes);
      },
      (e: unknown) => setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) }),
    );
    api.visionModels().then(setVision, () => setVision([]));
    api.sttModels().then(setSttList, () => setSttList([]));
    api.models().then(setModels, (e: unknown) => {
      setModels([]);
      setModelsError(e instanceof ApiError && e.code === 'OLLAMA_DOWN' ? 'Ollama 연결 안 됨. 모델 목록을 못 가져옴.' : String(e));
    });
  }, []);

  const [permBusy, setPermBusy] = useState(false);
  const togglePerm = async (key: PermKey, on: boolean) => {
    setPermBusy(true);
    setMsg(null);
    try {
      const s = await api.savePermissions({ [key]: on });
      setSettings((prev) =>
        prev ? { ...prev, pcControl: s.pcControl, screenRead: s.screenRead, mic: s.mic, webcam: s.webcam } : s,
      );
      setMsg({ ok: true, text: `${PERMS.find((p) => p.key === key)?.label} ${on ? '켜짐' : '꺼짐'}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setPermBusy(false);
    }
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    try {
      for (const f of FEATURES) {
        const r = routes?.[f];
        if (r && routeChanged(r, settings.routes[f])) {
          await api.saveRoute(f, { source: r.source, ...(r.provider ? { provider: r.provider } : {}), ...(r.model ? { model: r.model } : {}) });
        }
      }
      const s = await api.saveSettings({
        ...(model !== settings.model ? { model } : {}),
        ...(prompt !== settings.systemPrompt ? { systemPrompt: prompt } : {}),
        ...(ocrModel !== settings.ocrModel ? { ocrModel } : {}),
        ...(sttModel !== settings.sttModel ? { sttModel } : {}),
      });
      setSettings(s);
      setModel(s.model);
      setOcrModel(s.ocrModel);
      setSttModel(s.sttModel);
      setPrompt(s.systemPrompt);
      setRoutes(s.routes);
      setMsg({
        ok: true,
        text: model !== settings.model && s.routes.chat.source === 'local' ? `저장됨. ${s.model} 첫 응답은 모델을 메모리에 올리느라 느릴 수 있음.` : '저장됨.',
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    !!settings &&
    (model !== settings.model ||
      prompt !== settings.systemPrompt ||
      ocrModel !== settings.ocrModel ||
      sttModel !== settings.sttModel ||
      FEATURES.some((f) => !!routes && routeChanged(routes[f], settings.routes[f])));
  const withCurrent = (list: string[] | null, cur: string) => (list && cur && !list.includes(cur) ? [cur, ...list] : (list ?? []));
  const options = withCurrent(models, model);
  const ocrOptions = withCurrent(vision, ocrModel);
  const sttOptions = withCurrent(sttList, sttModel);

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>설정</h1>
      </header>
      <div className="subbody">
        {!settings && !msg && <p className="muted">불러오는 중…</p>}
        {settings && (
          <>
            <section className="card">
              <h2>권한</h2>
              {PERMS.map((p) => (
                <label className="switch-row" key={p.key}>
                  <input
                    type="checkbox"
                    checked={settings[p.key]}
                    disabled={permBusy}
                    onChange={(e) => void togglePerm(p.key, e.target.checked)}
                  />
                  <span>
                    {p.icon} {p.label}
                    <small className="muted">{p.desc}</small>
                  </span>
                </label>
              ))}
              {settings.pcControl && !settings.screenRead && <p className="error">PC 조작은 화면 읽기도 켜야 동작함.</p>}
              <p className="muted">켜기는 PC에서만 가능. 끄기는 폰에서도 가능.</p>
            </section>
            <section className="card">
              <h2>모델</h2>
              {routes &&
                FEATURES.map((f) => (
                  <FeatureModel
                    key={f}
                    feature={f}
                    settings={settings}
                    route={routes[f]}
                    onRoute={(r) => setRoutes((prev) => (prev ? { ...prev, [f]: r } : prev))}
                    local={
                      f === 'chat' ? (
                        <ModelSelect label="Ollama 모델" value={model} onChange={setModel} options={options} def={settings.defaults.model} loading={models === null} />
                      ) : f === 'ocr' ? (
                        <ModelSelect label="Ollama 비전 모델" value={ocrModel} onChange={setOcrModel} options={ocrOptions} def={settings.defaults.ocrModel} loading={vision === null} />
                      ) : (
                        <ModelSelect label="Whisper 크기" value={sttModel} onChange={setSttModel} options={sttOptions} def={settings.defaults.sttModel} loading={false} />
                      )
                    }
                  />
                ))}
              {modelsError && <p className="error">{modelsError}</p>}
              <p className="muted">
                로컬: 내 PC에서 실행(무료, 사양 필요). API: 외부 서버 실행(빠름, 사용량 과금, 데이터 전송).
                <br />
                채팅·OCR 로컬 목록은 설치된 모델 (OCR은 이미지 지원 모델만). 16GB RAM이면 4B~8B 권장.
                <br />
                STT: tiny·base 빠름, small 기본, medium·large 정확하지만 느림. 바꾸면 첫 사용 때 자동 다운로드.
              </p>
              <div className="chips">
                <button className="ghost" onClick={props.onModels}>
                  ⬇ 모델 받기
                </button>
              </div>
            </section>
            <TtsCard initial={settings.tts} />
            <ApiKeys settings={settings} onSaved={(s) => setSettings((prev) => (prev ? { ...prev, apiKeys: s.apiKeys } : s))} />
            <section className="card">
              <h2>시스템 프롬프트</h2>
              <label className="field">
                <span>AI의 기본 성격·말투·규칙</span>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} maxLength={4000} />
              </label>
              <div className="chips">
                <button className="ghost" onClick={() => setPrompt(settings.defaults.systemPrompt)}>
                  기본값으로
                </button>
                <span className="muted">{prompt.length}/4000</span>
              </div>
            </section>
            <div className="chips">
              <button className="primary" disabled={!dirty || saving || !prompt.trim()} onClick={() => void save()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </>
        )}
        {msg && <p className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</p>}
      </div>
    </div>
  );
}

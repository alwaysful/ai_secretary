import { useEffect, useState } from 'react';
import { api, ApiError, Settings } from '../../shared/api';

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
      setMsg({
        ok: true,
        text: model !== settings.model ? `저장됨. ${s.model} 첫 응답은 모델을 메모리에 올리느라 느릴 수 있음.` : '저장됨.',
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
      sttModel !== settings.sttModel);
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
              <ModelSelect label="💬 AI 채팅 (Ollama)" value={model} onChange={setModel} options={options} def={settings.defaults.model} loading={models === null} />
              <ModelSelect label="🖼️ OCR (Ollama 비전 모델)" value={ocrModel} onChange={setOcrModel} options={ocrOptions} def={settings.defaults.ocrModel} loading={vision === null} />
              <ModelSelect label="🎙️ STT (Whisper 크기)" value={sttModel} onChange={setSttModel} options={sttOptions} def={settings.defaults.sttModel} loading={false} />
              {modelsError && <p className="error">{modelsError}</p>}
              <p className="muted">
                채팅·OCR 목록은 설치된 모델 (OCR은 이미지 지원 모델만). 16GB RAM이면 4B~8B 권장.
                <br />
                STT: tiny·base 빠름, small 기본, medium·large 정확하지만 느림. 바꾸면 첫 사용 때 자동 다운로드.
              </p>
              <div className="chips">
                <button className="ghost" onClick={props.onModels}>
                  ⬇ 다른 모델 다운로드 하러 가기
                </button>
              </div>
            </section>
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

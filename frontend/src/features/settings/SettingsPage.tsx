import { useEffect, useState } from 'react';
import { api, ApiError, Settings } from '../../shared/api';

export function SettingsPage(props: { onBack: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [modelsError, setModelsError] = useState('');
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.settings().then(
      (s) => {
        setSettings(s);
        setModel(s.model);
        setPrompt(s.systemPrompt);
      },
      (e: unknown) => setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) }),
    );
    api.models().then(setModels, (e: unknown) => {
      setModels([]);
      setModelsError(e instanceof ApiError && e.code === 'OLLAMA_DOWN' ? 'Ollama 연결 안 됨. 모델 목록을 못 가져옴.' : String(e));
    });
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    try {
      const s = await api.saveSettings({
        ...(model !== settings.model ? { model } : {}),
        ...(prompt !== settings.systemPrompt ? { systemPrompt: prompt } : {}),
      });
      setSettings(s);
      setModel(s.model);
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

  const dirty = !!settings && (model !== settings.model || prompt !== settings.systemPrompt);
  const options = models && !models.includes(model) && model ? [model, ...models] : (models ?? []);

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
              <h2>모델</h2>
              <label className="field">
                <span>사용할 Ollama 모델</span>
                <select value={model} onChange={(e) => setModel(e.target.value)} disabled={models === null}>
                  {options.map((m) => (
                    <option key={m} value={m}>
                      {m}
                      {m === settings.defaults.model ? ' (기본)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {modelsError && <p className="error">{modelsError}</p>}
              <p className="muted">
                목록은 설치된 모델. 새 모델은 터미널에서 <code>ollama pull 모델명</code>. 16GB RAM이면 4B~8B 권장.
              </p>
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

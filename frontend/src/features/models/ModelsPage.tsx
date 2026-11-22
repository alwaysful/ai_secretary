import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, HubModel, ModelHub, PullJob } from '../../shared/api';

const TAGS = ['전체', '한국어', '경량', '범용', '추론', '코딩', '비전', '대형'];

const gb = (bytes: number) => `${(bytes / 1e9).toFixed(1)}GB`;
const pct = (j: PullJob) => (j.total ? Math.floor((j.completed / j.total) * 100) : 0);
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const same = (a: string, b: string) => a === b || a === `${b}:latest` || b === `${a}:latest`;

function Meter(props: { label: string; value: number }) {
  return (
    <span className="meter" aria-label={`${props.label} ${props.value}/5`}>
      {props.label}
      <span className="pips">
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} className={i <= props.value ? 'on' : ''} />
        ))}
      </span>
    </span>
  );
}

function Progress(props: { job: PullJob; onCancel: () => void }) {
  const { job } = props;
  return (
    <div className="pull">
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct(job)}%` }} />
      </div>
      <small className="muted">
        {job.total ? `${pct(job)}% · ${gb(job.completed)} / ${gb(job.total)}` : job.phase}
      </small>
      <button className="ghost" onClick={props.onCancel}>
        취소
      </button>
    </div>
  );
}

/** Ollama 모델 목록·다운로드. 받은 모델은 설정의 모델 선택에 나온다. */
export function ModelsPage(props: { onBack: () => void; onSettings: () => void }) {
  const [hub, setHub] = useState<ModelHub | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [tag, setTag] = useState('전체');
  const [custom, setCustom] = useState('');

  const load = useCallback(
    () =>
      api.modelHub().then(
        (h) => {
          setHub(h);
          setError('');
        },
        (e: unknown) => setError(errText(e)),
      ),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const pulling = hub?.jobs.some((j) => j.status === 'pulling') ?? false;

  // 다운로드 중엔 1초마다 진행률, 끝나면 목록 새로고침
  useEffect(() => {
    if (!pulling) return;
    const t = setInterval(() => {
      api.pullJobs().then((jobs) => {
        setHub((h) => (h ? { ...h, jobs } : h));
        if (!jobs.some((j) => j.status === 'pulling')) void load();
      }, () => undefined);
    }, 1000);
    return () => clearInterval(t);
  }, [pulling, load]);

  const run = async (fn: () => Promise<unknown>, after?: string) => {
    setMsg('');
    try {
      await fn();
      if (after) setMsg(after);
    } catch (e) {
      setMsg(errText(e));
    }
    await load();
  };

  const pull = (name: string) => run(() => api.pullModel(name));
  const cancel = (name: string) => run(() => api.cancelPull(name));
  const remove = (name: string) => {
    if (window.confirm(`${name} 모델을 삭제할까요? 다시 쓰려면 재다운로드 필요.`)) void run(() => api.deleteModel(name), `${name} 삭제됨.`);
  };
  const use = (name: string) => run(() => api.saveSettings({ model: name }), `${name} 사용 중. 첫 응답은 느릴 수 있음.`);

  const jobOf = (name: string) => hub?.jobs.find((j) => same(j.name, name));
  const list = useMemo(() => (hub?.items ?? []).filter((m) => tag === '전체' || m.tags.includes(tag)), [hub, tag]);
  const extraJobs = (hub?.jobs ?? []).filter((j) => !hub?.items.some((m) => same(m.name, j.name)));

  const actions = (m: { name: string; installed: boolean }) => {
    const job = jobOf(m.name);
    if (job?.status === 'pulling') return <Progress job={job} onCancel={() => void cancel(m.name)} />;
    const current = !!hub && same(hub.current, m.name);
    return (
      <div className="chips">
        {job?.status === 'error' && <span className="error">실패: {job.error}</span>}
        {m.installed ? (
          <>
            {current ? (
              <span className="ok-text">✓ 사용 중</span>
            ) : (
              <button className="primary" onClick={() => void use(m.name)}>
                이 모델 사용
              </button>
            )}
            {!current && (
              <button className="ghost" onClick={() => remove(m.name)}>
                삭제
              </button>
            )}
          </>
        ) : (
          <button className="primary" disabled={!hub?.reachable} onClick={() => void pull(m.name)}>
            {job?.status === 'error' ? '다시 받기' : '⬇ 다운로드'}
          </button>
        )}
      </div>
    );
  };

  const card = (m: HubModel) => (
    <section key={m.name} className={`card model-card${m.installed ? ' installed' : ''}`}>
      <div className="model-head">
        <h2>{m.name}</h2>
        <small className="muted">{m.family}</small>
        {m.installed && <span className="badge">설치됨</span>}
      </div>
      <p>{m.desc}</p>
      <div className="model-meta">
        <span>💾 {m.bytes ? gb(m.bytes) : `약 ${m.sizeGb}GB`}</span>
        <span>🧮 RAM {m.ramGb}GB+</span>
        <Meter label="품질" value={m.quality} />
        <Meter label="속도" value={m.speed} />
      </div>
      <div className="chips">
        {m.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      {actions(m)}
    </section>
  );

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>모델 다운로드</h1>
        <button className="ghost" onClick={props.onSettings}>
          설정에서 모델 선택 →
        </button>
      </header>
      <div className="subbody">
        {hub && !hub.reachable && (
          <p className="error">Ollama 연결 안 됨. Ollama 앱 실행 후 새로고침. (`ollama serve`)</p>
        )}
        {error && <p className="error">{error}</p>}
        {msg && <p className="muted">{msg}</p>}
        <p className="muted">
          현재 모델: <b>{hub?.current ?? '…'}</b>. 받은 모델은 설정의 모델 선택에 나온다. 크기·RAM은 대략값. 16GB RAM이면 8B 이하
          권장.
        </p>
        <div className="chips">
          {TAGS.map((t) => (
            <button key={t} className={`chip${tag === t ? ' on' : ''}`} onClick={() => setTag(t)}>
              {t}
            </button>
          ))}
        </div>
        {!hub && !error && <p className="muted">불러오는 중…</p>}
        <div className="model-grid">{list.map(card)}</div>

        <section className="card">
          <h2>직접 입력</h2>
          <form
            className="chips"
            onSubmit={(e) => {
              e.preventDefault();
              if (custom.trim()) void pull(custom.trim()).then(() => setCustom(''));
            }}
          >
            <input
              className="search"
              style={{ flex: 1, width: 'auto' }}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="ollama.com/library 모델명 (예: llama3.2:1b)"
              maxLength={120}
            />
            <button className="primary" disabled={!custom.trim() || !hub?.reachable}>
              다운로드
            </button>
          </form>
          {extraJobs.map((j) =>
            j.status === 'pulling' ? (
              <div key={j.name}>
                <b>{j.name}</b>
                <Progress job={j} onCancel={() => void cancel(j.name)} />
              </div>
            ) : j.status === 'error' ? (
              <p key={j.name} className="error">
                {j.name} 실패: {j.error}
              </p>
            ) : null,
          )}
        </section>

        {hub && hub.others.length > 0 && (
          <section className="card">
            <h2>그 외 설치된 모델</h2>
            {hub.others.map((o) => (
              <div key={o.name} className="model-other">
                <span>
                  {o.name} <small className="muted">{gb(o.bytes)}</small>
                </span>
                {actions({ name: o.name, installed: true })}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, HubModel, ModelHub, PullJob } from '../../shared/api';

const TAGS = ['전체', '한국어', '경량', '범용', '추론', '코딩', '비전', '대형'];

type Tab = 'ollama' | 'hf' | 'stt' | 'apps';
const TABS: { id: Tab; label: string }[] = [
  { id: 'ollama', label: '🦙 Ollama' },
  { id: 'hf', label: '🤗 Hugging Face' },
  { id: 'stt', label: '🎙 음성 인식 (Whisper)' },
  { id: 'apps', label: '🧩 다른 로컬 AI 앱' },
];

/** faster-whisper 모델. 첫 사용 때 Hugging Face(Systran 등)에서 자동 다운로드. */
const WHISPER: { name: string; sizeGb: number; ramGb: number; quality: number; speed: number; desc: string; repo: string }[] = [
  { name: 'tiny', sizeGb: 0.08, ramGb: 1, quality: 1, speed: 5, desc: '초경량. 한국어 정확도 낮음.', repo: 'Systran/faster-whisper-tiny' },
  { name: 'base', sizeGb: 0.15, ramGb: 1, quality: 2, speed: 5, desc: '가벼움. 짧은 메모용.', repo: 'Systran/faster-whisper-base' },
  { name: 'small', sizeGb: 0.5, ramGb: 2, quality: 3, speed: 4, desc: '기본값. CPU에서 무난.', repo: 'Systran/faster-whisper-small' },
  { name: 'medium', sizeGb: 1.5, ramGb: 5, quality: 4, speed: 2, desc: '한국어 정확도 좋음. CPU면 느림.', repo: 'Systran/faster-whisper-medium' },
  { name: 'large-v3-turbo', sizeGb: 1.6, ramGb: 6, quality: 4, speed: 3, desc: 'large급 품질, 더 빠름. GPU 권장.', repo: 'mobiuslabsgmbh/faster-whisper-large-v3-turbo' },
  { name: 'large-v3', sizeGb: 3.1, ramGb: 10, quality: 5, speed: 1, desc: '최고 정확도. GPU 필수급.', repo: 'Systran/faster-whisper-large-v3' },
];

/** AURA와 별개로 쓰는 로컬 AI 앱. 설치는 각 사이트에서. */
const APPS: { name: string; url: string; desc: string }[] = [
  { name: 'LM Studio', url: 'https://lmstudio.ai', desc: 'GGUF 모델 검색·다운로드·채팅 GUI. OpenAI 호환 서버 제공.' },
  { name: 'Jan', url: 'https://jan.ai', desc: '오픈소스 오프라인 채팅 앱. 모델 허브 내장.' },
  { name: 'GPT4All', url: 'https://www.nomic.ai/gpt4all', desc: 'CPU 친화적 로컬 채팅. 내 문서 검색(LocalDocs).' },
  { name: 'llama.cpp', url: 'https://github.com/ggml-org/llama.cpp', desc: 'GGUF 실행 엔진 원본. 명령줄·서버.' },
  { name: 'Hugging Face GGUF 검색', url: 'https://huggingface.co/models?library=gguf&sort=trending', desc: 'GGUF 모델 찾기. 저장소 이름을 Hugging Face 탭에 입력.' },
  { name: 'Ollama 라이브러리', url: 'https://ollama.com/library', desc: 'Ollama 공식 모델 목록.' },
];

/** user/repo, huggingface.co/... URL → hf.co/user/repo[:quant] */
function toHfName(raw: string, quant: string): string {
  let s = raw.trim().replace(/^https?:\/\//, '').replace(/^(www\.)?huggingface\.co\//, '').replace(/^hf\.co\//, '');
  s = s.split(/[?#]/)[0].replace(/\/(tree|blob|resolve)\/.*$/, '').replace(/\/+$/, '');
  let tag = quant.trim();
  const c = s.indexOf(':');
  if (c >= 0) {
    tag = s.slice(c + 1) || tag;
    s = s.slice(0, c);
  }
  return `hf.co/${s}${tag ? `:${tag}` : ''}`;
}

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

/** 로컬 모델 목록·다운로드 (Ollama / Hugging Face GGUF / Whisper / 외부 앱). 받은 모델은 설정의 모델 선택에 나온다. */
export function ModelsPage(props: { onBack: () => void; onSettings: () => void }) {
  const [hub, setHub] = useState<ModelHub | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [tag, setTag] = useState('전체');
  const [custom, setCustom] = useState('');
  const [tab, setTab] = useState<Tab>('ollama');
  const [quant, setQuant] = useState('Q4_K_M');
  const [stt, setStt] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'stt') api.settings().then((s) => setStt(s.sttModel), (e: unknown) => setError(errText(e)));
  }, [tab]);
  const pickStt = (name: string) =>
    run(async () => setStt((await api.saveSettings({ sttModel: name })).sttModel), `음성 인식 ${name} 사용. 첫 사용 때 자동 다운로드.`);

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
  const list = useMemo(
    () => (hub?.items ?? []).filter((m) => (m.source ?? 'ollama') === tab && (tag === '전체' || m.tags.includes(tag))),
    [hub, tag, tab],
  );
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
        <div className="news-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {(tab === 'ollama' || tab === 'hf') && (
          <>
            <p className="muted">
              현재 모델: <b>{hub?.current ?? '…'}</b>. 받은 모델은 설정의 모델 선택에 나온다. 크기·RAM은 대략값. 16GB RAM이면 8B
              이하 권장.
              {tab === 'hf' && ' Hugging Face GGUF는 Ollama가 직접 받는다 (Ollama 0.3.13 이상).'}
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
            {hub && list.length === 0 && <p className="muted">이 태그에 해당 모델 없음.</p>}

            <section className="card">
              <h2>직접 입력</h2>
              <form
                className="chips"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = custom.trim();
                  if (v) void pull(tab === 'hf' ? toHfName(v, quant) : v).then(() => setCustom(''));
                }}
              >
                <input
                  className="search"
                  style={{ flex: 1, width: 'auto' }}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder={
                    tab === 'hf' ? 'Hugging Face GGUF 저장소 (예: bartowski/gemma-2-2b-it-GGUF 또는 주소)' : 'ollama.com/library 모델명 (예: llama3.2:1b)'
                  }
                  maxLength={200}
                />
                {tab === 'hf' && (
                  <input
                    className="search"
                    style={{ width: 110 }}
                    value={quant}
                    onChange={(e) => setQuant(e.target.value)}
                    placeholder="양자화"
                    title="양자화 태그 (Q4_K_M 권장). 비우면 저장소 기본값."
                    maxLength={30}
                  />
                )}
                <button className="primary" disabled={!custom.trim() || !hub?.reachable}>
                  다운로드
                </button>
              </form>
              {tab === 'hf' && custom.trim() && (
                <small className="muted">받을 이름: {toHfName(custom, quant)}</small>
              )}
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
          </>
        )}

        {tab === 'stt' && (
          <>
            <p className="muted">
              도구 탭 음성→텍스트(faster-whisper) 모델. 현재: <b>{stt ?? '…'}</b>. 고르면 바로 적용, 첫 사용 때 Hugging Face에서
              자동 다운로드. 설정에서도 변경 가능.
            </p>
            <div className="model-grid">
              {WHISPER.map((w) => {
                const cur = stt === w.name;
                return (
                  <section key={w.name} className={`card model-card${cur ? ' installed' : ''}`}>
                    <div className="model-head">
                      <h2>{w.name}</h2>
                      <small className="muted">faster-whisper</small>
                      {cur && <span className="badge">사용 중</span>}
                    </div>
                    <p>{w.desc}</p>
                    <div className="model-meta">
                      <span>💾 약 {w.sizeGb}GB</span>
                      <span>🧮 RAM {w.ramGb}GB+</span>
                      <Meter label="품질" value={w.quality} />
                      <Meter label="속도" value={w.speed} />
                    </div>
                    <div className="chips">
                      {!cur && (
                        <button className="primary" onClick={() => void pickStt(w.name)}>
                          이 모델 사용
                        </button>
                      )}
                      <a className="ghost" href={`https://huggingface.co/${w.repo}`} target="_blank" rel="noreferrer">
                        Hugging Face ↗
                      </a>
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}

        {tab === 'apps' && (
          <>
            <p className="muted">
              AURA 채팅은 Ollama로 실행. 아래 앱은 별도 설치용. 받아둔 <code>.gguf</code> 파일은 Modelfile에{' '}
              <code>FROM ./파일.gguf</code> 적고 <code>ollama create 이름 -f Modelfile</code> 하면 AURA에서도 사용 가능.
            </p>
            <div className="model-grid">
              {APPS.map((a) => (
                <section key={a.name} className="card model-card">
                  <div className="model-head">
                    <h2>{a.name}</h2>
                  </div>
                  <p>{a.desc}</p>
                  <div className="chips">
                    <a className="primary" href={a.url} target="_blank" rel="noreferrer">
                      사이트 열기 ↗
                    </a>
                  </div>
                </section>
              ))}
            </div>
          </>
        )}

        {(tab === 'ollama' || tab === 'hf') && hub && hub.others.length > 0 && (
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

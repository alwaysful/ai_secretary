import { useEffect, useState } from 'react';
import { api, PcCheck } from '../../shared/api';
import { isNative } from '../../shared/backend';
import { isLive, usePcRun } from './usePcRun';

const STATUS: Record<string, string> = {
  starting: '시작 중',
  running: '실행 중',
  done: '완료',
  cancelled: '취소됨',
  failed: '실패',
};

const EXAMPLES = ['메모장 열고 "안녕하세요" 입력', '크롬 주소창에 naver.com 입력하고 엔터', '바탕화면 휴지통 열기'];

export function PcControlPage(props: { onBack: () => void }) {
  const { run, setRun, live, cancel } = usePcRun();
  const [goal, setGoal] = useState('');
  const [check, setCheck] = useState<PcCheck | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNative()) api.pcCheck().then(setCheck, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const start = async () => {
    const g = goal.trim();
    if (!g || live) return;
    const ok = window.confirm(
      [
        'AI가 마우스·키보드를 직접 움직입니다.',
        `목표: ${g}`,
        '',
        '중지 방법:',
        '· Esc 또는 Ctrl+Alt+X',
        '· 마우스를 화면 모서리로',
        '· 화면 위 ■ 정지 버튼',
        '',
        '시작할까요?',
      ].join('\n'),
    );
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      setRun(await api.pcStart(g));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (isNative()) {
    return (
      <div className="subpage">
        <header className="bar">
          <button className="ghost" onClick={props.onBack}>← 로비</button>
          <h1>PC 조작</h1>
        </header>
        <div className="subbody">
          <p className="muted">PC 브라우저에서만 사용 가능.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>← 로비</button>
        <h1>🖱️ PC 조작</h1>
      </header>
      <div className="subbody pc-page">
        <div className="card">
          <h2>할 일</h2>
          <textarea
            rows={3}
            value={goal}
            maxLength={500}
            placeholder="예: 메모장 열고 오늘 할 일 적기"
            onChange={(e) => setGoal(e.target.value)}
            disabled={live}
          />
          <div className="chips">
            {EXAMPLES.map((x) => (
              <button key={x} className="chip" onClick={() => setGoal(x)} disabled={live}>
                {x}
              </button>
            ))}
          </div>
          <div className="row">
            {live ? (
              <button className="primary danger" onClick={() => void cancel()}>
                ■ 정지 (Esc)
              </button>
            ) : (
              <button className="primary" onClick={() => void start()} disabled={!goal.trim() || busy || check?.ok === false}>
                ▶ 시작
              </button>
            )}
          </div>
          <p className="muted">중지: Esc · Ctrl+Alt+X · 마우스를 화면 모서리로 · 정지 버튼. 채팅에서 "PC: 할 일"로도 가능.</p>
          {check && !check.ok && (
            <p className="error">
              Python 준비 안 됨: {check.detail}
              <br />
              설치: <code>pip install -r pc-agent/requirements.txt</code>
            </p>
          )}
          {check?.ok && <p className="muted">모델: {check.model}</p>}
          {error && <p className="error">{error}</p>}
        </div>

        {run && (
          <div className="card">
            <h2>
              {STATUS[run.status] ?? run.status} · {run.goal}
            </h2>
            {!isLive(run) && run.message && <p>{run.message}</p>}
            <ol className="pc-steps">
              {run.steps.map((s) => (
                <li key={s.n} className={s.error ? 'err' : ''}>
                  <code>{s.action || '—'}</code>
                  {s.thought && <span className="muted"> {s.thought}</span>}
                  {s.error && <span className="error"> {s.error}</span>}
                </li>
              ))}
              {isLive(run) && <li className="muted">화면 보는 중…</li>}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

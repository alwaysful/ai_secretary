import { useEffect, useRef, useState } from 'react';
import { ApiError, BriefingData, streamBriefing, StreamPhase } from '../../shared/api';
import { Markdown } from '../../shared/Markdown';
import { diagnoseError, NoticeBox, PHASE_TEXT } from '../../shared/Notice';

const SRC_ERROR: Record<string, string> = {
  NOT_CONFIGURED: '미설정 (backend/README.md 참고)',
  NOT_CONNECTED: '미연결 (채팅 화면 사이드바에서 Outlook/Google 연결)',
};

export function Briefing(props: { onBack: () => void }) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<StreamPhase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof diagnoseError> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setError(null);
    setText('');
    setData(null);
    setPhase(null);
    try {
      await streamBriefing(
        { onToken: (t) => setText((p) => p + t), onStatus: setPhase, onData: setData },
        ac.signal,
      );
    } catch (e) {
      if (!ac.signal.aborted) {
        setError(diagnoseError(e instanceof ApiError ? e.code : 'INTERNAL', e instanceof Error ? e.message : String(e), '모델'));
      }
    } finally {
      if (abortRef.current === ac) {
        setBusy(false);
        setPhase(null);
      }
    }
  };

  useEffect(() => {
    void run();
    return () => abortRef.current?.abort();
  }, []);

  const today = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date());

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>아침 브리핑 · {today}</h1>
      </header>
      <div className="subbody">
        {error && <NoticeBox d={error} onRetry={() => void run()} />}
        <section className="card">
          <h2>AI 요약</h2>
          {text ? (
            <Markdown text={text} />
          ) : busy ? (
            <div className="phase" role="status">
              <span className="spinner" aria-hidden />
              {phase ? PHASE_TEXT[phase] : '준비 중…'}
            </div>
          ) : (
            !error && <p className="muted">요약 없음.</p>
          )}
          <div className="chips">
            {busy ? (
              <button className="ghost" onClick={() => abortRef.current?.abort()}>
                ■ 중단
              </button>
            ) : (
              <button className="ghost" onClick={() => void run()}>
                다시 만들기
              </button>
            )}
          </div>
        </section>

        {data && (
          <>
            <section className="card">
              <h2>오늘 일정 {data.errors.calendar ? '' : `(${data.events.length})`}</h2>
              {data.errors.calendar && <p className="error">{SRC_ERROR[data.errors.calendar] ?? data.errors.calendar}</p>}
              {!data.errors.calendar && data.events.length === 0 && <p className="muted">일정 없음.</p>}
              {data.events.map((e) => (
                <div key={e.id} className="row">
                  <time>{e.isAllDay ? '종일' : `${e.start.slice(11, 16)}–${e.end.slice(11, 16)}`}</time>
                  <div>
                    <strong>{e.subject}</strong>
                    {e.location && <small>📍 {e.location}</small>}
                  </div>
                </div>
              ))}
            </section>
            {(!!data.tasks?.length || !!data.errors.tasks) && (
              <section className="card">
                <h2>할 일 {data.errors.tasks ? '' : `(${data.tasks?.length ?? 0})`}</h2>
                {data.errors.tasks && <p className="error">{SRC_ERROR[data.errors.tasks] ?? data.errors.tasks}</p>}
                {data.tasks?.map((t) => (
                  <div key={t.id} className="row">
                    <time>{t.due ? (t.due < data.date ? `⚠ ${t.due.slice(5)}` : '오늘') : '—'}</time>
                    <div>
                      <strong>{t.title}</strong>
                    </div>
                  </div>
                ))}
              </section>
            )}
            <section className="card">
              <h2>중요·안 읽은 메일 {data.errors.mail ? '' : `(${data.mails.length})`}</h2>
              {data.errors.mail && <p className="error">{SRC_ERROR[data.errors.mail] ?? data.errors.mail}</p>}
              {!data.errors.mail && data.mails.length === 0 && <p className="muted">없음.</p>}
              {data.mails.map((m) => (
                <div key={m.id} className="row">
                  <time>{m.important ? '⭐ 중요' : '● 안읽음'}</time>
                  <div>
                    <strong>{m.subject}</strong>
                    <small>{m.from}</small>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

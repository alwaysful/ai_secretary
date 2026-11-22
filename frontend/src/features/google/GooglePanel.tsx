import { useCallback, useEffect, useState } from 'react';
import { api, MailStatus } from '../../shared/api';

/** Google 캘린더·Tasks 연동 상태. 로그인 창을 연 뒤 3초마다 상태를 확인한다. */
export function GooglePanel() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    api
      .googleStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(refresh, 3000);
    const stop = setTimeout(() => setWaiting(false), 10 * 60_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [waiting, refresh]);

  useEffect(() => {
    if (waiting && status?.connected) setWaiting(false);
  }, [waiting, status]);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!status) return null;
  if (!status.configured) return <p className="muted mail">Google 미설정. backend/README.md 참고.</p>;

  return (
    <div className="mail">
      {status.connected ? (
        <>
          <p>
            Google 연결됨 <span className="muted">{status.email}</span>
          </p>
          <button className="ghost" onClick={() => run(async () => { await api.googleDisconnect(); refresh(); })}>
            Google 연결 해제
          </button>
        </>
      ) : (
        <>
          <button
            className="ghost"
            onClick={() =>
              run(async () => {
                const { url } = await api.googleStart();
                window.open(url, '_blank', 'noopener');
                setWaiting(true);
              })
            }
          >
            Google 캘린더·할 일 연결
          </button>
          {waiting && <p className="muted">새 창에서 Google 로그인 후 권한 허용…</p>}
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

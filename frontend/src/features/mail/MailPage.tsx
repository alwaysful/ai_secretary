import { useCallback, useEffect, useState } from 'react';
import { api, MailStatus, MailSummary } from '../../shared/api';
import { MailPanel } from './MailPanel';

export function MailPage(props: { onBack: () => void }) {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [mails, setMails] = useState<MailSummary[] | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    api
      .mailStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const connected = status?.connected ?? false;

  useEffect(() => {
    if (!connected) {
      setMails(null);
      return;
    }
    let live = true;
    setError('');
    api.mailList(unreadOnly).then(
      (m) => live && setMails(m),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [connected, unreadOnly]);

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>메일</h1>
      </header>
      <div className="subbody">
        <MailPanel />
        {connected && (
          <div className="chips">
            <button className={unreadOnly ? 'chip' : 'chip on'} onClick={() => setUnreadOnly(false)}>
              전체
            </button>
            <button className={unreadOnly ? 'chip on' : 'chip'} onClick={() => setUnreadOnly(true)}>
              안 읽음
            </button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {connected && mails === null && !error && <p className="muted">불러오는 중…</p>}
        {mails?.length === 0 && <p className="muted">메일 없음.</p>}
        {mails?.map((m) => (
          <div key={m.id} className={m.isRead ? 'card' : 'card unread'}>
            <strong>{m.subject}</strong>
            <small className="muted">
              {m.from} · {new Date(m.receivedAt).toLocaleString('ko-KR')}
            </small>
            {m.preview && <p className="muted">{m.preview}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

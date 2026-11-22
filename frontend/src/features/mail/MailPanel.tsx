import { useCallback, useEffect, useState } from 'react';
import { api, DeviceLogin, MailStatus } from '../../shared/api';

/** Outlook 연동 상태. device code 로그인 중에는 3초마다 상태를 확인한다. */
export function MailPanel() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [login, setLogin] = useState<DeviceLogin | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    api
      .mailStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!login) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [login, refresh]);

  useEffect(() => {
    if (login && status?.connected) setLogin(null);
  }, [login, status]);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!status) return <p className="muted">메일 상태 확인 불가</p>;
  if (!status.configured) return <p className="muted">Outlook 미설정. backend/README.md 참고.</p>;

  return (
    <div className="mail">
      {status.connected ? (
        <>
          <p>
            Outlook 연결됨 <span className="muted">{status.email}</span>
          </p>
          <button className="ghost" onClick={() => run(async () => { await api.mailDisconnect(); refresh(); })}>
            연결 해제
          </button>
        </>
      ) : login ? (
        <p>
          <a href={login.verificationUri} target="_blank" rel="noreferrer">
            {login.verificationUri}
          </a>
          에서 코드 입력: <code>{login.userCode}</code>
        </p>
      ) : (
        <button className="ghost" onClick={() => run(async () => { setLogin(await api.mailStart()); refresh(); })}>
          Outlook 연결
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

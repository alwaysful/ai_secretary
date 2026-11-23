import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../shared/api';
import { adminLogin, currentToken, setAdminToken } from './session';
import './gate.css';

/** 로비 왼쪽 위 로고. 일반: 클릭 → 코드 입력 → 서버 검증 → onEnter. 관리자: 클릭 → 잠금 확인 → onLock */
export function AdminGate(props: { admin: boolean; onEnter: () => void; onLock: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setCode('');
    setErr(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminLogin(code.trim());
      close();
      props.onEnter();
    } catch (x) {
      setErr(x instanceof ApiError || x instanceof Error ? x.message : String(x));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    const t = currentToken();
    if (t) await api.adminLogout(t).catch(() => undefined);
    setAdminToken(null);
    close();
    props.onLock();
  };

  return (
    <>
      <button className={`logo pride${props.admin ? ' life' : ''}`} onClick={() => setOpen(true)}>
        {props.admin ? 'AURA is our Life' : 'AURA is our Pride'}
      </button>
      {open && props.admin && (
        <div className="overlay" onClick={close}>
          <div className="dialog adm-gate" role="dialog" aria-modal="true" aria-label="관리자 모드" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && close()}>
            <h2>관리자 모드</h2>
            <p className="muted">잠그면 일반 로비로 돌아감</p>
            <div className="sc-actions">
              <span style={{ flex: 1 }} />
              <button type="button" className="ghost" onClick={close}>
                취소
              </button>
              <button type="button" className="primary" onClick={lock}>
                🔒 잠금
              </button>
            </div>
          </div>
        </div>
      )}
      {open && !props.admin && (
        <div className="overlay" onClick={close}>
          <form
            className="dialog adm-gate"
            role="dialog"
            aria-modal="true"
            aria-label="코드 입력"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && close()}
            onSubmit={submit}
          >
            <h2>코드 입력</h2>
            <input
              ref={input}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={64}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="코드"
            />
            {err && <p className="err">{err}</p>}
            <div className="sc-actions">
              <span style={{ flex: 1 }} />
              <button type="button" className="ghost" onClick={close}>
                취소
              </button>
              <button className="primary" disabled={busy || !code.trim()}>
                확인
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

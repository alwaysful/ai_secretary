import { useState } from 'react';
import { api } from '../../shared/api';

/** 관리자 코드 바꾸기 (backend/.env ADMIN_CODE 저장, 즉시 적용) */
export function CodeCard(props: { guard: <T>(fn: (t: string) => Promise<T>) => Promise<T | undefined> }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = /^\S{4,64}$/.test(next) && next === again && !!cur;
  const save = async () => {
    setBusy(true);
    setMsg(null);
    const r = await props.guard((t) => api.adminChangeCode(t, cur, next));
    setBusy(false);
    if (r) {
      setMsg({ ok: true, text: '바뀜. 다음 로그인부터 새 코드.' });
      setCur('');
      setNext('');
      setAgain('');
    }
  };

  return (
    <section className="card adm-card">
      <h2>🔑 관리자 코드</h2>
      <div className="adm-code">
        <input type="password" className="rename" autoComplete="current-password" placeholder="지금 코드" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input type="password" className="rename" autoComplete="new-password" placeholder="새 코드 (공백 없이 4~64자)" value={next} onChange={(e) => setNext(e.target.value)} />
        <input type="password" className="rename" autoComplete="new-password" placeholder="새 코드 확인" value={again} onChange={(e) => setAgain(e.target.value)} />
        <button className="primary" disabled={!valid || busy} onClick={() => void save()}>
          바꾸기
        </button>
      </div>
      {next && again && next !== again && <p className="error">새 코드 두 칸 다름</p>}
      {msg && <p className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</p>}
      <p className="muted small">backend/.env 의 ADMIN_CODE에 저장. 잊으면 그 줄 지우고 재시작 → 기본 코드.</p>
    </section>
  );
}

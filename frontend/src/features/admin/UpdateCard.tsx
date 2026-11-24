import { useState } from 'react';
import { api, UpdateResult, UpdateStatus } from '../../shared/api';

/** 관리자 전용: git pull + 재시작 */
export function UpdateCard(props: { guard: <T>(fn: (t: string) => Promise<T>) => Promise<T | undefined> }) {
  const [st, setSt] = useState<UpdateStatus | null>(null);
  const [res, setRes] = useState<UpdateResult | null>(null);
  const [busy, setBusy] = useState<'check' | 'pull' | 'restart' | null>(null);
  const [restarting, setRestarting] = useState(false);

  const check = async () => {
    setBusy('check');
    const s = await props.guard(api.adminUpdateStatus);
    setBusy(null);
    if (s) setSt(s);
  };
  const pull = async () => {
    if (st?.dirty.length && !window.confirm(`로컬 수정 파일 ${st.dirty.length}개. pull 실패할 수 있음. 진행?`)) return;
    setBusy('pull');
    const r = await props.guard(api.adminUpdate);
    setBusy(null);
    if (r) {
      setRes(r);
      void check();
    }
  };
  const restart = async () => {
    if (!window.confirm('AURA 재시작. 새 창이 뜨고 30초쯤 접속 끊김. 진행?')) return;
    setBusy('restart');
    const r = await props.guard(api.adminRestart);
    setBusy(null);
    if (!r) return;
    setRestarting(true);
    // 서버 다시 뜨면 새로고침
    const t0 = Date.now();
    const poll = setInterval(() => {
      if (Date.now() - t0 < 8000) return;
      api.health().then(
        () => {
          clearInterval(poll);
          window.location.reload();
        },
        () => Date.now() - t0 > 180_000 && clearInterval(poll),
      );
    }, 3000);
  };

  return (
    <section className="card adm-card wide">
      <h2>
        ⬆ 업데이트 · 재시작
        <span className="adm-row" style={{ marginTop: 0 }}>
          <button className="ghost" disabled={busy !== null || restarting} onClick={() => void check()}>
            {busy === 'check' ? '확인 중…' : '업데이트 확인'}
          </button>
          <button className="primary" disabled={busy !== null || restarting} onClick={() => void pull()}>
            {busy === 'pull' ? '받는 중…' : 'git pull'}
          </button>
          <button className="ghost danger-text" disabled={busy !== null || restarting} onClick={() => void restart()}>
            🔄 재시작
          </button>
        </span>
      </h2>
      {restarting && <p className="adm-msg">재시작 중. 새 AURA 창 뜸. 서버 돌아오면 자동 새로고침.</p>}
      {st && (
        <div className="adm-stats">
          <div className="adm-stat">
            <span className="muted small">현재</span>
            <strong>
              {st.branch} · {st.commit}
            </strong>
            <span className="muted small">{st.subject}</span>
          </div>
          <div className={`adm-stat ${st.behind ? 'bad' : 'ok'}`}>
            <span className="muted small">새 커밋</span>
            <strong>{st.behind ? `${st.behind}개` : '최신'}</strong>
          </div>
          <div className={`adm-stat ${st.dirty.length ? 'bad' : ''}`}>
            <span className="muted small">로컬 수정</span>
            <strong>{st.dirty.length}개</strong>
          </div>
        </div>
      )}
      {st?.error && <p className="adm-msg">{st.error}</p>}
      {st && st.incoming.length > 0 && (
        <ul className="adm-upd-list">
          {st.incoming.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {st && st.dirty.length > 0 && <p className="muted small">수정 파일: {st.dirty.join(', ')}</p>}
      {res && (
        <>
          <p className={res.ok ? 'ok-text' : 'error'}>
            {res.ok ? (res.changed.length ? `업데이트 완료. 파일 ${res.changed.length}개 바뀜.` : '이미 최신.') : 'pull 실패. 로그 확인.'}
            {res.installed.length > 0 && ` 의존성 설치: ${res.installed.join(', ')}.`}
            {res.restartNeeded && ' 재시작 필요 → 🔄 재시작.'}
          </p>
          <pre className="adm-pre">{res.log}</pre>
        </>
      )}
      {!st && !res && <p className="muted small">새 버전 확인 → git pull → 필요하면 재시작. 백엔드 코드만 바뀌면 자동 반영.</p>}
    </section>
  );
}

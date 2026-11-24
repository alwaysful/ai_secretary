import { useCallback, useEffect, useState } from 'react';
import { AdminLog, AdminOverview, AdminResetKind, api, ApiError } from '../../shared/api';
import { currentToken, setAdminToken } from './session';
import type { PageId } from '../../app/App';
import { useAdminDocs } from './useAdminDocs';
import { UpdateCard } from './UpdateCard';
import { CodeCard } from './CodeCard';
import './admin.css';

const RESET: { kind: AdminResetKind; label: string }[] = [
  { kind: 'conversations', label: '대화' },
  { kind: 'memories', label: '기억' },
  { kind: 'news', label: '새 소식 글' },
  { kind: 'study', label: '공부 기록' },
  { kind: 'phone', label: '폰 기록' },
  { kind: 'apiUsage', label: 'API 사용 기록' },
  { kind: 'vocab', label: '단어장 전체' },
];

const PERMS: { key: keyof AdminOverview['permissions']; label: string }[] = [
  { key: 'pcControl', label: 'PC 조작' },
  { key: 'screenRead', label: '화면 읽기' },
  { key: 'mic', label: '마이크' },
  { key: 'webcam', label: '웹캠' },
];

const LEVELS = ['', 'error,fatal', 'warn,error,fatal'] as const;
const LEVEL_LABEL: Record<(typeof LEVELS)[number], string> = { '': '전체', 'error,fatal': '오류', 'warn,error,fatal': '경고+' };

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const num = (n: number) => n.toLocaleString('ko-KR');
const ago = (iso: string | null) => {
  if (!iso) return '없음';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`;
};
const uptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d ? `${d}일 ` : ''}${h}시간 ${m}분`;
};

function Stat(props: { k: string; v: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className={`adm-stat ${props.tone ?? ''}`}>
      <span className="muted small">{props.k}</span>
      <strong>{props.v}</strong>
    </div>
  );
}

/** 관리자 로비. 서버 세션 토큰 필수, 만료 시 로비로 */
export function AdminPage(props: { onBack: () => void; onNavigate: (p: PageId) => void }) {
  const docs = useAdminDocs();
  const [ov, setOv] = useState<AdminOverview | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const token = currentToken();
  const expire = useCallback(() => {
    setAdminToken(null);
    props.onBack();
  }, [props]);

  const guard = useCallback(
    async <T,>(fn: (t: string) => Promise<T>): Promise<T | undefined> => {
      const t = currentToken();
      if (!t) return void expire();
      try {
        return await fn(t);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return void expire();
        setMsg(errText(e));
        return undefined;
      }
    },
    [expire],
  );

  const load = useCallback(() => {
    void guard(api.adminOverview).then((o) => o && setOv(o));
    void guard((t) => api.adminLogs(t, level || undefined)).then((l) => l && setLogs(l));
  }, [guard, level]);

  useEffect(() => {
    if (!token) return expire();
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [token, load, expire]);

  const run = async (key: string, fn: (t: string) => Promise<unknown>, done: string) => {
    setBusy(key);
    setMsg(null);
    const r = await guard(fn);
    setBusy(null);
    if (r !== undefined) {
      setMsg(done);
      load();
    }
  };

  const backup = async () => {
    setBusy('backup');
    const data = await guard(api.adminBackup);
    setBusy(null);
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aura-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setMsg('백업 저장됨 (API 키·메일 토큰 제외)');
  };

  const reset = (kind: AdminResetKind, label: string) => {
    if (!window.confirm(`${label} 전부 삭제. 되돌릴 수 없음. 진행?`)) return;
    void run(`reset-${kind}`, (t) => api.adminReset(t, kind), `${label} 삭제됨`);
  };

  const logout = async () => {
    const t = currentToken();
    if (t) await api.adminLogout(t).catch(() => undefined);
    expire();
  };

  const m = ov?.model;
  return (
    <div className="subpage adm">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← Admin 로비
        </button>
        <h1>고급설정</h1>
        <span style={{ flex: 1 }} />
        <button className="ghost" onClick={load}>
          ↻ 새로고침
        </button>
        <button className="ghost danger-text" onClick={logout}>
          🔒 잠금
        </button>
      </header>
      <main className="adm-in">
        {msg && <p className="adm-msg">{msg}</p>}
        {!ov ? (
          <p className="muted">불러오는 중</p>
        ) : (
          <div className="adm-grid">
            {docs && (
              <section className="card adm-card wide">
                <h2>🔐 관리자 기능</h2>
                <div className="adm-feats">
                  {docs.features.map((f) => (
                    <div key={f.title} className="adm-feat">
                      <strong>
                        {f.icon} {f.title}
                      </strong>
                      <ul>
                        {f.lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                      {f.page && f.page !== 'admin' && (
                        <button className="ghost" onClick={() => props.onNavigate(f.page as PageId)}>
                          열기 →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {docs && (
              <section className="card adm-card wide">
                <h2>🚧 구현 중인 기능</h2>
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>기능</th>
                      <th>상태</th>
                      <th>메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.inProgress.map((i) => (
                      <tr key={i.title}>
                        <td>{i.title}</td>
                        <td>
                          <span className="adm-badge">{i.status}</span>
                        </td>
                        <td className="muted">{i.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <UpdateCard guard={guard} />

            <section className="card adm-card">
              <h2>🖥️ 서버</h2>
              <div className="adm-stats">
                <Stat k="가동" v={uptime(ov.server.uptimeSec)} />
                <Stat k="메모리(RSS)" v={`${ov.server.rssMb} MB`} />
                <Stat k="힙" v={`${ov.server.heapMb} MB`} />
                <Stat k="PC 여유 RAM" v={`${num(ov.server.freeMemMb)} / ${num(ov.server.totalMemMb)} MB`} />
                <Stat k="Node" v={ov.server.node} />
                <Stat k="OS" v={ov.server.platform} />
              </div>
            </section>

            <section className="card adm-card">
              <h2>🔌 연결</h2>
              <div className="adm-stats">
                <Stat k="DB" v={ov.db === 'ok' ? '정상' : '끊김'} tone={ov.db === 'ok' ? 'ok' : 'bad'} />
                <Stat k="Ollama" v={m?.reachable ? '연결됨' : '끊김'} tone={m?.reachable ? 'ok' : 'bad'} />
                <Stat k="모델" v={m?.name ?? '-'} />
                <Stat k="상태" v={`${m?.state ?? '-'}${m?.installed === false ? ' · 미설치' : ''}${m?.loaded ? ' · 적재' : ''}`} tone={m?.installed === false ? 'bad' : undefined} />
              </div>
              <div className="adm-row">
                <button className="ghost" disabled={busy !== null} onClick={() => run('warm', () => api.warmup(), '모델 적재 시작')}>
                  모델 미리 올리기
                </button>
              </div>
            </section>

            <section className="card adm-card">
              <h2>🗄️ 데이터</h2>
              <div className="adm-stats">
                {ov.counts &&
                  ([
                    ['대화', ov.counts.conversations],
                    ['메시지', ov.counts.messages],
                    ['기억', ov.counts.memories],
                    ['새 소식', ov.counts.news],
                    ['공부', ov.counts.study],
                    ['폰', ov.counts.phone],
                    ['API 호출', ov.counts.apiUsage],
                    ['단어 카드', ov.counts.vocab ?? 0],
                  ] as const).map(([k, v]) => <Stat key={k} k={k} v={num(v)} />)}
              </div>
              <div className="adm-row">
                <button className="primary" disabled={busy !== null} onClick={backup}>
                  ⬇ 백업 JSON
                </button>
              </div>
            </section>

            <section className="card adm-card">
              <h2>💳 API 사용 (30일)</h2>
              {ov.apiUsage30d.length === 0 ? (
                <p className="muted">기록 없음</p>
              ) : (
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>공급자</th>
                      <th>호출</th>
                      <th>입력</th>
                      <th>출력</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ov.apiUsage30d.map((u) => (
                      <tr key={u.provider}>
                        <td>{u.provider}</td>
                        <td>{num(u.calls)}</td>
                        <td>{num(u.inputTokens)}</td>
                        <td>{num(u.outputTokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="card adm-card wide">
              <h2>
                📰 스크래퍼
                <button className="ghost" disabled={busy !== null} onClick={() => run('scrape', api.adminRefreshNews, '스크래핑 완료')}>
                  {busy === 'scrape' ? '실행 중…' : '지금 실행'}
                </button>
              </h2>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>사이트</th>
                    <th>마지막 실행</th>
                    <th>마지막 성공</th>
                    <th>오류</th>
                  </tr>
                </thead>
                <tbody>
                  {ov.scrape.map((s) => (
                    <tr key={s.id} className={s.enabled ? '' : 'off'}>
                      <td>
                        {s.name}
                        {!s.enabled && <span className="muted small"> (꺼짐)</span>}
                      </td>
                      <td>{ago(s.lastRunAt)}</td>
                      <td>{ago(s.lastOkAt)}</td>
                      <td className={s.lastError ? 'bad' : 'muted'}>{s.lastError ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <CodeCard guard={guard} />

            <section className="card adm-card">
              <h2>🛡️ 권한 강제 변경</h2>
              <p className="muted small">원격 기기에서도 켜기 가능</p>
              <div className="adm-perms">
                {PERMS.map((p) => (
                  <label key={p.key} className="adm-toggle">
                    <input
                      type="checkbox"
                      checked={ov.permissions[p.key]}
                      disabled={busy !== null}
                      onChange={(e) => run(`perm-${p.key}`, (t) => api.adminPermissions(t, { [p.key]: e.target.checked }), `${p.label} ${e.target.checked ? '켬' : '끔'}`)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </section>

            <section className="card adm-card">
              <h2>🧹 데이터 초기화</h2>
              <p className="muted small">되돌릴 수 없음. 먼저 백업</p>
              <div className="adm-reset">
                {RESET.map((r) => (
                  <button key={r.kind} className="ghost danger-text" disabled={busy !== null} onClick={() => reset(r.kind, r.label)}>
                    {r.label} 삭제
                  </button>
                ))}
              </div>
            </section>

            <section className="card adm-card wide">
              <h2>
                📜 서버 로그
                <span className="adm-seg">
                  {LEVELS.map((l) => (
                    <button key={l || 'all'} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>
                      {LEVEL_LABEL[l]}
                    </button>
                  ))}
                </span>
              </h2>
              <div className="adm-logs">
                {logs.length === 0 && <p className="muted">로그 없음</p>}
                {logs.map((l, i) => (
                  <div key={`${l.at}-${i}`} className={`adm-log ${l.level}`}>
                    <time>{new Date(l.at).toLocaleTimeString('en-GB')}</time>
                    <b>{l.level}</b>
                    <span className="ctx">{l.context}</span>
                    <span className="txt">{l.message}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

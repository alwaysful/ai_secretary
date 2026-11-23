import { useCallback, useEffect, useState } from 'react';
import { api, NewsKind, NewsPost, NewsSource } from '../../shared/api';
import { newsNotifySupported } from './useNewsNotify';

type Tab = 'all' | NewsKind;
const TABS: [Tab, string][] = [
  ['all', '전체'],
  ['notice', '학사공지'],
  ['contest', '공모전'],
];

const day = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' });
const when = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

/** 마감까지 남은 일수 */
function dday(iso: string): string {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d < 0 ? '마감' : d === 0 ? 'D-day' : `D-${d}`;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 웹 스크래핑: GIST 학사공지 + 공모전 사이트 새 글 */
export function NewsPage(props: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState('');
  const [posts, setPosts] = useState<NewsPost[] | null>(null);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState(newsNotifySupported() ? Notification.permission : 'denied');

  const load = useCallback(
    () =>
      Promise.all([
        api.newsPosts({ kind: tab === 'all' ? undefined : tab, unread: unreadOnly, q: q.trim() || undefined, limit: 100 }),
        api.newsSources(),
      ]).then(
        ([p, s]) => {
          setPosts(p);
          setSources(s);
          setError('');
        },
        (e: unknown) => setError(errMsg(e)),
      ),
    [tab, unreadOnly, q],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const open = (p: NewsPost) => {
    window.open(p.url, '_blank', 'noopener,noreferrer');
    if (!p.seenAt) void api.newsSeen({ ids: [p.id] }).then(load, () => undefined);
  };

  const nameOf = new Map(sources.map((s) => [s.id, s.name]));
  const unread = sources.filter((s) => tab === 'all' || s.kind === tab).reduce((a, s) => a + s.unread, 0);

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>새 소식</h1>
      </header>
      <div className="subbody">
        <p className="muted">GIST 학사공지·공모전 목록을 1시간마다 확인. 클릭하면 원문 새 탭 + 읽음 처리.</p>
        <div className="news-tools">
          <div className="news-tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <label className="news-check">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> 안 읽은 것만
          </label>
          <input className="news-search" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ghost" disabled={busy} onClick={() => void act(() => api.newsRefresh())} title="최근 5분 안에 확인한 사이트는 건너뜀">
            ↻ 새로고침
          </button>
          <button
            className="ghost"
            disabled={busy || unread === 0}
            onClick={() => void act(() => api.newsSeen({ kind: tab === 'all' ? undefined : tab }))}
          >
            모두 읽음 ({unread})
          </button>
          {perm === 'default' && (
            <button className="ghost" onClick={() => void Notification.requestPermission().then(setPerm)}>
              🔔 알림 켜기
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        {posts === null && !error && <p className="muted">불러오는 중…</p>}
        {posts?.length === 0 && <p className="muted">글 없음. 첫 수집은 백엔드 시작 30초 뒤.</p>}
        {posts && posts.length > 0 && (
          <ul className="news-list">
            {posts.map((p) => (
              <li key={p.id} className={p.seenAt ? '' : 'new'}>
                <button onClick={() => open(p)}>
                  <span className="news-title">
                    {!p.seenAt && <b className="news-dot">N</b>}
                    {p.title}
                  </span>
                  <span className="news-meta">
                    <span>{nameOf.get(p.source) ?? p.source}</span>
                    {p.category && <span>{p.category}</span>}
                    {p.author && <span>{p.author}</span>}
                    {p.postedAt && <span>{day.format(new Date(p.postedAt))}</span>}
                    {p.deadline && <span className="news-dday">{dday(p.deadline)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <details className="news-sources">
          <summary>사이트 ({sources.filter((s) => s.enabled).length}/{sources.length} 켜짐)</summary>
          <ul>
            {sources.map((s) => (
              <li key={s.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    disabled={busy}
                    onChange={(e) => void act(() => api.newsSourceEnabled(s.id, e.target.checked))}
                  />{' '}
                  <a href={s.homeUrl} target="_blank" rel="noreferrer">
                    {s.name}
                  </a>
                </label>
                <small className="muted">
                  {s.lastOkAt ? `확인 ${when.format(new Date(s.lastOkAt))}` : '아직 수집 안 됨'}
                  {s.lastError && ` · 실패: ${s.lastError}`}
                </small>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}

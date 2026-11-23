import { useCallback, useEffect, useState } from 'react';
import { api, NewsCategory, NewsItem } from '../../shared/api';
import { NewsCalendar } from './NewsCalendar';
import { NewsManage } from './NewsManage';
import { newsNotifySupported } from './useNewsNotify';

const day = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' });

/** 마감까지 남은 일수 */
function dday(iso: string): string {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d < 0 ? '마감' : d === 0 ? 'D-day' : `D-${d}`;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 새 소식: 카테고리별 게시판 글. 카테고리 안 같은 글은 하나로 합치고 사이트별 링크를 모두 표시 */
export function NewsPage(props: { onBack: () => void }) {
  const [manage, setManage] = useState(false);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [tab, setTab] = useState<string>('all');
  const [tag, setTag] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagCounts, setTagCounts] = useState<Map<string, number>>(new Map());
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [cats, setCats] = useState<NewsCategory[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState(newsNotifySupported() ? Notification.permission : 'denied');

  const categoryId = tab === 'all' ? undefined : tab;

  const load = useCallback(
    () =>
      Promise.all([
        api.newsFeed({ categoryId, unread: unreadOnly, q: q.trim() || undefined, limit: 300 }),
        api.newsCategories(),
      ]).then(
        ([f, c]) => {
          // 태그 개수는 태그 거르기 전 기준
          const counts = new Map<string, number>();
          for (const i of f) for (const t of i.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
          setTagCounts(counts);
          setItems(tag ? f.filter((i) => i.tags.includes(tag)) : f);
          setCats(c);
          setError('');
        },
        (e: unknown) => setError(errMsg(e)),
      ),
    [categoryId, unreadOnly, q, tag],
  );

  useEffect(() => {
    api.newsTags().then(setAllTags, () => undefined);
  }, []);

  useEffect(() => {
    if (manage) return;
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load, manage]);

  // 삭제된 카테고리 탭이면 전체로
  useEffect(() => {
    if (tab !== 'all' && cats.length && !cats.some((c) => c.id === tab)) setTab('all');
  }, [cats, tab]);

  // 탭 바꾸면 태그 초기화
  useEffect(() => setTag(''), [tab]);

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

  /** 링크 열기 + 합쳐진 글 전부 읽음 */
  const open = (it: NewsItem, url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    if (it.unread) void api.newsSeen({ ids: it.links.map((l) => l.id) }).then(load, () => undefined);
  };

  const unreadOf = (c: NewsCategory) => c.sites.reduce((a, s) => a + s.unread, 0);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const unreadHere = items?.filter((i) => i.unread).length ?? 0;

  if (manage) {
    return (
      <NewsManage
        onDone={() => {
          setManage(false);
          void load();
        }}
      />
    );
  }

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>새 소식</h1>
        <button className="ghost news-manage-btn" onClick={() => setManage(true)}>
          ⚙ 카테고리·사이트 관리
        </button>
      </header>
      <div className="subbody">
        <div className="news-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>
            전체
          </button>
          {cats
            .filter((c) => c.id)
            .map((c) => (
              <button key={c.id} role="tab" aria-selected={tab === c.id} className={tab === c.id ? 'on' : ''} onClick={() => setTab(c.id!)}>
                {c.name}
                {unreadOf(c) > 0 && <b className="news-count">{unreadOf(c)}</b>}
              </button>
            ))}
        </div>
        {tagCounts.size > 0 && (
          <div className="news-tags" role="tablist" aria-label="분야">
            <button className={tag === '' ? 'on' : ''} onClick={() => setTag('')}>
              # 전체 분야
            </button>
            {/* 글 없는 분야도 항상 표시 */}
            {allTags.map((t) => (
              <button
                key={t}
                className={`${tag === t ? 'on' : ''}${tagCounts.has(t) ? '' : ' empty'}`}
                onClick={() => setTag(tag === t ? '' : t)}
              >
                #{t} <small>{tagCounts.get(t) ?? 0}</small>
              </button>
            ))}
          </div>
        )}
        <div className="news-tools">
          <div className="news-view" role="tablist" aria-label="보기">
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
              ☰ 목록
            </button>
            <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>
              📅 달력
            </button>
          </div>
          <label className="news-check">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> 안 읽은 것만
          </label>
          <input className="news-search" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ghost" disabled={busy} onClick={() => void act(() => api.newsRefresh())} title="최근 5분 안에 확인한 사이트는 건너뜀">
            ↻ 새로고침
          </button>
          <button className="ghost" disabled={busy || unreadHere === 0} onClick={() => void act(() => api.newsSeen({ categoryId }))}>
            모두 읽음
          </button>
          {perm === 'default' && (
            <button className="ghost" onClick={() => void Notification.requestPermission().then(setPerm)}>
              🔔 알림 켜기
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        {view === 'calendar' && <NewsCalendar categoryId={categoryId} tag={tag || undefined} onOpen={open} />}
        {view === 'list' && items === null && !error && <p className="muted">불러오는 중…</p>}
        {view === 'list' && items?.length === 0 && <p className="muted">글 없음. 새 사이트는 추가 직후, 나머지는 1시간마다 수집.</p>}
        {view === 'list' && items && items.length > 0 && (
          <ul className="news-list">
            {items.map((it) => (
              <li key={it.key} className={it.unread ? 'new' : ''}>
                <button className="news-main" onClick={() => open(it, it.links[0].url)}>
                  <span className="news-title">
                    {it.unread && <b className="news-dot">N</b>}
                    {it.title}
                  </span>
                  <span className="news-meta">
                    {tab === 'all' && <span>{catName.get(it.categoryId) ?? '미분류'}</span>}
                    {it.category && <span>{it.category}</span>}
                    {it.author && <span>{it.author}</span>}
                    {it.postedAt && <span>{day.format(new Date(it.postedAt))}</span>}
                    {it.startsAt && it.deadline && (
                      <span>
                        접수 {day.format(new Date(it.startsAt))}~{day.format(new Date(it.deadline))}
                      </span>
                    )}
                    {it.deadline && <span className="news-dday">{dday(it.deadline)}</span>}
                    {it.tags.map((t) => (
                      <span key={t} className="news-tag">
                        #{t}
                      </span>
                    ))}
                  </span>
                </button>
                <span className="news-links">
                  {it.links.map((l) => (
                    <a
                      key={l.id}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        open(it, l.url);
                      }}
                    >
                      {l.siteName} ↗
                    </a>
                  ))}
                  {it.links.length > 1 && <small className="muted">{it.links.length}곳 합침</small>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

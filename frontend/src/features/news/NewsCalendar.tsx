import { useEffect, useMemo, useState } from 'react';
import { api, NewsItem } from '../../shared/api';

export const DAY = 86_400_000;
const LANES = 4;
export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayIdx = (d: Date, base: Date) => Math.round((startOfDay(d).getTime() - base.getTime()) / DAY);
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** 태그(없으면 제목)로 색 고정 */
export function hue(key: string): number {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

interface Bar {
  item: NewsItem;
  start: Date;
  end: Date;
  /** 시작일 모름 → 마감일 하루짜리 */
  deadlineOnly: boolean;
}

interface Seg<B> {
  bar: B;
  col: number;
  span: number;
  lane: number;
  contL: boolean;
  contR: boolean;
}

/** 주(7일) 단위로 막대를 자르고 줄(lane) 배정. 긴 것 먼저 */
export function layoutWeek<B extends { start: Date; end: Date }>(bars: B[], weekStart: Date): { segs: Seg<B>[]; hidden: number[] } {
  const weekEnd = addDays(weekStart, 6);
  const inWeek = bars
    .filter((b) => b.end >= weekStart && b.start <= weekEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const lanes: number[][] = []; // lane → 점유된 col
  const segs: Seg<B>[] = [];
  const hidden = Array<number>(7).fill(0);
  for (const b of inWeek) {
    const s = Math.max(0, dayIdx(b.start, weekStart));
    const e = Math.min(6, dayIdx(b.end, weekStart));
    let lane = lanes.findIndex((used) => used.every((c) => c < s || c > e));
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
    }
    for (let c = s; c <= e; c++) lanes[lane].push(c);
    if (lane >= LANES) {
      for (let c = s; c <= e; c++) hidden[c]++;
      continue;
    }
    segs.push({ bar: b, col: s, span: e - s + 1, lane, contL: b.start < weekStart, contR: b.end > weekEnd });
  }
  return { segs, hidden };
}

export const md = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;

/** 구글 캘린더식 월 달력. 접수기간 = 막대 */
export function NewsCalendar(props: { categoryId?: string; tag?: string; onOpen: (it: NewsItem, url: string) => void }) {
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Date | null>(null);

  const gridStart = addDays(month, -month.getDay());
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const gridEnd = addDays(lastOfMonth, 6 - lastOfMonth.getDay());
  const weeks = Math.round((gridEnd.getTime() - gridStart.getTime()) / DAY + 1) / 7;

  useEffect(() => {
    setItems(null);
    api
      .newsCalendar({ from: gridStart, to: addDays(gridEnd, 1), categoryId: props.categoryId, tag: props.tag })
      .then(
        (r) => {
          setItems(r);
          setError('');
        },
        (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
      );
    // gridStart/gridEnd 는 month 에서 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, props.categoryId, props.tag]);

  const bars = useMemo<Bar[]>(
    () =>
      (items ?? [])
        .filter((i) => i.deadline)
        .map((i) => {
          const end = startOfDay(new Date(i.deadline!));
          const start = i.startsAt ? startOfDay(new Date(i.startsAt)) : end;
          return { item: i, start: start > end ? end : start, end, deadlineOnly: !i.startsAt };
        }),
    [items],
  );

  const today = startOfDay(new Date());
  const go = (n: number) => {
    setPicked(null);
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  };
  const dayList = picked ? bars.filter((b) => b.start <= picked && b.end >= picked) : [];
  const color = (b: Bar) => hue(b.item.tags[0] ?? b.item.links[0]?.siteName ?? b.item.title);

  return (
    <div className="ncal">
      <div className="ncal-head">
        <button className="ghost" onClick={() => go(-1)} aria-label="이전 달">
          ‹
        </button>
        <h2>
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </h2>
        <button className="ghost" onClick={() => go(1)} aria-label="다음 달">
          ›
        </button>
        <button
          className="ghost"
          onClick={() => {
            const n = new Date();
            setMonth(new Date(n.getFullYear(), n.getMonth(), 1));
            setPicked(today);
          }}
        >
          오늘
        </button>
        <small className="muted">막대 = 접수기간 · ◆ = 시작일 모름(마감일만)</small>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="ncal-grid" aria-busy={items === null}>
        <div className="ncal-dow">
          {WEEK.map((w, i) => (
            <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>
              {w}
            </span>
          ))}
        </div>
        {Array.from({ length: weeks }, (_, w) => {
          const ws = addDays(gridStart, w * 7);
          const { segs, hidden } = layoutWeek(bars, ws);
          return (
            <div key={w} className="ncal-week">
              {Array.from({ length: 7 }, (_, d) => {
                const day = addDays(ws, d);
                const cls = [
                  'ncal-day',
                  day.getMonth() !== month.getMonth() ? 'out' : '',
                  sameDay(day, today) ? 'today' : '',
                  picked && sameDay(day, picked) ? 'picked' : '',
                ].join(' ');
                return (
                  <button key={d} className={cls} style={{ gridColumn: d + 1 }} onClick={() => setPicked(day)} aria-label={`${md(day)} 공모전 보기`}>
                    <span className="ncal-num">{day.getDate()}</span>
                    {hidden[d] > 0 && <span className="ncal-more">+{hidden[d]}</span>}
                  </button>
                );
              })}
              {segs.map((s) => (
                <button
                  key={`${s.bar.item.key}-${w}`}
                  className={`ncal-bar${s.contL ? ' cl' : ''}${s.contR ? ' cr' : ''}${s.bar.deadlineOnly ? ' only' : ''}${s.bar.item.unread ? ' unread' : ''}`}
                  style={{ gridColumn: `${s.col + 1} / span ${s.span}`, gridRow: s.lane + 2, ['--h' as string]: color(s.bar) }}
                  title={`${s.bar.item.title}\n접수 ${s.bar.deadlineOnly ? '?' : md(s.bar.start)} ~ ${md(s.bar.end)}${s.bar.item.tags.length ? `\n${s.bar.item.tags.join(', ')}` : ''}`}
                  onClick={() => props.onOpen(s.bar.item, s.bar.item.links[0].url)}
                >
                  {s.bar.deadlineOnly && '◆ '}
                  {s.bar.item.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {items === null && !error && <p className="muted">불러오는 중…</p>}
      {items && bars.length === 0 && <p className="muted">이 달에 접수기간 있는 글 없음. 기간은 새 글부터 상세 페이지에서 채움.</p>}
      {picked && (
        <div className="ncal-daylist">
          <h3>
            {md(picked)} 접수 중 {dayList.length}건
          </h3>
          <ul>
            {dayList.map((b) => (
              <li key={b.item.key}>
                <span className="ncal-dot" style={{ ['--h' as string]: color(b) }} />
                <button className="link-like" onClick={() => props.onOpen(b.item, b.item.links[0].url)}>
                  {b.item.title}
                </button>
                <small className="muted">
                  {b.deadlineOnly ? '' : `${md(b.start)} ~ `}
                  {md(b.end)} 마감 · {b.item.links.map((l) => l.siteName).join(', ')}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

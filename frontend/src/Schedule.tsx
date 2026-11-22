import { useEffect, useState } from 'react';
import { api, CalendarEvent } from './api';

const RANGES = [1, 7, 14, 31];
const DAY = ['일', '월', '화', '수', '목', '금', '토'];

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${m}월 ${d}일 (${DAY[new Date(y, m - 1, d).getDay()]})`;
}

export function Schedule(props: { onBack: () => void }) {
  const [days, setDays] = useState(7);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setEvents(null);
    setError('');
    api.events(days).then(
      (e) => live && setEvents(e),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [days]);

  const groups = new Map<string, CalendarEvent[]>();
  for (const e of events ?? []) {
    const k = e.start.slice(0, 10);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>내 일정</h1>
      </header>
      <div className="subbody">
        <div className="chips">
          {RANGES.map((r) => (
            <button key={r} className={r === days ? 'chip on' : 'chip'} onClick={() => setDays(r)}>
              {r === 1 ? '24시간' : `${r}일`}
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        {!error && events === null && <p className="muted">불러오는 중…</p>}
        {events?.length === 0 && <p className="muted">일정 없음.</p>}
        {[...groups].map(([ymd, list]) => (
          <section key={ymd} className="card">
            <h2>{dayLabel(ymd)}</h2>
            {list.map((e) => (
              <div key={e.id} className="row">
                <time>{e.isAllDay ? '종일' : `${e.start.slice(11, 16)}–${e.end.slice(11, 16)}`}</time>
                <div>
                  <strong>{e.subject}</strong>
                  {e.location && <small>📍 {e.location}</small>}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

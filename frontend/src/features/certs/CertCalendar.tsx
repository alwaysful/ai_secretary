import { useEffect, useMemo, useState } from 'react';
import { addDays, DAY, hue, layoutWeek, md, sameDay, startOfDay, WEEK } from '../../shared/calendar';
import { CertExam, CertFilter, certApi } from './certApi';

type Ev = CertExam & { certs: string[] };
type Kind = 'reg' | 'exam' | 'result';

interface Bar {
  key: string;
  ev: Ev;
  kind: Kind;
  start: Date;
  end: Date;
}

const ICON: Record<Kind, string> = { reg: '📝', exam: '✏️', result: '📢' };
const LABEL: Record<Kind, string> = { reg: '접수', exam: '시험', result: '발표' };

/** 회차 → 접수·시험·발표 막대 */
function toBars(ev: Ev): Bar[] {
  const out: Bar[] = [];
  const add = (kind: Kind, a: string | null, b: string | null) => {
    if (!a && !b) return;
    const s = startOfDay(new Date(a ?? b!));
    const e = startOfDay(new Date(b ?? a!));
    out.push({ key: `${ev.id}-${kind}`, ev, kind, start: s > e ? e : s, end: e < s ? s : e });
  };
  add('reg', ev.regStart, ev.regEnd);
  add('exam', ev.examStart, ev.examEnd);
  add('result', ev.resultAt, null);
  return out;
}

const name = (b: Bar) => `${ICON[b.kind]} ${b.ev.phase ? `${b.ev.phase} ` : ''}${LABEL[b.kind]} · ${b.ev.certs.length === 1 ? b.ev.certs[0] : b.ev.title}`;

/** 자격증 시험 달력: 접수·시험·발표 막대 */
export function CertCalendar(props: { filter: CertFilter }) {
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [evs, setEvs] = useState<Ev[] | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Date | null>(null);

  const gridStart = addDays(month, -month.getDay());
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const gridEnd = addDays(lastOfMonth, 6 - lastOfMonth.getDay());
  const weeks = Math.round((gridEnd.getTime() - gridStart.getTime()) / DAY + 1) / 7;
  const { field, kind, starred, q } = props.filter;

  useEffect(() => {
    setEvs(null);
    const t = setTimeout(() => {
      certApi.calendar(gridStart, addDays(gridEnd, 1), { field, kind, starred, q }).then(
        (r) => {
          setEvs(r);
          setError('');
        },
        (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
      );
    }, 200);
    return () => clearTimeout(t);
    // gridStart/gridEnd 는 month 에서 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, field, kind, starred, q]);

  const bars = useMemo(() => (evs ?? []).flatMap(toBars), [evs]);
  const today = startOfDay(new Date());
  const go = (n: number) => {
    setPicked(null);
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  };
  const dayList = picked ? bars.filter((b) => b.start <= picked && b.end >= picked) : [];
  const color = (b: Bar) => hue(b.ev.seriesLabel ?? b.ev.certs[0] ?? b.ev.title);

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
        <small className="muted">📝 접수 · ✏️ 시험 · 📢 발표</small>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="ncal-grid" aria-busy={evs === null}>
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
                  <button key={d} className={cls} style={{ gridColumn: d + 1 }} onClick={() => setPicked(day)} aria-label={`${md(day)} 시험 일정 보기`}>
                    <span className="ncal-num">{day.getDate()}</span>
                    {hidden[d] > 0 && <span className="ncal-more">+{hidden[d]}</span>}
                  </button>
                );
              })}
              {segs.map((s) => (
                <button
                  key={`${s.bar.key}-${w}`}
                  className={`ncal-bar${s.contL ? ' cl' : ''}${s.contR ? ' cr' : ''} cb-${s.bar.kind}`}
                  style={{ gridColumn: `${s.col + 1} / span ${s.span}`, gridRow: s.lane + 2, ['--h' as string]: color(s.bar) }}
                  title={`${s.bar.ev.title}\n${LABEL[s.bar.kind]} ${md(s.bar.start)}${sameDay(s.bar.start, s.bar.end) ? '' : ` ~ ${md(s.bar.end)}`}\n${s.bar.ev.certs.slice(0, 8).join(', ')}${s.bar.ev.certs.length > 8 ? ` 외 ${s.bar.ev.certs.length - 8}` : ''}`}
                  onClick={() => setPicked(s.bar.start < ws ? ws : s.bar.start)}
                >
                  {name(s.bar)}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {evs === null && !error && <p className="muted">불러오는 중…</p>}
      {evs && bars.length === 0 && <p className="muted">이 달 일정 없음. Q-net 키 등록 또는 자격증마다 ＋일정 직접 추가.</p>}
      {picked && (
        <div className="ncal-daylist">
          <h3>
            {md(picked)} 일정 {dayList.length}건
          </h3>
          <ul>
            {dayList.map((b) => (
              <li key={b.key}>
                <span className="ncal-dot" style={{ ['--h' as string]: color(b) }} />
                <span>{name(b)}</span>
                <small className="muted">
                  {md(b.start)}
                  {sameDay(b.start, b.end) ? '' : ` ~ ${md(b.end)}`} · {b.ev.title}
                  {b.ev.certs.length > 1 && ` · ${b.ev.certs.slice(0, 6).join(', ')}${b.ev.certs.length > 6 ? ` 외 ${b.ev.certs.length - 6}` : ''}`}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

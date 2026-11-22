import { useEffect, useState } from 'react';
import { studyApi, type StatsBucket } from '../api/study';
import { ErrorMessage } from '../ErrorMessage';
import { errorText } from '../format';

type Unit = 'day' | 'week';

const VIOLATIONS = [
  { key: 'posture', label: '자세', color: '#e8a33d' },
  { key: 'phone', label: '핸드폰', color: '#d9534f' },
  { key: 'slack', label: '딴짓', color: '#7d5fd3' },
  { key: 'sleep', label: '수면', color: '#3d8fe8' },
] as const;

const W = 560;
const H = 180;
const PAD = { l: 36, r: 8, t: 12, b: 26 };

function label(date: string, unit: Unit): string {
  const [, m, d] = date.split('-').map(Number);
  return unit === 'day' ? `${m}/${d}` : `${m}/${d}~`;
}

function minutes(sec: number): string {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
}

/** 단순 SVG 막대 그래프. stacks: 막대마다 [값, 색] 목록 (쌓기) */
function Bars(props: {
  title: string;
  labels: string[];
  stacks: { value: number; color: string; name: string }[][];
  format: (v: number) => string;
}) {
  const totals = props.stacks.map((s) => s.reduce((a, b) => a + b.value, 0));
  const max = Math.max(1, ...totals);
  const n = props.labels.length;
  const cw = (W - PAD.l - PAD.r) / n;
  const bw = Math.min(36, cw * 0.6);
  const ih = H - PAD.t - PAD.b;
  return (
    <figure className="stats-chart">
      <figcaption>{props.title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.title}>
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="axis" />
        <text x={PAD.l - 6} y={PAD.t + 4} textAnchor="end" className="tick">
          {props.format(max)}
        </text>
        {props.stacks.map((stack, i) => {
          const x = PAD.l + i * cw + (cw - bw) / 2;
          let y = H - PAD.b;
          return (
            <g key={props.labels[i]}>
              {stack.map((s) => {
                const h = (s.value / max) * ih;
                y -= h;
                return (
                  <rect key={s.name} x={x} y={y} width={bw} height={h} rx={3} fill={s.color}>
                    <title>{`${props.labels[i]} ${s.name}: ${props.format(s.value)}`}</title>
                  </rect>
                );
              })}
              {totals[i] > 0 && (
                <text x={x + bw / 2} y={y - 3} textAnchor="middle" className="val">
                  {props.format(totals[i])}
                </text>
              )}
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="tick">
                {props.labels[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** 공부 통계: 일·주별 집중 시간, 위반 횟수 */
export function StudyStats({ onBack }: { onBack: () => void }) {
  const [unit, setUnit] = useState<Unit>('day');
  const [data, setData] = useState<StatsBucket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    studyApi.stats(unit).then(
      (d) => alive && (setData(d), setError(null)),
      (e: unknown) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [unit]);

  const labels = data?.map((b) => label(b.date, unit)) ?? [];
  const totalFocus = data?.reduce((a, b) => a + b.focusSec, 0) ?? 0;
  const totalViol = data?.reduce((a, b) => a + b.posture + b.phone + b.slack + b.sleep, 0) ?? 0;
  const totalPomo = data?.reduce((a, b) => a + b.pomodoros, 0) ?? 0;

  return (
    <div className="stats">
      <div className="row">
        <h2>공부 통계</h2>
        <div className="stats-unit" role="tablist">
          {(
            [
              ['day', '일별 (7일)'],
              ['week', '주별 (8주)'],
            ] as const
          ).map(([u, text]) => (
            <button
              key={u}
              type="button"
              role="tab"
              aria-selected={unit === u}
              className={unit === u ? 'btn btn-primary' : 'btn'}
              onClick={() => setUnit(u)}
            >
              {text}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          돌아가기
        </button>
      </div>
      <ErrorMessage message={error} />
      {!data && !error && <p className="muted">불러오는 중</p>}
      {data && (
        <>
          <p className="muted">
            합계: 집중 {minutes(totalFocus)} · 🍅 {totalPomo}개 · 위반 {totalViol}회
          </p>
          <Bars
            title="집중 시간"
            labels={labels}
            stacks={data.map((b) => [{ value: b.focusSec, color: 'var(--accent)', name: '집중' }])}
            format={minutes}
          />
          <Bars
            title="위반 횟수"
            labels={labels}
            stacks={data.map((b) =>
              VIOLATIONS.map((v) => ({ value: b[v.key], color: v.color, name: v.label })),
            )}
            format={(v) => `${v}회`}
          />
          <ul className="stats-legend">
            {VIOLATIONS.map((v) => (
              <li key={v.key}>
                <i style={{ background: v.color }} />
                {v.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Deck, vocab, VocabStats } from './api';
import { errMsg } from './lib';

const MODES: { k: 'srs' | 'round' | 'quiz'; label: string; color: string }[] = [
  { k: 'srs', label: '복습', color: 'var(--accent)' },
  { k: 'round', label: '회독', color: '#3CC9A0' },
  { k: 'quiz', label: '퀴즈', color: '#E8A33D' },
];

function Bars(props: { labels: string[]; values: number[][]; colors: string[]; names: string[] }) {
  const W = 600;
  const H = 140;
  const b = 18;
  const tot = props.values.map((v) => v.reduce((a, x) => a + x, 0));
  const max = Math.max(1, ...tot);
  const n = props.labels.length;
  const cw = W / n;
  const bw = Math.max(3, Math.min(24, cw * 0.6));
  const every = n > 14 ? Math.ceil(n / 8) : 1;
  return (
    <svg className="vc-bars" viewBox={`0 0 ${W} ${H}`} role="img">
      {props.values.map((stack, i) => {
        let y = H - b;
        const x = i * cw + (cw - bw) / 2;
        return (
          <g key={i}>
            {stack.map((v, j) => {
              const h = (v / max) * (H - b - 14);
              y -= h;
              return (
                <rect key={j} x={x} y={y} width={bw} height={Math.max(0, h)} rx={3} fill={props.colors[j]}>
                  <title>{`${props.labels[i]} ${props.names[j]} ${v}`}</title>
                </rect>
              );
            })}
            {tot[i] > 0 && tot[i] === max && (
              <text x={x + bw / 2} y={y - 3} textAnchor="middle" className="val">
                {tot[i]}
              </text>
            )}
            {(i % every === 0 || (i === n - 1 && (n - 1) % every >= every / 2)) && (
              <text x={x + bw / 2} y={H - 4} textAnchor="middle" className="tick">
                {props.labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const pct = (v: number | null) => (v === null ? '–' : `${v}%`);

/** 단어장 진도·통계 */
export function DeckStats(props: { deck: Deck }) {
  const [s, setS] = useState<VocabStats | null>(null);
  const [days, setDays] = useState(30);
  const [err, setErr] = useState('');
  useEffect(() => {
    vocab.stats(props.deck.id, days).then(setS, (e: unknown) => setErr(errMsg(e)));
  }, [props.deck.id, days]);

  if (err) return <p className="error">{err}</p>;
  if (!s) return <p className="muted">불러오는 중…</p>;
  const sm = s.summary;
  const parts = [
    { label: '새 카드', v: sm.new, c: 'var(--muted)' },
    { label: '학습 중', v: sm.learning, c: '#E8A33D' },
    { label: '복습 (21일 미만)', v: s.young, c: '#829BFF' },
    { label: '완전 암기 (21일+)', v: s.mature, c: '#3CC9A0' },
  ];
  const fLabels = ['오늘', '내일', ...Array.from({ length: 6 }, (_, i) => `+${i + 2}일`)];

  return (
    <div className="vc-stats">
      <div className="vc-tiles">
        <div className="card">
          <small className="muted">전체</small>
          <b>{sm.total.toLocaleString('ko-KR')}</b>
        </div>
        <div className="card">
          <small className="muted">외움 (회독)</small>
          <b>
            {sm.total ? Math.round((sm.known / sm.total) * 100) : 0}%<small> {sm.known}</small>
          </b>
        </div>
        <div className="card">
          <small className="muted">현재 회독</small>
          <b>
            {s.round}회<small> {sm.roundSeen}/{sm.total}</small>
          </b>
        </div>
        <div className="card">
          <small className="muted">연속 학습</small>
          <b>{s.streak}일</b>
        </div>
        <div className="card">
          <small className="muted">오늘 남음</small>
          <b>{sm.today.new + sm.today.learn + sm.today.review}</b>
        </div>
        <div className="card">
          <small className="muted">★ / 틀린 카드</small>
          <b>
            {s.starred} / {s.wrong}
          </b>
        </div>
      </div>

      <section className="card">
        <h2>카드 상태</h2>
        <div className="vc-stack">
          {parts.map((p) => (
            <span key={p.label} style={{ flex: p.v || 0, background: p.c }} title={`${p.label} ${p.v}`} />
          ))}
        </div>
        <div className="vc-legend">
          {parts.map((p) => (
            <span key={p.label}>
              <i style={{ background: p.c }} /> {p.label} {p.v}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>
          학습량
          <span className="seg vc-days">
            {[7, 30, 90].map((d) => (
              <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
                {d}일
              </button>
            ))}
          </span>
        </h2>
        <Bars labels={s.dates} values={s.daily.map((d) => MODES.map((m) => d[m.k]))} colors={MODES.map((m) => m.color)} names={MODES.map((m) => m.label)} />
        <div className="vc-legend">
          {MODES.map((m) => (
            <span key={m.k}>
              <i style={{ background: m.color }} /> {m.label} {s.total[m.k]}회 · 정답률 {pct(s.accuracy[m.k])}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>앞으로 7일 복습 예정</h2>
        <Bars labels={fLabels} values={s.forecast.map((v) => [v])} colors={['#829BFF']} names={['복습']} />
      </section>

      <section className="card">
        <h2>자주 틀리는 단어</h2>
        {s.hardest.length === 0 ? (
          <p className="muted">아직 없음</p>
        ) : (
          <ol className="vc-hard">
            {s.hardest.map((h) => (
              <li key={h.id}>
                <b>{h.front}</b>
                {h.reading && <span className="muted"> {h.reading}</span>} — {h.back}
                <span className="muted">
                  {' '}
                  · 틀림 {h.wrongCount}
                  {h.lapses > 0 && ` · 잊음 ${h.lapses}`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

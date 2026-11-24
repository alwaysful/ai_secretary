import { useEffect, useState } from 'react';
import { Cert, CertStats, certApi } from './certApi';

const fmt = new Intl.NumberFormat('ko-KR');
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
type Item = NonNullable<Cert['detail']>[number];

/** 설명 항목 → 묶음. 목록에 없는 항목은 '개요'로 */
const GROUPS: { title: string; icon: string; labels: string[] }[] = [
  { title: '개요', icon: '📌', labels: ['무엇', '시행', '쓰임', '합격 후'] },
  { title: '응시', icon: '🪪', labels: ['응시자격'] },
  {
    title: '시험',
    icon: '📝',
    labels: ['시험 구성', '필기', '실기', '일정', '합격 기준', '합격률'],
  },
  { title: '준비', icon: '📚', labels: ['준비 도서', '공부법'] },
];

function group(detail: Item[]) {
  const known = new Set(GROUPS.flatMap((g) => g.labels));
  return GROUPS.map((g) => ({
    ...g,
    items: detail.filter((d) => d.label !== '링크' && (g.labels.includes(d.label) || (g.title === '개요' && !known.has(d.label)))),
  })).filter((g) => g.items.length);
}

/** 최근 5년 취득자 막대 */
function Bars({ years }: { years: { year: number; count: number }[] }) {
  const max = Math.max(1, ...years.map((y) => y.count));
  return (
    <div className="ca-bars" role="img" aria-label={years.map((y) => `${y.year}년 ${fmt.format(y.count)}명`).join(', ')}>
      {years.map((y, i) => (
        <div key={y.year} className={`ca-bar${i === years.length - 1 ? ' last' : ''}`}>
          <span className="ca-bar-n">{fmt.format(y.count)}</span>
          <span className="ca-bar-track">
            <span className="ca-bar-fill" style={{ height: `${Math.max(4, (y.count / max) * 100)}%` }} />
          </span>
          <span className="ca-bar-y">{y.year}</span>
        </div>
      ))}
    </div>
  );
}

/** 「설명」 펼침: 요약 칩 → 취득자 막대 → 묶음 카드 → 링크 버튼 */
export function CertAbout({ cert }: { cert: Cert }) {
  const [st, setSt] = useState<CertStats | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    certApi.stats(cert.id).then(setSt, (e: unknown) => setErr(errMsg(e)));
  }, [cert.id]);
  const s = st?.stats;
  const last = s?.years[s.years.length - 1];
  const detail = cert.detail ?? [];
  const passRate = detail.find((d) => d.label === '합격률')?.text;
  const links = detail.filter((d) => d.label === '링크').flatMap((d) => d.links ?? []);
  const chips: [string, string | null | undefined][] = [
    ['유용도', `${cert.score.toFixed(1)} / 10`],
    ['준비기간', cert.prep],
    ['응시료', cert.fee],
    ['유효기간', cert.validity],
    ['주관', cert.org],
  ];

  return (
    <div className="ca">
      <div className="ca-chips">
        {chips
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <span key={k} className="ca-chip">
              <small>{k}</small>
              <b>{v}</b>
            </span>
          ))}
      </div>

      <section className="ca-card ca-stats">
        <h4>📊 취득자</h4>
        {!st && !err && <p className="muted">불러오는 중…</p>}
        {err && <p className="muted">{err}</p>}
        {st && !s && <p className="muted">{st.note ?? '통계 없음'}</p>}
        {s && last && (
          <div className="ca-stats-body">
            <div className="ca-big">
              <div>
                <small>{last.year}년</small>
                <b>{fmt.format(last.count)}명</b>
              </div>
              <div>
                <small>누적</small>
                <b>{fmt.format(s.total)}명</b>
              </div>
              {passRate && (
                <div className="ca-rate">
                  <small>합격률</small>
                  <span>{passRate}</span>
                </div>
              )}
            </div>
            <Bars years={s.years} />
          </div>
        )}
        {st?.note && s && <small className="muted">{st.note}</small>}
      </section>

      {detail.length === 0 && <p className="muted">아직 설명 없음. 공식 사이트 참고.</p>}
      <div className="ca-grid">
        {group(detail).map((g) => (
          <section key={g.title} className="ca-card">
            <h4>
              {g.icon} {g.title}
            </h4>
            {g.items.map((d) => (
              <div key={d.label} className="ca-item">
                <span className="ca-label">{d.label}</span>
                <p>{d.text}</p>
                {d.items && (
                  <ul>
                    {d.items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>

      {links.length > 0 && (
        <div className="ca-links">
          <span className="ca-label">🔗 링크</span>
          {links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="ca-link">
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

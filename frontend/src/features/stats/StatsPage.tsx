import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { api, ApiUsageStats, Ranked, StatsOverview } from '../../shared/api';
import { BudgetCard, KeysCard } from './BudgetCard';
import './stats.css';

const PROVIDERS: { id: string; label: string; color: string }[] = [
  { id: 'gemini', label: 'Gemini', color: '#4F9DFF' },
  { id: 'anthropic', label: 'Anthropic', color: '#E8956A' },
  { id: 'openai', label: 'OpenAI', color: '#3CC9A0' },
];
const FEATURE_LABEL: Record<string, string> = { chat: '채팅', ocr: 'OCR', stt: 'STT' };
const VIOL: { key: keyof StatsOverview['study']['violations']; label: string; color: string }[] = [
  { key: 'posture', label: '자세', color: '#E8A33D' },
  { key: 'phone', label: '핸드폰', color: '#E5687A' },
  { key: 'slack', label: '딴짓', color: '#A78BFA' },
  { key: 'sleep', label: '수면', color: '#4F9DFF' },
];

function dur(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}`;
}
const num = (n: number) => n.toLocaleString('ko-KR');
function tok(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
const usd = (n: number) => `$${n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;
/** 넓은 카드 그래프 폭: 좁은 화면이면 작게 (글자 크기 유지) */
const wideW = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 380 : 900);

const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;

/** 쌓기 막대 그래프 (SVG) */
function Bars(props: { labels: string[]; stacks: { v: number; color: string; name: string }[][]; fmt: (v: number) => string; height?: number; every?: number; width?: number }) {
  const W = props.width ?? 380;
  const H = props.height ?? 150;
  const pad = { l: 4, r: 4, t: 16, b: 20 };
  const totals = props.stacks.map((s) => s.reduce((a, b) => a + b.v, 0));
  const max = Math.max(...totals, 0) || 1;
  const n = props.labels.length;
  const cw = (W - pad.l - pad.r) / n;
  const bw = Math.max(3, Math.min(28, cw * 0.62));
  const ih = H - pad.t - pad.b;
  const every = props.every ?? 1;
  const peak = totals.indexOf(Math.max(...totals));
  return (
    <svg className="st-bars" viewBox={`0 0 ${W} ${H}`} role="img">
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="axis" />
      {props.stacks.map((stack, i) => {
        const x = pad.l + i * cw + (cw - bw) / 2;
        let y = H - pad.b;
        return (
          <g key={i}>
            {stack.map((s) => {
              const h = (s.v / max) * ih;
              y -= h;
              return (
                <rect key={s.name} x={x} y={y} width={bw} height={Math.max(0, h)} rx={Math.min(4, bw / 3)} fill={s.color}>
                  <title>{`${props.labels[i]} ${s.name}: ${props.fmt(s.v)}`}</title>
                </rect>
              );
            })}
            {i === peak && totals[i] > 0 && (
              <text x={x + bw / 2} y={y - 4} textAnchor="middle" className="val">
                {props.fmt(totals[i])}
              </text>
            )}
            {(i % every === 0 || i === n - 1) && (
              <text x={x + bw / 2} y={H - 5} textAnchor="middle" className="tick">
                {props.labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** 가로 막대 순위 */
function RankList(props: { items: Ranked; unit?: string; color?: string; empty: string }) {
  const max = Math.max(1, ...props.items.map((i) => i.count));
  if (!props.items.length) return <p className="muted small">{props.empty}</p>;
  return (
    <ul className="st-rank">
      {props.items.map((it) => (
        <li key={it.name}>
          <span className="nm" title={it.name}>
            {it.name}
          </span>
          <span className="track">
            <i style={{ width: `${(it.count / max) * 100}%`, background: props.color }} />
          </span>
          <b>
            {num(it.count)}
            {props.unit}
          </b>
        </li>
      ))}
    </ul>
  );
}

function Kpi(props: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="card st-kpi">
      <small>{props.label}</small>
      <strong style={props.tone ? { color: props.tone } : undefined}>{props.value}</strong>
      {props.sub && <span className="muted small">{props.sub}</span>}
    </div>
  );
}

function StudyCard({ s, dates }: { s: StatsOverview['study']; dates: string[] }) {
  const totalViol = VIOL.reduce((a, v) => a + s.violations[v.key], 0) + s.phoneApps;
  return (
    <section className="card st-card st-wide">
      <header>
        <h2>📚 공부 집중</h2>
        <span className="muted small">
          {s.sessions}회 · 공부한 날 {s.studiedDays}/{dates.length}일
        </span>
      </header>
      <div className="st-mini">
        <div>
          <small>총 집중</small>
          <b>{dur(s.focusSec)}</b>
        </div>
        <div>
          <small>하루 평균</small>
          <b>{dur(s.avgPerDaySec)}</b>
        </div>
        <div>
          <small>최장 세션</small>
          <b>{dur(s.longestSec)}</b>
        </div>
        <div>
          <small>🍅 뽀모도로</small>
          <b>{s.pomodoros}개</b>
        </div>
      </div>
      <Bars width={wideW()} labels={dates.map(md)} every={dates.length > 10 ? 5 : 1} stacks={s.daily.map((v) => [{ v, color: 'var(--accent)', name: '집중' }])} fmt={dur} />
      <div className="st-split">
        <div>
          <h3>방해 요인 {totalViol}회</h3>
          <div className="st-stack">
            {totalViol > 0 &&
              [...VIOL.map((v) => ({ n: s.violations[v.key], c: v.color, l: v.label })), { n: s.phoneApps, c: '#3CC9A0', l: '폰 앱' }].map(
                (v) => v.n > 0 && <i key={v.l} style={{ flex: v.n, background: v.c }} title={`${v.l} ${v.n}회`} />,
              )}
          </div>
          <ul className="st-legend">
            {VIOL.map((v) => (
              <li key={v.key}>
                <i style={{ background: v.color }} />
                {v.label} {s.violations[v.key]}
              </li>
            ))}
            <li>
              <i style={{ background: '#3CC9A0' }} />폰 앱 {s.phoneApps}
            </li>
          </ul>
        </div>
        <div>
          <h3>딴짓 앱 TOP</h3>
          <RankList items={s.topApps} unit="회" color="#E5687A" empty="기록 없음 (폰 감시 앱 연결 시 집계)" />
        </div>
      </div>
    </section>
  );
}

function ChatCard({ c, dates }: { c: StatsOverview['chat']; dates: string[] }) {
  const hmax = Math.max(1, ...c.hours);
  return (
    <section className="card st-card">
      <header>
        <h2>💬 AI 채팅</h2>
        <span className="muted small">전체 대화 {num(c.conversationsAll)}개</span>
      </header>
      <div className="st-mini">
        <div>
          <small>보낸 메시지</small>
          <b>{num(c.userMessages)}</b>
        </div>
        <div>
          <small>새 대화</small>
          <b>{num(c.conversations)}</b>
        </div>
        <div>
          <small>평균 응답</small>
          <b>{c.avgReplyMs ? `${(c.avgReplyMs / 1000).toFixed(1)}초` : '-'}</b>
        </div>
        <div>
          <small>로컬 토큰</small>
          <b>{tok(c.tokens)}</b>
        </div>
      </div>
      <Bars labels={dates.map(md)} every={dates.length > 10 ? 5 : 1} stacks={c.daily.map((v) => [{ v, color: 'var(--accent2)', name: '메시지' }])} fmt={(v) => `${v}개`} height={120} />
      <h3>시간대별</h3>
      <div className="st-hours">
        {c.hours.map((h, i) => (
          <i key={i} style={{ opacity: h ? 0.18 + (h / hmax) * 0.82 : 0.06 }} title={`${i}시: ${h}개`} />
        ))}
      </div>
      <div className="st-hours-lbl muted small">
        <span>0시</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      <h3>사용 모델</h3>
      <RankList items={c.models} unit="회" empty="응답 없음" />
    </section>
  );
}

function NewsCard({ n, dates }: { n: StatsOverview['news']; dates: string[] }) {
  return (
    <section className="card st-card">
      <header>
        <h2>📰 공지·공모전</h2>
        <span className="muted small">안 읽음 {num(n.unread)}</span>
      </header>
      <div className="st-mini">
        <div>
          <small>새 글</small>
          <b>{num(n.newPosts)}</b>
        </div>
        <div>
          <small>안 읽음</small>
          <b>{num(n.unread)}</b>
        </div>
        <div>
          <small>2주 내 마감</small>
          <b>{n.deadlines.length}</b>
        </div>
      </div>
      <Bars labels={dates.map(md)} every={dates.length > 10 ? 5 : 1} stacks={n.daily.map((v) => [{ v, color: '#E8A33D', name: '새 글' }])} fmt={(v) => `${v}개`} height={110} />
      <h3>사이트별</h3>
      <RankList items={n.bySite} unit="개" color="#E8A33D" empty="새 글 없음" />
      <h3>다가오는 마감</h3>
      {n.deadlines.length ? (
        <ul className="st-dl">
          {n.deadlines.map((d) => {
            const left = Math.ceil((Date.parse(d.deadline) - Date.now()) / 86_400_000);
            return (
              <li key={d.id}>
                <span className={left <= 3 ? 'dday hot' : 'dday'}>D-{Math.max(0, left)}</span>
                <a href={d.url} target="_blank" rel="noreferrer">
                  {d.title}
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">없음</p>
      )}
    </section>
  );
}

function PriceRow(props: { m: ApiUsageStats['models'][number]; onSaved: () => void }) {
  const { m } = props;
  const [edit, setEdit] = useState(false);
  const [inp, setInp] = useState(String(m.price.input));
  const [out, setOut] = useState(String(m.price.output));
  const [err, setErr] = useState('');
  const color = PROVIDERS.find((p) => p.id === m.provider)?.color;
  const save = async () => {
    const a = Number(inp);
    const b = Number(out);
    if (!(a >= 0) || !(b >= 0)) return setErr('숫자');
    try {
      await api.setApiPrice(m.model, a, b);
      setEdit(false);
      props.onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '실패');
    }
  };
  const reset = async () => {
    await api.resetApiPrice(m.model).catch(() => undefined);
    setEdit(false);
    props.onSaved();
  };
  return (
    <tr>
      <td>
        <i className="dot" style={{ background: color }} />
        <span className="mono">{m.model}</span>
      </td>
      <td className="r">{num(m.calls)}</td>
      <td className="r">
        {tok(m.inputTokens)} / {tok(m.outputTokens)}
        {m.audioSec > 0 && <small className="muted"> · {dur(m.audioSec)}</small>}
      </td>
      <td className="r">
        {edit ? (
          <span className="st-price-edit">
            <input value={inp} onChange={(e) => setInp(e.target.value)} inputMode="decimal" aria-label="입력 단가" />
            <input value={out} onChange={(e) => setOut(e.target.value)} inputMode="decimal" aria-label="출력 단가" />
            <button className="ghost" onClick={save}>
              저장
            </button>
            {m.custom && (
              <button className="ghost" onClick={reset}>
                기본값
              </button>
            )}
            {err && <small className="err">{err}</small>}
          </span>
        ) : (
          <button className="link-btn" onClick={() => setEdit(true)} title="단가 수정 (USD / 100만 토큰)">
            ${m.price.input} / ${m.price.output}
            {m.custom ? ' ✎' : ''}
          </button>
        )}
      </td>
      <td className="r">
        <b>{usd(m.cost)}</b>
      </td>
    </tr>
  );
}

function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ApiCard() {
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [data, setData] = useState<ApiUsageStats | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    api.statsApi(month).then(
      (d) => (setData(d), setErr('')),
      (e: unknown) => setErr(e instanceof Error ? e.message : '불러오기 실패'),
    );
  }, [month]);
  useEffect(load, [load]);

  const [cy, cm] = (data?.month ?? '').split('-');
  const isCurrent = data && !month;
  const days = data?.daily.length ?? 0;
  return (
    <section className="card st-card st-wide" id="api-usage">
      <header>
        <h2>🔑 API 사용량·비용</h2>
        <span className="st-month">
          <button className="ghost" onClick={() => data && setMonth(shiftMonth(data.month, -1))} aria-label="이전 달">
            ‹
          </button>
          <b>{data ? `${cy}년 ${Number(cm)}월` : '…'}</b>
          <button className="ghost" disabled={!month} onClick={() => data && setMonth(shiftMonth(data.month, 1) <= new Date().toISOString().slice(0, 7) ? shiftMonth(data.month, 1) : undefined)} aria-label="다음 달">
            ›
          </button>
        </span>
      </header>
      {err && <p className="err small">{err}</p>}
      {data && (
        <>
          <div className="st-cost-head">
            <div>
              <small>{isCurrent ? '이번 달 추정 비용' : '추정 비용'}</small>
              <strong>{usd(data.total.cost)}</strong>
              <span className="muted small">
                ≈ ₩{num(Math.round(data.total.cost * 1400))} · {num(data.total.calls)}회 호출
              </span>
            </div>
            {isCurrent && (
              <div>
                <small>월말 예상</small>
                <b>{usd(data.projected)}</b>
              </div>
            )}
            <div>
              <small>지난달</small>
              <b>{usd(data.prevCost)}</b>
            </div>
            <div>
              <small>토큰 입력 / 출력</small>
              <b>
                {tok(data.total.inputTokens)} / {tok(data.total.outputTokens)}
              </b>
            </div>
          </div>
          <div className="st-prov">
            {PROVIDERS.map((p) => {
              const a = data.providers.find((x) => x.provider === p.id);
              const share = data.total.cost > 0 && a ? (a.cost / data.total.cost) * 100 : 0;
              return (
                <div key={p.id} className="st-prov-card" style={{ '--pc': p.color } as CSSProperties}>
                  <div className="row">
                    <i className="dot" />
                    <b>{p.label}</b>
                    <span className="muted small">{share ? `${share.toFixed(0)}%` : ''}</span>
                  </div>
                  <strong>{usd(a?.cost ?? 0)}</strong>
                  <span className="muted small">
                    {num(a?.calls ?? 0)}회 · 입력 {tok(a?.inputTokens ?? 0)} · 출력 {tok(a?.outputTokens ?? 0)}
                  </span>
                  <span className="pbar">
                    <i style={{ width: `${share}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
          <h3>일별 비용</h3>
          <Bars
            labels={Array.from({ length: days }, (_, i) => `${i + 1}`)}
            every={5}
            stacks={data.daily.map((d) => PROVIDERS.map((p) => ({ v: d[p.id] ?? 0, color: p.color, name: p.label })))}
            fmt={usd}
            width={wideW()}
            height={150}
          />
          {data.features.length > 0 && (
            <div className="st-chips">
              {data.features.map((f) => (
                <span key={f.feature} className="chip">
                  {FEATURE_LABEL[f.feature] ?? f.feature} · {num(f.calls)}회 · {usd(f.cost)}
                </span>
              ))}
            </div>
          )}
          <h3>모델별</h3>
          {data.models.length ? (
            <div className="st-table-wrap">
              <table className="st-table">
                <thead>
                  <tr>
                    <th>모델</th>
                    <th className="r">호출</th>
                    <th className="r">토큰 입력/출력</th>
                    <th className="r">단가 $/1M</th>
                    <th className="r">비용</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((m) => (
                    <PriceRow key={`${m.provider}:${m.model}:${m.price.input}:${m.price.output}`} m={m} onSaved={load} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted small">이 달 API 호출 없음. 설정 → 모델에서 채팅·OCR·STT를 API로 바꾸면 집계됨.</p>
          )}
          <p className="muted small">비용은 응답의 토큰 수 × 단가로 계산한 추정치. 실제 청구액은 각 콘솔에서 확인. 단가 클릭하면 수정.</p>
        </>
      )}
    </section>
  );
}

export function StatsPage(props: { onBack: () => void }) {
  const [days, setDays] = useState<7 | 30>(7);
  const [o, setO] = useState<StatsOverview | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    api.statsOverview(days).then(
      (d) => alive && (setO(d), setErr('')),
      (e: unknown) => alive && setErr(e instanceof Error ? e.message : '불러오기 실패'),
    );
    return () => {
      alive = false;
    };
  }, [days]);

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>통계</h1>
        <span style={{ flex: 1 }} />
        <div className="st-seg" role="tablist">
          {([7, 30] as const).map((d) => (
            <button key={d} role="tab" aria-selected={days === d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
              {d}일
            </button>
          ))}
        </div>
      </header>
      <div className="subbody st">
        {err && <p className="err">{err}</p>}
        {!o && !err && <p className="muted">불러오는 중</p>}
        {o && (
          <div className="st-kpis">
            <Kpi label={`집중 시간 (${days}일)`} value={dur(o.study.focusSec)} sub={`하루 평균 ${dur(o.study.avgPerDaySec)}`} />
            <Kpi label="연속 공부" value={`${o.study.streak}일`} sub={o.study.streak ? '끊지 마!' : '오늘 시작'} tone={o.study.streak >= 3 ? '#3CC9A0' : undefined} />
            <Kpi label="채팅 메시지" value={num(o.chat.userMessages)} sub={`새 대화 ${o.chat.conversations}개`} />
            <Kpi label="안 읽은 소식" value={num(o.news.unread)} sub={`2주 내 마감 ${o.news.deadlines.length}건`} />
            <Kpi
              label="일정"
              value={o.calendar.connected ? `오늘 ${o.calendar.today}` : '미연결'}
              sub={o.calendar.connected ? `7일간 ${o.calendar.week}건` : '메일 계정 연동 필요'}
            />
            <Kpi label="기억 · 바로가기" value={`${o.memory.enabled}/${o.memory.total}`} sub={`바로가기 ${o.shortcuts}개`} />
          </div>
        )}
        <ApiCard />
        <div className="st-grid st-api-tools">
          <BudgetCard />
          <div className="st-keys">
            <KeysCard />
          </div>
        </div>
        {o && (
          <div className="st-grid">
            <StudyCard s={o.study} dates={o.dates} />
            <ChatCard c={o.chat} dates={o.dates} />
            <NewsCard n={o.news} dates={o.dates} />
          </div>
        )}
      </div>
    </div>
  );
}

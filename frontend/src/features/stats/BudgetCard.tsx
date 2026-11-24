import { useCallback, useEffect, useState } from 'react';
import { api, BudgetStatus, Settings } from '../../shared/api';
import { ApiKeys } from '../settings/SettingsPage';

const usd = (n: number) => `$${n.toFixed(2)}`;
const LEVEL: Record<BudgetStatus['level'], { text: string; cls: string }> = {
  none: { text: '한도 없음', cls: '' },
  ok: { text: '정상', cls: 'ok' },
  warn: { text: '경고', cls: 'warn' },
  over: { text: '한도 초과', cls: 'over' },
};

/** 월 API 비용 한도·경고 */
export function BudgetCard(props: { refreshKey?: number }) {
  const [b, setB] = useState<BudgetStatus | null>(null);
  const [limit, setLimit] = useState('');
  const [warn, setWarn] = useState(80);
  const [block, setBlock] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = (s: BudgetStatus) => {
    setB(s);
    setLimit(s.limitUsd === null ? '' : String(s.limitUsd));
    setWarn(s.warnPct);
    setBlock(s.block);
  };
  const load = useCallback(() => {
    api.budget().then(apply, (e: unknown) => setMsg(e instanceof Error ? e.message : '불러오기 실패'));
  }, []);
  useEffect(load, [load, props.refreshKey]);

  const save = async () => {
    const n = limit.trim() === '' ? null : Number(limit);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return setMsg('한도는 0 이상 숫자');
    setBusy(true);
    try {
      apply(await api.setBudget({ limitUsd: n, warnPct: warn, block }));
      setMsg('저장됨');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const pct = b?.pct ?? 0;
  const lv = LEVEL[b?.level ?? 'none'];
  return (
    <section className="card st-card" id="api-budget">
      <header>
        <h2>💰 월 비용 한도</h2>
        {b && <span className={`st-lv ${lv.cls}`}>{lv.text}</span>}
      </header>
      {b && b.level !== 'none' && (
        <>
          <div className="st-budget-bar" aria-label={`한도 ${pct}% 사용`}>
            <i className={lv.cls} style={{ width: `${Math.min(100, pct)}%` }} />
            <span className="mark" style={{ left: `${b.warnPct}%` }} title={`경고 ${b.warnPct}%`} />
          </div>
          <p className="small">
            <b>{usd(b.costUsd)}</b> / {usd(b.limitUsd ?? 0)} · {pct}% 사용
          </p>
        </>
      )}
      {b?.level === 'warn' && <p className="st-alert warn">⚠ 경고 비율({b.warnPct}%) 넘음. 사용량 확인.</p>}
      {b?.level === 'over' && (
        <p className="st-alert over">⛔ 이번 달 한도 넘음. {b.block ? 'API 호출 차단 중 (로컬 모델은 사용 가능).' : '차단 꺼져 있어 계속 과금됨.'}</p>
      )}
      <div className="st-budget-form">
        <label className="field">
          <span>월 한도 (USD, 비우면 없음)</span>
          <input type="number" min={0} step={0.5} inputMode="decimal" placeholder="예: 10" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
        <label className="field">
          <span>경고 비율 {warn}%</span>
          <input type="range" min={10} max={100} step={5} value={warn} onChange={(e) => setWarn(Number(e.target.value))} />
        </label>
        <label className="switch-row">
          <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
          <span>한도 넘으면 API 호출 차단</span>
        </label>
        <button className="primary" disabled={busy} onClick={() => void save()}>
          저장
        </button>
      </div>
      {msg && <p className="muted small">{msg}</p>}
      <p className="muted small">추정 비용 기준 (토큰 × 단가). 실제 청구는 각 콘솔에서도 한도 설정 권장.</p>
    </section>
  );
}

/** 통계 화면 API 키 관리 (설정과 같은 기능) */
export function KeysCard() {
  const [s, setS] = useState<Settings | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.settings().then(setS, (e: unknown) => setErr(e instanceof Error ? e.message : '불러오기 실패'));
  }, []);
  if (err) return <p className="err small">{err}</p>;
  if (!s) return null;
  return <ApiKeys settings={s} onSaved={(n) => setS((p) => (p ? { ...p, apiKeys: n.apiKeys } : n))} />;
}

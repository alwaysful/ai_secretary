import { useEffect, useState } from 'react';
import { CertConfig, certApi } from './certApi';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const when = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Q-net 시험일정 API 키 입력·동기화. 자격증 탭과 설정 화면에서 공용 */
export function CertKeyBox(props: { onSynced?: () => void }) {
  const [cfg, setCfg] = useState<CertConfig | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    certApi.config().then(setCfg, (e: unknown) => setError(errMsg(e)));
  }, []);

  const run = async (fn: () => Promise<CertConfig>, after?: () => void) => {
    setBusy(true);
    setError('');
    try {
      setCfg(await fn());
      after?.();
    } catch (e) {
      setError(errMsg(e));
      certApi.config().then(setCfg, () => undefined);
    } finally {
      setBusy(false);
    }
  };

  const hasKey = !!cfg?.key || !!cfg?.envKey;

  return (
    <div className="cert-key">
      <p className="muted">
        시험 일정 자동 수집: 공공데이터포털{' '}
        <a href="https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=%EA%B5%AD%EA%B0%80%EC%9E%90%EA%B2%A9%20%EC%8B%9C%ED%97%98%EC%9D%BC%EC%A0%95" target="_blank" rel="noreferrer">
          한국산업인력공단_국가자격 시험일정 조회 ↗
        </a>{' '}
        활용신청 → 일반 인증키 붙여넣기. Q-net 국가기술(기사·기능사 등)·국가전문 회차 하루 1번 수집.
      </p>
      <div className="cert-key-row">
        <input
          type="password"
          placeholder={cfg?.key ? `등록됨 ${cfg.key}` : cfg?.envKey ? '.env QNET_API_KEY 사용 중' : '인증키 (Decoding 또는 Encoding)'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
        />
        <button disabled={busy || !key.trim()} onClick={() => void run(() => certApi.setKey(key.trim()).then(() => certApi.sync()), () => { setKey(''); props.onSynced?.(); })}>
          저장·수집
        </button>
        {cfg?.key && (
          <button className="ghost" disabled={busy} onClick={() => void run(() => certApi.setKey(null))}>
            키 삭제
          </button>
        )}
        <button className="ghost" disabled={busy || !hasKey} onClick={() => void run(() => certApi.sync(), props.onSynced)}>
          ↻ 지금 수집
        </button>
      </div>
      {cfg?.lastSyncAt && (
        <small className="muted">
          마지막 수집 {when.format(new Date(cfg.lastSyncAt))} · {cfg.lastError ? '실패' : `${cfg.lastCount}건`}
        </small>
      )}
      {(error || cfg?.lastError) && <p className="error">{error || cfg?.lastError}</p>}
    </div>
  );
}

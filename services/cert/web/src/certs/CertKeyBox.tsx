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
        공공데이터포털{' '}
        <a href="https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=%ED%95%9C%EA%B5%AD%EC%82%B0%EC%97%85%EC%9D%B8%EB%A0%A5%EA%B3%B5%EB%8B%A8" target="_blank" rel="noreferrer">
          한국산업인력공단·한국직업능력연구원 API ↗
        </a>{' '}
        활용신청 → 일반 인증키 붙여넣기. 자격증 서비스가 정해진 주기로만 수집해 DB에 저장 (일정 하루 1번, 새 자격증·공개문제·시험장소 주 1번, 취득자·합격률 매시간 조금씩, 민간자격 등록정보 30일). 화면은 저장된 값만 읽음.
      </p>
      <div className="cert-key-row">
        <input
          type="password"
          placeholder={cfg?.key ? `등록됨 ${cfg.key}` : cfg?.envKey ? '.env QNET_API_KEY 사용 중' : '인증키 (Decoding 또는 Encoding)'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
        />
        <button disabled={busy || !key.trim()} onClick={() => void run(() => certApi.setKey(key.trim()), () => { setKey(''); props.onSynced?.(); })}>
          저장
        </button>
        {cfg?.key && (
          <button className="ghost" disabled={busy} onClick={() => void run(() => certApi.setKey(null))}>
            키 삭제
          </button>
        )}
        <button className="ghost" disabled={busy || !hasKey} onClick={() => void run(() => certApi.sync(), props.onSynced)}>
          ↻ 일정 수집
        </button>
        <button className="ghost" disabled={busy || !hasKey} onClick={() => void run(() => certApi.discover(), props.onSynced)} title="Q-net 국가자격 종목 목록과 비교해 없는 것만 추가">
          🔎 새 자격증 확인
        </button>
        <button className="ghost" disabled={busy || !hasKey} onClick={() => void run(() => certApi.collect(), props.onSynced)} title="주기 기다리지 않고 전부 수집 (시간 걸림)">
          ⏬ 전부 수집
        </button>
      </div>
      {cfg?.jobs && hasKey && (
        <ul className="cert-jobs">
          {cfg.jobs.map((j) => (
            <li key={j.name} className={j.lastError ? 'error' : 'muted'}>
              {j.label}: {j.lastAt ? `${when.format(new Date(j.lastAt))} ${j.lastError ? `실패 (${j.lastError})` : `${j.lastCount}건`}` : '대기'}
              {j.nextAt && ` · 다음 ${when.format(new Date(j.nextAt))}`}
            </li>
          ))}
        </ul>
      )}
      {cfg && hasKey && (
        <small className="muted">
          API 호출 오늘 최대 {cfg.apiDayCount}/{cfg.apiDayLimit}(API별) · 이번 달 전체 {cfg.apiMonthCount}회.
        </small>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

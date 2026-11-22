import { ErrorCode, Health, StreamPhase } from './api';

export interface Diagnosis {
  level: 'ok' | 'info' | 'warn' | 'down';
  title: string;
  hint: string;
}

const OLLAMA_DOWN: Diagnosis = {
  level: 'down',
  title: 'Ollama 연결 안 됨',
  hint: 'Ollama 앱이 실행 중인지 확인. 터미널에서 `ollama serve` 실행 후 다시 시도. 주소는 backend/.env 의 OLLAMA_BASE_URL.',
};
const DB_DOWN: Diagnosis = {
  level: 'down',
  title: '데이터베이스(PostgreSQL) 연결 안 됨',
  hint: 'Docker Desktop 실행 후 backend 폴더에서 `docker compose up -d`. DATABASE_URL 확인.',
};
const BACKEND_DOWN: Diagnosis = {
  level: 'down',
  title: '백엔드 서버 연결 안 됨',
  hint: 'backend 폴더에서 `npm run start:dev` 실행 (또는 start-aura.bat). 포트 3000 사용 여부 확인.',
};
const notFound = (name: string): Diagnosis => ({
  level: 'down',
  title: `모델 ${name} 미설치`,
  hint: `터미널에서 \`ollama pull ${name}\` 실행.`,
});

/** 서버 상태 요약. null health = 백엔드 응답 없음. */
export function diagnoseHealth(h: Health | null): Diagnosis {
  if (!h) return BACKEND_DOWN;
  if (h.db !== 'ok') return DB_DOWN;
  if (!h.model.reachable) return OLLAMA_DOWN;
  if (h.model.installed === false) return notFound(h.model.name);
  if (h.model.state === 'loading') {
    return { level: 'info', title: `${h.model.name} 메모리에 올리는 중`, hint: '보통 10초~1분. 완료되면 바로 답변 가능.' };
  }
  if (h.model.loaded === false || h.model.state === 'unloaded') {
    return {
      level: 'info',
      title: `${h.model.name} 대기 중 (메모리 미적재)`,
      hint: '첫 응답은 모델을 메모리에 올리느라 느림. 일정 시간 미사용 시 자동으로 내려감.',
    };
  }
  if (h.model.state === 'error') return { level: 'warn', title: '모델 적재 실패', hint: 'Ollama 로그 확인 후 다시 시도.' };
  return { level: 'ok', title: `${h.model.name} 준비됨`, hint: '' };
}

/** 요청 오류 → 안내 */
export function diagnoseError(code: ErrorCode, message: string, model: string): Diagnosis {
  switch (code) {
    case 'BACKEND_DOWN':
      return BACKEND_DOWN;
    case 'DB_DOWN':
      return DB_DOWN;
    case 'OLLAMA_DOWN':
      return OLLAMA_DOWN;
    case 'MODEL_NOT_FOUND':
      return notFound(model);
    case 'MODEL_TIMEOUT':
      return {
        level: 'warn',
        title: '모델 응답 시간 초과',
        hint: 'PC 메모리 부족 또는 긴 대화일 수 있음. 다른 프로그램 종료 후 재생성. MODEL_TIMEOUT_MS 조정 가능.',
      };
    case 'MODEL_ERROR':
      return { level: 'warn', title: '모델 응답 오류', hint: message };
    case 'NOT_FOUND':
      return { level: 'warn', title: '대화를 찾을 수 없음', hint: '삭제된 대화일 수 있음. 새 대화로 시작.' };
    default:
      return { level: 'warn', title: '요청 실패', hint: message };
  }
}

export const PHASE_TEXT: Record<StreamPhase, string> = {
  tools: '메일·일정 확인 중…',
  queued: '앞선 응답이 끝나길 기다리는 중…',
  loading: '모델을 메모리에 올리는 중… 첫 응답은 30초~1분 걸릴 수 있음',
  generating: '생각 중…',
};

/** 백틱(`) 구간을 <code>로 */
function Hint(props: { text: string }) {
  return (
    <>
      {props.text.split(/(`[^`]+`)/).map((p, i) =>
        p.startsWith('`') && p.endsWith('`') ? <code key={i}>{p.slice(1, -1)}</code> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function NoticeBox(props: { d: Diagnosis; onRetry?: () => void; onClose?: () => void }) {
  const { d } = props;
  return (
    <div className={`notice ${d.level}`} role={d.level === 'down' || d.level === 'warn' ? 'alert' : 'status'}>
      <div className="notice-body">
        <strong>{d.title}</strong>
        {d.hint && (
          <p>
            <Hint text={d.hint} />
          </p>
        )}
      </div>
      {props.onRetry && (
        <button className="ghost" onClick={props.onRetry}>
          다시 시도
        </button>
      )}
      {props.onClose && (
        <button className="ghost" onClick={props.onClose} aria-label="닫기">
          ✕
        </button>
      )}
    </div>
  );
}

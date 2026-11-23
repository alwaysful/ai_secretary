import { useCallback, useEffect, useRef, useState } from 'react';
import { studyApi } from '../api/study';

const LIVE_MS = 30_000;
const POLL_MS = 10_000;

/**
 * PC 공부 세션 ↔ 폰 앱 연동.
 * busy 동안 heartbeat 전송 (폰이 감시 시작), 폰 딴짓 기록을 받아 toast 로 알린다.
 */
export function usePhoneWatch(busy: boolean) {
  const [toast, setToast] = useState<string | null>(null);
  const since = useRef('');

  useEffect(() => {
    if (!busy) return;
    since.current = new Date().toISOString();
    const beat = () => void studyApi.live(true).catch(() => undefined);
    beat();
    const liveId = setInterval(beat, LIVE_MS);
    const pollId = setInterval(() => {
      studyApi.phoneEvents(since.current).then((events) => {
        const last = events.at(-1);
        if (!last) return;
        since.current = last.at;
        setToast(`폰에서 ${last.label} 켬. 다 보임.`);
      }, () => undefined);
    }, POLL_MS);
    return () => {
      clearInterval(liveId);
      clearInterval(pollId);
      void studyApi.live(false).catch(() => undefined);
    };
  }, [busy]);

  const dismiss = useCallback(() => setToast(null), []);
  return { toast, dismiss };
}

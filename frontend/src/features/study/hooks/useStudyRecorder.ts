import { useCallback, useEffect, useRef, useState } from 'react';
import { studyApi, type StudySession } from '../api/study';
import { errorText } from '../format';

export type Violation = 'posture' | 'phone' | 'slack' | 'sleep';
const SAVE_MS = 60_000;

/** 감시 세션 기록: 집중 시간(휴식 제외)·위반 횟수를 1분마다, 종료 시 저장 */
export function useStudyRecorder(busy: boolean, resting: boolean, pomodoros: number) {
  const session = useRef<StudySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const restingRef = useRef(resting);
  restingRef.current = resting;
  const pomoRef = useRef(pomodoros);
  pomoRef.current = pomodoros;

  const save = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.endedAt = new Date().toISOString();
    s.pomodoros = pomoRef.current;
    studyApi.saveSession({ ...s, focusSec: Math.round(s.focusSec) }).then(
      () => setError(null),
      (e: unknown) => setError(`공부 기록 저장 실패: ${errorText(e)}`),
    );
  }, []);

  useEffect(() => {
    if (!busy) return;
    const now = new Date().toISOString();
    session.current = {
      id: crypto.randomUUID(),
      startedAt: now,
      endedAt: now,
      focusSec: 0,
      pomodoros: 0,
      posture: 0,
      phone: 0,
      slack: 0,
      sleep: 0,
    };
    let last = Date.now();
    const tick = setInterval(() => {
      const t = Date.now();
      if (session.current && !restingRef.current) session.current.focusSec += (t - last) / 1000;
      last = t;
    }, 1000);
    const periodic = setInterval(save, SAVE_MS);
    return () => {
      clearInterval(tick);
      clearInterval(periodic);
      save();
      session.current = null;
    };
  }, [busy, save]);

  const hit = useCallback((v: Violation) => {
    if (session.current) session.current[v] += 1;
  }, []);

  return { hit, error };
}

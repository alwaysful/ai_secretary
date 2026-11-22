import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyDesktop } from '../lib/notify';
import { isRobot } from '../lib/tone';

export const FOCUS_MIN = 25;
export const BREAK_MIN = 5;
const FOCUS_MS = FOCUS_MIN * 60_000;
const KEY = 'aura.study.pomodoro';

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

interface Rest {
  active: boolean;
  start: (minutes: number, quiet?: boolean) => void;
}

/**
 * 뽀모도로: 감시 중 25분 집중 → 자동 5분 휴식(분석 일시정지) → 다시 집중.
 * 수동 휴식 중에는 집중 타이머도 멈춘다.
 */
export function usePomodoro(busy: boolean, rest: Rest) {
  const [enabled, setEnabledState] = useState(loadEnabled);
  const [focusLeftMs, setFocusLeftMs] = useState(FOCUS_MS);
  const [count, setCount] = useState(0);
  const leftRef = useRef(FOCUS_MS);
  const autoBreak = useRef(false);
  const restRef = useRef(rest);
  restRef.current = rest;

  const resetFocus = useCallback(() => {
    leftRef.current = FOCUS_MS;
    setFocusLeftMs(FOCUS_MS);
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    resetFocus();
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
      /* 저장 실패 무시 */
    }
  }, [resetFocus]);

  // 감시 종료 시 초기화
  useEffect(() => {
    if (busy) return;
    resetFocus();
    setCount(0);
    autoBreak.current = false;
  }, [busy, resetFocus]);

  // 자동 휴식이 끝나면 새 집중 블록
  useEffect(() => {
    if (rest.active || !autoBreak.current) return;
    autoBreak.current = false;
    resetFocus();
    if (busy && enabled) {
      notifyDesktop('🍅 집중 시작', isRobot() ? `${FOCUS_MIN}분 집중을 시작합니다.` : `다시 ${FOCUS_MIN}분. 이번엔 진짜 집중.`);
    }
  }, [rest.active, busy, enabled, resetFocus]);

  // 집중 시간 감소 (휴식 중 정지)
  useEffect(() => {
    if (!busy || !enabled || rest.active) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      leftRef.current -= now - last;
      last = now;
      if (leftRef.current > 0) {
        setFocusLeftMs(leftRef.current);
        return;
      }
      leftRef.current = 0;
      setFocusLeftMs(0);
      setCount((n) => n + 1);
      autoBreak.current = true;
      restRef.current.start(BREAK_MIN, true);
      notifyDesktop(
        '🍅 휴식',
        isRobot() ? `${BREAK_MIN}분 휴식합니다.` : `${FOCUS_MIN}분 버텼네요. ${BREAK_MIN}분만 쉬세요.`,
      );
    }, 500);
    return () => clearInterval(id);
  }, [busy, enabled, rest.active]);

  return {
    enabled,
    setEnabled,
    /** 집중 블록 남은 시간 */
    focusLeftMs,
    focusTotalMs: FOCUS_MS,
    /** 완료한 집중 블록 수 */
    count,
    phase: rest.active ? ('break' as const) : ('focus' as const),
  };
}

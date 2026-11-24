/** Anki 방식 간격 반복 (SM-2 변형). 순수 함수. */

export type SrsState = 'new' | 'learning' | 'review' | 'relearning';
/** 1 다시 · 2 어려움 · 3 알맞음 · 4 쉬움 */
export type Grade = 1 | 2 | 3 | 4;

export interface SrsCard {
  state: string;
  due: Date;
  interval: number;
  ease: number;
  step: number;
}

/** 학습 단계 (분) */
export const LEARN_STEPS = [1, 10];
/** 다시 외우기 단계 (분) */
export const RELEARN_STEPS = [10];
export const GRAD_DAYS = 1;
export const EASY_DAYS = 4;
export const MIN_EASE = 1.3;
export const MAX_INTERVAL = 36500;

const MIN = 60_000;
const DAY = 86_400_000;

const clampDays = (d: number) => Math.min(MAX_INTERVAL, Math.max(1, Math.round(d)));

/** 답변 후 다음 상태 */
export function schedule(c: SrsCard, grade: Grade, now = new Date()): SrsCard {
  const t = now.getTime();
  const at = (ms: number) => new Date(t + ms);
  const state = c.state as SrsState;

  if (state === 'new' || state === 'learning') {
    const step = state === 'new' ? 0 : c.step;
    if (grade === 4) return { state: 'review', interval: EASY_DAYS, ease: c.ease, step: 0, due: at(EASY_DAYS * DAY) };
    if (grade === 1) return { state: 'learning', interval: 0, ease: c.ease, step: 0, due: at(LEARN_STEPS[0] * MIN) };
    if (grade === 2) {
      // 현재 단계와 다음 단계 사이
      const cur = LEARN_STEPS[step] ?? LEARN_STEPS[LEARN_STEPS.length - 1];
      const next = LEARN_STEPS[step + 1] ?? cur * 1.5;
      return { state: 'learning', interval: 0, ease: c.ease, step, due: at(((cur + next) / 2) * MIN) };
    }
    const nextStep = step + 1;
    if (nextStep >= LEARN_STEPS.length) return { state: 'review', interval: GRAD_DAYS, ease: c.ease, step: 0, due: at(GRAD_DAYS * DAY) };
    return { state: 'learning', interval: 0, ease: c.ease, step: nextStep, due: at(LEARN_STEPS[nextStep] * MIN) };
  }

  if (state === 'relearning') {
    if (grade === 1) return { state: 'relearning', interval: c.interval, ease: c.ease, step: 0, due: at(RELEARN_STEPS[0] * MIN) };
    const nextStep = c.step + 1;
    if (grade === 3 && nextStep < RELEARN_STEPS.length) return { state: 'relearning', interval: c.interval, ease: c.ease, step: nextStep, due: at(RELEARN_STEPS[nextStep] * MIN) };
    const iv = clampDays(grade === 4 ? c.interval + 1 : c.interval);
    return { state: 'review', interval: iv, ease: c.ease, step: 0, due: at(iv * DAY) };
  }

  // review
  const iv = Math.max(1, c.interval);
  if (grade === 1) {
    const lapsed = clampDays(iv * 0.5);
    return { state: 'relearning', interval: lapsed, ease: Math.max(MIN_EASE, c.ease - 0.2), step: 0, due: at(RELEARN_STEPS[0] * MIN) };
  }
  let ease = c.ease;
  let next: number;
  if (grade === 2) {
    ease = Math.max(MIN_EASE, ease - 0.15);
    next = Math.max(iv + 1, iv * 1.2);
  } else if (grade === 3) {
    next = Math.max(iv + 1, iv * ease);
  } else {
    ease = ease + 0.15;
    next = Math.max(iv + 2, iv * c.ease * 1.3);
  }
  const days = clampDays(next);
  return { state: 'review', interval: days, ease: Math.round(ease * 100) / 100, step: 0, due: at(days * DAY) };
}

/** 버튼에 표시할 다음 간격 (ms). 1~4 순서 */
export function preview(c: SrsCard, now = new Date()): number[] {
  return ([1, 2, 3, 4] as Grade[]).map((g) => schedule(c, g, now).due.getTime() - now.getTime());
}

/** 하루 시작: 로컬 새벽 4시 (Anki 기본) */
export function dayStart(now = new Date()): Date {
  const d = new Date(now);
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  d.setHours(4, 0, 0, 0);
  return d;
}

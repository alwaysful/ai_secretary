/** 월 달력 공용 도구 (뉴스·자격증 공용, 기능 모듈 간 직접 의존 방지) */
export const DAY = 86_400_000;
export const LANES = 4;
export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const dayIdx = (d: Date, base: Date) => Math.round((startOfDay(d).getTime() - base.getTime()) / DAY);
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** 태그(없으면 제목)로 색 고정 */
export function hue(key: string): number {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export interface Seg<B> {
  bar: B;
  col: number;
  span: number;
  lane: number;
  contL: boolean;
  contR: boolean;
}

/** 주(7일) 단위로 막대를 자르고 줄(lane) 배정. 긴 것 먼저 */
export function layoutWeek<B extends { start: Date; end: Date }>(bars: B[], weekStart: Date): { segs: Seg<B>[]; hidden: number[] } {
  const weekEnd = addDays(weekStart, 6);
  const inWeek = bars
    .filter((b) => b.end >= weekStart && b.start <= weekEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const lanes: number[][] = []; // lane → 점유된 col
  const segs: Seg<B>[] = [];
  const hidden = Array<number>(7).fill(0);
  for (const b of inWeek) {
    const s = Math.max(0, dayIdx(b.start, weekStart));
    const e = Math.min(6, dayIdx(b.end, weekStart));
    let lane = lanes.findIndex((used) => used.every((c) => c < s || c > e));
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
    }
    for (let c = s; c <= e; c++) lanes[lane].push(c);
    if (lane >= LANES) {
      for (let c = s; c <= e; c++) hidden[c]++;
      continue;
    }
    segs.push({ bar: b, col: s, span: e - s + 1, lane, contL: b.start < weekStart, contR: b.end > weekEnd });
  }
  return { segs, hidden };
}

export const md = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;

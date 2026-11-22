/** 시간대 계산 도우미 (외부 라이브러리 없이 Intl 사용) */

export interface LocalDay {
  y: number;
  m: number;
  d: number;
}

export interface LocalNow extends LocalDay {
  hour: number;
  minute: number;
  /** 0=일 ... 6=토 */
  dow: number;
}

export function localParts(d: Date, tz: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(d)
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, Number(x.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
}

export function localNow(d: Date, tz: string): LocalNow {
  const p = localParts(d, tz);
  return { y: p.year, m: p.month, d: p.day, hour: p.hour, minute: p.minute, dow: dowOf({ y: p.year, m: p.month, d: p.day }) };
}

/** tz 기준 y-m-d 00:00 의 UTC 시각 */
export function startOfLocalDay(y: number, m: number, d: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d);
  const p = localParts(new Date(guess), tz);
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
  return new Date(guess - offset);
}

export function addDays(day: LocalDay, n: number): LocalDay {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function dowOf(day: LocalDay): number {
  return new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** 로컬 시각 문자열 `YYYY-MM-DDTHH:mm:00`. minutes는 day 00:00 기준 (24h 초과 시 다음 날) */
export function localIso(day: LocalDay, minutes: number): string {
  const d = addDays(day, Math.floor(minutes / 1440));
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${d.y}-${p2(d.m)}-${p2(d.d)}T${p2(Math.floor(m / 60))}:${p2(m % 60)}:00`;
}

/** `YYYY-MM-DDTHH:mm` → { day, minutes } */
export function parseLocalIso(s: string): { day: LocalDay; minutes: number } {
  const [y, m, d, hh, mm] = s.match(/\d+/g)!.map(Number);
  return { day: { y, m, d }, minutes: (hh ?? 0) * 60 + (mm ?? 0) };
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** `2026-11-24T15:00:00` → `11/24(화) 15:00` */
export function shortLabel(iso: string, withTime = true): string {
  const { day, minutes } = parseLocalIso(iso);
  const date = `${day.m}/${day.d}(${WEEKDAY[dowOf(day)]})`;
  return withTime ? `${date} ${p2(Math.floor(minutes / 60))}:${p2(minutes % 60)}` : date;
}

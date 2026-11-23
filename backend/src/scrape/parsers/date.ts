import { localParts, startOfLocalDay } from '../../calendar/tz';

const DAY = 86_400_000;

/** "2026-11-20", "2026.11.20", "2026/11/20", "26.11.20" → 현지 자정. 없으면 undefined */
export function parseDate(text: string, tz: string): Date | undefined {
  const m = /(\d{4}|\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(text);
  if (!m) return undefined;
  const y = m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return undefined;
  return startOfLocalDay(y, mo, d, tz);
}

const DATE = String.raw`(\d{4}|\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})`;

/** "접수기간 2026-11-17 ~ 2026-11-30" → 시작·마감 (마감은 그날 23:59:59.999) */
export function parsePeriod(text: string, tz: string, label = '(?:접수|모집|신청|응모)\\s*기간'): { startsAt?: Date; deadline?: Date } {
  const re = new RegExp(`${label}[^0-9]{0,20}(${DATE}[^~\\-–]{0,20})\\s*[~\\-–]\\s*(${DATE})`);
  const m = re.exec(text);
  if (!m) return {};
  const start = parseDate(m[1], tz);
  const end = parseDate(m[5], tz);
  return { startsAt: start, deadline: end ? new Date(end.getTime() + DAY - 1) : undefined };
}

/** "D-8" → 오늘+8일, "D-day"/"오늘마감" → 오늘. 마감·없음 → undefined */
export function parseDday(text: string, now: Date, tz: string): Date | undefined {
  const t = localParts(now, tz);
  const today = startOfLocalDay(t.year, t.month, t.day, tz);
  if (/d-?day|오늘\s*마감/i.test(text)) return today;
  const m = /D-(\d{1,3})\b/i.exec(text);
  return m ? new Date(today.getTime() + Number(m[1]) * DAY) : undefined;
}

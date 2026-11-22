import { addDays, LocalDay, LocalNow, localIso } from './tz';

/** 일정 생성·수정 명령 파서 (규칙 기반, 모델 호출 없음) */

export const CREATE_VERB = /(잡아|등록|추가해|추가|만들어|넣어|예약|생성)/;
export const UPDATE_VERB = /(옮겨|변경|바꿔|수정|미뤄|늦춰|연기|당겨)/;

export interface EventDraft {
  subject: string;
  /** 로컬 시각 `YYYY-MM-DDTHH:mm:ss` */
  start: string;
  end: string;
  isAllDay: boolean;
  location: string;
}

export interface UpdateMatch {
  from: LocalDay;
  days: number;
  subject: string;
  /** 분 단위 시각 (00:00 기준) */
  time?: number;
}

export interface UpdateChange {
  day?: LocalDay;
  time?: number;
  shiftMin?: number;
  durationMin?: number;
}

export type EventCommand =
  | { kind: 'create'; draft: EventDraft }
  | { kind: 'update'; match: UpdateMatch; change: UpdateChange }
  | { kind: 'unclear'; reason: string };

interface Token {
  start: number;
  end: number;
  /** 뒤에 '로/으로'가 붙음 = 변경 목표 */
  target: boolean;
}
interface DayToken extends Token {
  day: LocalDay;
}
interface TimeToken extends Token {
  minutes: number;
}

const WD = '일월화수목금토';
const DAY_RE =
  /(\d{1,2})\s*월\s*(\d{1,2})\s*일|(?:(이번|다음|담)\s*주\s*)?([월화수목금토일])요일|(내일\s*모레|모레|글피|내일|오늘)/g;
const TIME_RE =
  /(오전|오후|아침|저녁|밤|낮|새벽)?\s*(?:(\d{1,2}):(\d{2})|(\d{1,2})\s*시(?!간)(?:\s*(\d{1,2})\s*분|\s*(반))?)/g;
const DUR_RE = /(\d{1,2})\s*시간(?:\s*(\d{1,2})\s*분)?|(\d{1,3})\s*분\s*(?:동안|간)|반\s*시간/g;
const SHIFT_RE = /(\d{1,3})\s*(시간|분)\s*(?:뒤로|늦게|일찍|앞으로)?\s*(미뤄|늦춰|연기|당겨|앞당겨)/g;
const TARGET_SUFFIX = /^\s*(?:으로|로)/;
const PLACE_RE = /(\S+?)에서/;

const STOP = new Set(['에', '부터', '까지', '~', '-', '으로', '로', '동안', '좀', '일정', '하나', '새', '을', '를', '에서', '는', '은', '그', '다시']);

function scan<T extends Token>(text: string, re: RegExp, make: (m: RegExpExecArray) => Omit<T, keyof Token> | null): T[] {
  const out: T[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const v = make(m);
    if (!v) continue;
    const end = m.index + m[0].length;
    const suffix = TARGET_SUFFIX.exec(text.slice(end));
    out.push({ ...(v as object), start: m.index, end: end + (suffix ? suffix[0].length : 0), target: !!suffix } as T);
  }
  return out;
}

function resolveDay(m: RegExpExecArray, now: LocalNow): LocalDay | null {
  const today: LocalDay = { y: now.y, m: now.m, d: now.d };
  if (m[1]) {
    const mon = +m[1];
    const day = +m[2];
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    // 한 달 넘게 지난 날짜면 내년
    const y = Date.UTC(now.y, mon - 1, day) < Date.UTC(now.y, now.m - 1, now.d) - 30 * 86_400_000 ? now.y + 1 : now.y;
    return { y, m: mon, d: day };
  }
  if (m[4]) {
    const target = WD.indexOf(m[4]);
    const mondayIdx = (now.dow + 6) % 7; // 월=0
    const targetIdx = (target + 6) % 7;
    if (m[3] === '이번') return addDays(today, targetIdx - mondayIdx);
    if (m[3]) return addDays(today, 7 - mondayIdx + targetIdx);
    return addDays(today, (target - now.dow + 7) % 7);
  }
  const w = m[5].replace(/\s/g, '');
  const off = { 오늘: 0, 내일: 1, 모레: 2, 내일모레: 2, 글피: 3 }[w] ?? 0;
  return addDays(today, off);
}

function toMinutes(m: RegExpExecArray): number | null {
  const mer = m[1];
  let h = Number(m[2] ?? m[4]);
  const min = m[3] ? Number(m[3]) : m[5] ? Number(m[5]) : m[6] ? 30 : 0;
  if (h > 24 || min > 59) return null;
  if (mer === '오후' || mer === '저녁' || mer === '밤') {
    if (h < 12) h += 12;
  } else if (mer === '오전' || mer === '새벽' || mer === '아침') {
    if (h === 12) h = 0;
  } else if (mer === '낮') {
    if (h <= 6) h += 12;
  } else if (!m[2] && h >= 1 && h <= 7) {
    h += 12; // "3시" → 오후 3시 (업무 시간 가정)
  }
  return (h % 24) * 60 + min;
}

function durationOf(text: string): number | undefined {
  DUR_RE.lastIndex = 0;
  const m = DUR_RE.exec(text);
  if (!m) return undefined;
  if (m[1]) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  if (m[3]) return Number(m[3]);
  return 30;
}

/** 토큰·동사를 지운 나머지를 제목으로 */
function subjectOf(text: string, cut: Token[]): { subject: string; location: string } {
  let s = text;
  for (const t of [...cut].sort((a, b) => b.start - a.start)) s = s.slice(0, t.start) + ' ' + s.slice(t.end);
  s = s.replace(SHIFT_RE, ' ').replace(DUR_RE, ' ');
  const last = lastVerb(s);
  if (last) s = s.slice(0, last.index);
  s = s.replace(/(캘린더|달력|일정표|outlook|아웃룩)에?/gi, ' ');
  let location = '';
  const place = PLACE_RE.exec(s);
  if (place) {
    location = place[1];
    s = s.replace(place[0], ' ');
  }
  const words = s
    .split(/\s+/)
    .map((w) => w.replace(/^[~\-,.]+|[~\-,.!?]+$/g, ''))
    .filter((w) => w && !STOP.has(w));
  if (words.length) words[words.length - 1] = words[words.length - 1].replace(/(을|를)$/, '') || words[words.length - 1];
  return { subject: words.join(' ').trim(), location };
}

/** 마지막 동사 (명령의 종류를 결정). "치과 예약 모레로 변경" → 변경 */
function lastVerb(text: string): { index: number; update: boolean } | null {
  const re = new RegExp(`${CREATE_VERB.source}|${UPDATE_VERB.source}`, 'g');
  let found: { index: number; update: boolean } | null = null;
  for (let m = re.exec(text); m; m = re.exec(text)) found = { index: m.index, update: UPDATE_VERB.test(m[0]) };
  return found;
}

/** 일정 쓰기 의도인지 (생성·수정 동사 + 날짜/시간/일정 단어) */
export function isWriteIntent(text: string): boolean {
  if (!CREATE_VERB.test(text) && !UPDATE_VERB.test(text)) return false;
  DAY_RE.lastIndex = 0;
  TIME_RE.lastIndex = 0;
  return DAY_RE.test(text) || TIME_RE.test(text) || /(일정|회의|미팅|약속|캘린더|스케[줄쥴])/.test(text);
}

export function parseEventCommand(text: string, now: LocalNow): EventCommand {
  const days = scan<DayToken>(text, DAY_RE, (m) => {
    const day = resolveDay(m, now);
    return day ? { day } : null;
  });
  const times = scan<TimeToken>(text, TIME_RE, (m) => {
    const minutes = toMinutes(m);
    return minutes === null ? null : { minutes };
  });
  const today: LocalDay = { y: now.y, m: now.m, d: now.d };
  const { subject, location } = subjectOf(text, [...days, ...times]);

  if (lastVerb(text)?.update) {
    const change: UpdateChange = {};
    const newDay = days.find((d) => d.target);
    const newTime = times.find((t) => t.target);
    if (newDay) change.day = newDay.day;
    if (newTime) change.time = newTime.minutes;
    SHIFT_RE.lastIndex = 0;
    const shift = SHIFT_RE.exec(text);
    if (shift) {
      const n = Number(shift[1]) * (shift[2] === '시간' ? 60 : 1);
      change.shiftMin = /당겨/.test(shift[3]) ? -n : n;
    }
    const dur = durationOf(text.replace(SHIFT_RE, ''));
    if (dur) change.durationMin = dur;
    if (!change.day && change.time === undefined && !change.shiftMin && !change.durationMin) {
      return { kind: 'unclear', reason: '바꿀 날짜·시간을 못 찾음. 예: "내일 3시 회의 4시로 옮겨", "회의 30분 미뤄"' };
    }
    const fromDay = days.find((d) => !d.target);
    const fromTime = times.find((t) => !t.target);
    return {
      kind: 'update',
      match: { from: fromDay?.day ?? today, days: fromDay ? 1 : 14, subject, time: fromTime?.minutes },
      change,
    };
  }

  if (days.length === 0 && times.length === 0) {
    return { kind: 'unclear', reason: '날짜·시간을 못 찾음. 예: "내일 오후 3시 회의 잡아"' };
  }
  const nowMin = now.hour * 60 + now.minute;
  let day = days[0]?.day;
  const startMin = times[0]?.minutes;
  if (!day) day = startMin !== undefined && startMin <= nowMin ? addDays(today, 1) : today;
  const title = subject || '새 일정';

  if (startMin === undefined) {
    return {
      kind: 'create',
      draft: { subject: title, start: localIso(day, 0), end: localIso(day, 1440), isAllDay: true, location },
    };
  }
  let endMin = times[1]?.minutes;
  if (endMin !== undefined && endMin <= startMin) endMin = endMin + 720 > startMin ? endMin + 720 : endMin + 1440;
  if (endMin === undefined) endMin = startMin + (durationOf(text) ?? 60);
  return {
    kind: 'create',
    draft: { subject: title, start: localIso(day, startMin), end: localIso(day, endMin), isAllDay: false, location },
  };
}

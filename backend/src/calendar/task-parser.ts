import { addDays, LocalDay, LocalNow } from './tz';

/** 할 일(Google Tasks) 생성 명령 파서 (규칙 기반) */

const TASK_WORD = /(할\s*일|투두|to-?do|리마인더|reminder|태스크|체크\s*리스트)/i;
const TASK_VERB = /(추가|등록|넣어|만들어|생성|적어|저장|잡아)/;
const WD = '일월화수목금토';
const DAY_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일|(?:(이번|다음|담)\s*주\s*)?([월화수목금토일])요일|(내일\s*모레|모레|글피|내일|오늘)/;
const DROP_TASK = /^(할일|투두|to-?do|리마인더|reminder|태스크|체크리스트|목록)(에|에다|로|으로|을|를|에서)?$/i;
const DROP_VERB = /^(추가|등록|넣어|만들어|생성|적어|저장|잡아)(해|하기|해줘|해\s*주세요|줘|주세요|줄래|해줄래)?$/;
const DROP_WORD = new Set(['좀', '하나', '새로', '새', '마감', '기한', '까지', '에', '로', '으로', '해줘', '줘', '주세요']);

export type TaskCommand = { kind: 'create'; title: string; due: string | null } | { kind: 'unclear'; reason: string };

export function isTaskWriteIntent(text: string): boolean {
  return TASK_WORD.test(text) && TASK_VERB.test(text);
}

const p2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: LocalDay) => `${d.y}-${p2(d.m)}-${p2(d.d)}`;

function resolveDay(m: RegExpExecArray, now: LocalNow): LocalDay | null {
  const today: LocalDay = { y: now.y, m: now.m, d: now.d };
  if (m[1]) {
    const month = +m[1];
    const day = +m[2];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    // 지난 날짜(30일 이상 전)는 내년으로
    const y = Date.UTC(now.y, month - 1, day) < Date.UTC(now.y, now.m - 1, now.d) - 30 * 86_400_000 ? now.y + 1 : now.y;
    return { y, m: month, d: day };
  }
  if (m[4]) {
    const target = WD.indexOf(m[4]);
    let diff = (target - now.dow + 7) % 7;
    if (m[3] === '다음' || m[3] === '담') diff = ((target + 6) % 7) - ((now.dow + 6) % 7) + 7; // 다음 주(월요일 시작) 해당 요일
    return addDays(today, diff);
  }
  const w = m[5].replace(/\s/g, '');
  const off = { 오늘: 0, 내일: 1, 모레: 2, 내일모레: 2, 글피: 3 }[w] ?? 0;
  return addDays(today, off);
}

/** "내일 우유 사기 할 일 추가해줘" → { title: '우유 사기', due: 내일 } */
export function parseTaskCommand(text: string, now: LocalNow): TaskCommand {
  const quoted = /["'“‘「]([^"'”’」]{1,200})["'”’」]/.exec(text);
  const dm = DAY_RE.exec(text);
  const day = dm ? resolveDay(dm, now) : null;
  let title = quoted?.[1].trim() ?? '';
  if (!title) {
    const rest = dm ? text.slice(0, dm.index) + ' ' + text.slice(dm.index + dm[0].length) : text;
    const words = rest
      .replace(/[.!?,~]/g, ' ')
      .replace(/할\s*일/g, '할일')
      .replace(/체크\s*리스트/g, '체크리스트')
      .split(/\s+/)
      .filter((w) => w && !DROP_TASK.test(w) && !DROP_VERB.test(w) && !DROP_WORD.has(w) && !/^(을|를|은|는)$/.test(w));
    title = words.join(' ').replace(/(을|를)$/, '').trim();
  }
  if (!title) return { kind: 'unclear', reason: '할 일 내용이 없음' };
  return { kind: 'create', title: title.slice(0, 200), due: day ? ymd(day) : null };
}

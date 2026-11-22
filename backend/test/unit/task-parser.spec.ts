import { isTaskWriteIntent, parseTaskCommand } from '../../src/calendar/task-parser';
import { isWriteIntent } from '../../src/calendar/event-parser';

// 2026-11-23(월) 10:00
const NOW = { y: 2026, m: 11, d: 23, hour: 10, minute: 0, dow: 1 };

describe('task-parser', () => {
  it('의도 판별', () => {
    expect(isTaskWriteIntent('내일 우유 사기 할 일 추가해줘')).toBe(true);
    expect(isTaskWriteIntent('리마인더에 약 먹기 등록')).toBe(true);
    expect(isTaskWriteIntent('할 일 알려줘')).toBe(false);
    expect(isTaskWriteIntent('내일 3시 회의 잡아')).toBe(false);
  });

  it.each([
    ['내일 우유 사기 할 일 추가해줘', '우유 사기', '2026-11-24'],
    ['리마인더에 약 먹기 등록', '약 먹기', null],
    ['금요일까지 보고서 제출 할일 넣어줘', '보고서 제출', '2026-11-27'],
    ['다음 주 월요일 세금 내기 투두 추가', '세금 내기', '2026-11-30'],
    ['12월 3일 "엄마 생일 선물" 할 일 등록해', '엄마 생일 선물', '2026-12-03'],
    ['할 일에 책 반납을 추가해줘', '책 반납', null],
  ])('%s', (text, title, due) => {
    expect(parseTaskCommand(text, NOW)).toEqual({ kind: 'create', title, due });
  });

  it('내용 없으면 unclear', () => {
    expect(parseTaskCommand('할 일 추가해줘', NOW).kind).toBe('unclear');
  });

  it('일정 쓰기 의도와 겹쳐도 할 일 판별 가능', () => {
    expect(isWriteIntent('내일 우유 사기 할 일 추가해줘')).toBe(true);
    expect(isTaskWriteIntent('내일 우유 사기 할 일 추가해줘')).toBe(true);
  });
});

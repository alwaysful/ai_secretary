import { isWriteIntent, parseEventCommand } from '../../src/calendar/event-parser';

// 2026-11-23(월) 10:00 KST
const NOW = { y: 2026, m: 11, d: 23, hour: 10, minute: 0, dow: 1 };
const create = (t: string) => {
  const c = parseEventCommand(t, NOW);
  if (c.kind !== 'create') throw new Error(`not create: ${JSON.stringify(c)}`);
  return c.draft;
};

describe('event-parser', () => {
  it('쓰기 의도 감지', () => {
    expect(isWriteIntent('내일 3시 회의 잡아')).toBe(true);
    expect(isWriteIntent('회의 4시로 옮겨줘')).toBe(true);
    expect(isWriteIntent('내일 일정 알려줘')).toBe(false);
    expect(isWriteIntent('메일 요약해줘')).toBe(false);
  });

  it('"내일 3시 회의 잡아" → 내일 15:00~16:00 회의', () => {
    expect(create('내일 3시 회의 잡아')).toEqual({
      subject: '회의',
      start: '2026-11-24T15:00:00',
      end: '2026-11-24T16:00:00',
      isAllDay: false,
      location: '',
    });
  });

  it('오전/분/반/기간/장소', () => {
    expect(create('모레 오전 9시 반에 회의실A에서 주간회의 2시간 등록해줘')).toMatchObject({
      subject: '주간회의',
      start: '2026-11-25T09:30:00',
      end: '2026-11-25T11:30:00',
      location: '회의실A',
    });
    expect(create('12월 5일 14:00부터 15:30까지 치과 예약 추가')).toMatchObject({
      subject: '치과 예약',
      start: '2026-12-05T14:00:00',
      end: '2026-12-05T15:30:00',
    });
  });

  it('요일, 날짜만 있으면 종일', () => {
    expect(create('다음 주 수요일 휴가 일정 넣어줘')).toMatchObject({
      subject: '휴가',
      start: '2026-12-02T00:00:00',
      end: '2026-12-03T00:00:00',
      isAllDay: true,
    });
    expect(create('금요일 7시 저녁 약속 잡아')).toMatchObject({ start: '2026-11-27T19:00:00', subject: '저녁 약속' });
  });

  it('날짜 없고 시간이 지났으면 내일', () => {
    expect(create('오전 9시 스탠드업 잡아').start).toBe('2026-11-24T09:00:00');
    expect(create('오후 2시 통화 잡아').start).toBe('2026-11-23T14:00:00');
  });

  it('수정: 대상과 변경 목표 구분', () => {
    expect(parseEventCommand('내일 3시 회의 4시로 옮겨', NOW)).toEqual({
      kind: 'update',
      match: { from: { y: 2026, m: 11, d: 24 }, days: 1, subject: '회의', time: 900 },
      change: { time: 960 },
    });
    expect(parseEventCommand('치과 예약 모레로 변경', NOW)).toMatchObject({
      kind: 'update',
      match: { days: 14, subject: '치과 예약' },
      change: { day: { y: 2026, m: 11, d: 25 } },
    });
    expect(parseEventCommand('회의 30분 미뤄줘', NOW)).toMatchObject({ kind: 'update', change: { shiftMin: 30 } });
  });

  it('해석 불가', () => {
    expect(parseEventCommand('회의 바꿔줘', NOW).kind).toBe('unclear');
  });
});

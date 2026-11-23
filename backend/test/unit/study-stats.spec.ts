import { bucketize, localDate, weekStart } from '../../src/study/study-stats.service';

const zero = { focusSec: 0, pomodoros: 0, posture: 0, phone: 0, slack: 0, sleep: 0 };

describe('study stats', () => {
  it('weekStart: 월요일 기준', () => {
    expect(weekStart('2026-11-23')).toBe('2026-11-23'); // 월
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // 일
    expect(weekStart('2026-11-26')).toBe('2026-11-23'); // 목
  });

  it('localDate: 시간대 반영', () => {
    expect(localDate(new Date('2026-11-22T16:00:00Z'), 'Asia/Seoul')).toBe('2026-11-23');
  });

  it('일 단위: 빈 날 0, 시간대 기준 합산', () => {
    const now = new Date('2026-11-23T03:00:00Z'); // 서울 11-23 12시
    const out = bucketize(
      [
        { ...zero, startedAt: new Date('2026-11-22T16:30:00Z'), focusSec: 600, phone: 2 }, // 서울 11-23
        { ...zero, startedAt: new Date('2026-11-22T10:00:00Z'), focusSec: 300, posture: 1 }, // 서울 11-22
        { ...zero, startedAt: new Date('2026-11-01T10:00:00Z'), focusSec: 999 }, // 범위 밖
      ],
      'day',
      3,
      'Asia/Seoul',
      now,
    );
    expect(out.map((b) => b.date)).toEqual(['2026-11-21', '2026-11-22', '2026-11-23']);
    expect(out[2]).toMatchObject({ focusSec: 600, phone: 2 });
    expect(out[1]).toMatchObject({ focusSec: 300, posture: 1 });
    expect(out[0].focusSec).toBe(0);
  });

  it('주 단위: 같은 주 합산', () => {
    const now = new Date('2026-11-25T03:00:00Z');
    const out = bucketize(
      [
        { ...zero, startedAt: new Date('2026-11-23T03:00:00Z'), focusSec: 100 },
        { ...zero, startedAt: new Date('2026-11-24T03:00:00Z'), focusSec: 200, slack: 1 },
        { ...zero, startedAt: new Date('2026-11-18T03:00:00Z'), focusSec: 50 },
      ],
      'week',
      2,
      'Asia/Seoul',
      now,
    );
    expect(out).toEqual([
      { ...zero, phoneApp: 0, date: '2026-11-16', focusSec: 50 },
      { ...zero, phoneApp: 0, date: '2026-11-23', focusSec: 300, slack: 1 },
    ]);
  });
});

describe('phone events', () => {
  it('폰 딴짓 기록을 날짜별 phoneApp 으로 합산', () => {
    const now = new Date('2026-11-23T03:00:00Z');
    const out = bucketize([], 'day', 2, 'Asia/Seoul', now, [
      new Date('2026-11-22T16:30:00Z'), // 서울 11-23
      new Date('2026-11-23T01:00:00Z'), // 서울 11-23
      new Date('2026-11-22T10:00:00Z'), // 서울 11-22
    ]);
    expect(out.map((b) => b.phoneApp)).toEqual([1, 2]);
  });
});

import { CalendarTool, parseRange, startOfLocalDay } from '../../src/ai/tools/calendar.tool';
import { ToolError } from '../../src/ai/tools/tool';
import { MailError } from '../../src/mail/mail.errors';

function make(configured = true) {
  const calendar: any = { configured, between: jest.fn().mockResolvedValue([]) };
  const config: any = { get: (k: string) => ({ TIMEZONE: 'Asia/Seoul' })[k] };
  return { calendar, tool: new CalendarTool(calendar, config) };
}

// 2026-11-22(일) 21:00 UTC = 2026-11-23(월) 06:00 KST
const NOW = new Date('2026-11-22T21:00:00Z');

describe('CalendarTool', () => {
  it('일정 관련 문장만 감지', () => {
    const { tool } = make();
    for (const t of ['내일 일정 알려줘', '이번 주 스케줄', '캘린더 확인', 'my schedule today']) {
      expect(tool.matches(t)).toBe(true);
    }
    expect(tool.matches('메일 보여줘')).toBe(false);
  });

  it('parseRange', () => {
    expect(parseRange('내일 일정', 1)).toMatchObject({ from: 1, days: 1 });
    expect(parseRange('내일모레 약속', 1)).toMatchObject({ from: 2, days: 1 });
    expect(parseRange('오늘 회의', 1)).toMatchObject({ from: 0, days: 1 });
    expect(parseRange('이번 주 일정', 3)).toMatchObject({ from: 0, days: 5 });
    expect(parseRange('다음 주 일정', 1)).toMatchObject({ from: 7, days: 7 });
    expect(parseRange('앞으로 3일 일정', 1)).toMatchObject({ from: 0, days: 3 });
    expect(parseRange('12월 5일 일정', 1)).toMatchObject({ date: { month: 12, day: 5 } });
    expect(parseRange('일정', 1)).toMatchObject({ from: 0, days: 7 });
  });

  it('startOfLocalDay: KST 자정', () => {
    expect(startOfLocalDay(2026, 11, 24, 'Asia/Seoul').toISOString()).toBe('2026-11-23T15:00:00.000Z');
  });

  it('"내일 일정": KST 기준 내일 하루 조회, 목록 포맷', async () => {
    const { tool, calendar } = make();
    calendar.between.mockResolvedValue([
      { id: 'e1', subject: '주간 회의', start: '2026-11-24T10:00:00', end: '2026-11-24T11:00:00', isAllDay: false, location: '회의실 A' },
      { id: 'e2', subject: '휴가', start: '2026-11-24T00:00:00', end: '2026-11-25T00:00:00', isAllDay: true, location: '' },
    ]);

    const out = await tool.run('내일 일정 알려줘', undefined, NOW);

    const [start, end] = calendar.between.mock.calls[0];
    expect(start.toISOString()).toBe('2026-11-23T15:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-24T15:00:00.000Z');
    expect(out).toContain('내일 (2026-11-24(화)) 2건');
    expect(out).toContain('2026-11-24 10:00~11:00 | 주간 회의 | 장소: 회의실 A');
    expect(out).toContain('종일 | 휴가');
  });

  it('일정 없으면 안내', async () => {
    const { tool } = make();
    expect(await tool.run('오늘 일정', undefined, NOW)).toContain('일정 없음');
  });

  it('설정 없음·미연결 → ToolError', async () => {
    await expect(make(false).tool.run('일정')).rejects.toBeInstanceOf(ToolError);
    const { tool, calendar } = make();
    calendar.between.mockRejectedValue(new MailError('NOT_CONNECTED', 'x'));
    await expect(tool.run('일정', undefined, NOW)).rejects.toThrow('캘린더 미연결');
  });
});

import { CalendarActionService } from '../../src/actions/calendar-action.service';

const NOW = new Date('2026-11-23T01:00:00Z'); // 10:00 KST 월

function make(configured = true) {
  const calendar: any = {
    between: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(async (d) => ({ id: 'new', ...d })),
    update: jest.fn().mockImplementation(async (id, d) => ({ id, ...d })),
  };
  const auth: any = { configured };
  const config: any = { get: () => 'Asia/Seoul' };
  return { calendar, svc: new CalendarActionService(calendar, auth, config) };
}

describe('CalendarActionService', () => {
  it('읽기 요청은 무시', async () => {
    expect(await make().svc.plan('내일 일정 알려줘', 'c1', undefined, NOW)).toBeNull();
  });

  it('생성: 확인 전에는 Outlook에 쓰지 않음, confirm 후 생성', async () => {
    const { svc, calendar } = make();
    const plan = await svc.plan('내일 3시 회의 잡아', 'c1', undefined, NOW);
    expect(plan!.action).toMatchObject({ kind: 'calendar.create', summary: '등록: 11/24(화) 15:00~16:00 회의' });
    expect(plan!.context).toContain('아직 Outlook에 저장되지 않았다');
    expect(calendar.create).not.toHaveBeenCalled();
    expect(svc.list('c1')).toHaveLength(1);

    await svc.confirm(plan!.action!.id);
    expect(calendar.create).toHaveBeenCalledWith(
      expect.objectContaining({ subject: '회의', start: '2026-11-24T15:00:00' }),
      undefined,
    );
    expect(svc.list('c1')).toHaveLength(0);
    await expect(svc.confirm(plan!.action!.id)).rejects.toThrow();
  });

  it('같은 요청 반복 시 작업 재사용, 취소 가능', async () => {
    const { svc } = make();
    const a = await svc.plan('내일 3시 회의 잡아', 'c1', undefined, NOW);
    const b = await svc.plan('내일 3시 회의 잡아', 'c1', undefined, NOW);
    expect(a!.action!.id).toBe(b!.action!.id);
    svc.cancel(a!.action!.id);
    expect(svc.list()).toHaveLength(0);
  });

  it('수정: 대상 일정을 찾아 시간 변경 (길이 유지)', async () => {
    const { svc, calendar } = make();
    calendar.between.mockResolvedValue([
      { id: 'e1', subject: '점심', start: '2026-11-24T12:00:00', end: '2026-11-24T13:00:00', isAllDay: false, location: '' },
      { id: 'e2', subject: '주간 회의', start: '2026-11-24T15:00:00', end: '2026-11-24T16:30:00', isAllDay: false, location: 'A' },
    ]);
    const plan = await svc.plan('내일 3시 회의 4시로 옮겨', 'c1', undefined, NOW);
    expect(plan!.action).toMatchObject({
      kind: 'calendar.update',
      eventId: 'e2',
      draft: { start: '2026-11-24T16:00:00', end: '2026-11-24T17:30:00', location: 'A' },
    });
    await svc.confirm(plan!.action!.id);
    expect(calendar.update).toHaveBeenCalledWith('e2', expect.objectContaining({ start: '2026-11-24T16:00:00' }), undefined);
  });

  it('수정 대상 없으면 작업 없이 안내만', async () => {
    const plan = await make().svc.plan('내일 3시 회의 4시로 옮겨', 'c1', undefined, NOW);
    expect(plan!.action).toBeUndefined();
    expect(plan!.context).toContain('찾지 못함');
  });

  it('Outlook 미설정이면 안내만', async () => {
    const plan = await make(false).svc.plan('내일 3시 회의 잡아', 'c1', undefined, NOW);
    expect(plan!.action).toBeUndefined();
  });
});

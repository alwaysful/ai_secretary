import { CalendarService } from '../../src/calendar/calendar.service';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function make() {
  const auth: any = { getAccessToken: jest.fn().mockResolvedValue('tok'), invalidateAccessToken: jest.fn() };
  const config: any = { get: (k: string) => ({ TIMEZONE: 'Asia/Seoul' })[k as 'TIMEZONE'] };
  return { auth, svc: new CalendarService(auth, config) };
}

describe('CalendarService', () => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('매핑, 시간대 헤더, 기간 쿼리', async () => {
    fetchMock.mockResolvedValue(
      json({
        value: [
          {
            id: 'e1',
            subject: null,
            start: { dateTime: '2026-11-24T10:00:00.0000000' },
            end: { dateTime: '2026-11-24T11:00:00.0000000' },
            isAllDay: false,
            location: { displayName: '회의실 A' },
          },
        ],
      }),
    );
    const { svc } = make();

    const out = await svc.upcoming(3, undefined, new Date('2026-11-23T00:00:00Z'));

    expect(out).toEqual([
      {
        id: 'e1',
        subject: '(제목 없음)',
        start: '2026-11-24T10:00:00',
        end: '2026-11-24T11:00:00',
        isAllDay: false,
        location: '회의실 A',
      },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toContain('/me/calendarView?');
    expect(url).toContain('endDateTime=2026-11-26T00%3A00%3A00.000Z');
    expect(init.headers.Prefer).toBe('outlook.timezone="Asia/Seoul"');
  });

  it('403이면 NOT_CONNECTED (재로그인 필요)', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 403 }));
    const { svc } = make();
    await expect(svc.upcoming(1)).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('401이면 토큰 폐기 후 1회 재시도', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(json({ value: [] }));
    const { svc, auth } = make();
    await svc.upcoming(1);
    expect(auth.invalidateAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

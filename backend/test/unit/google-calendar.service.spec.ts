import { CalendarHub } from '../../src/calendar/calendar-hub.service';
import { GoogleCalendarService, toEvent } from '../../src/google/google-calendar.service';
import { emailFromIdToken } from '../../src/google/google-auth.service';
import { MailError } from '../../src/mail/mail.errors';

const config: any = { get: (k: string) => ({ TIMEZONE: 'Asia/Seoul' })[k] };

describe('GoogleCalendarService', () => {
  it('매핑: 시간 일정, 종일 일정', () => {
    expect(
      toEvent({ id: 'g1', summary: '회의', location: 'A', start: { dateTime: '2026-11-24T10:00:00+09:00' }, end: { dateTime: '2026-11-24T11:00:00+09:00' } }),
    ).toEqual({ id: 'g1', subject: '회의', start: '2026-11-24T10:00:00', end: '2026-11-24T11:00:00', isAllDay: false, location: 'A', source: 'google' });
    expect(toEvent({ id: 'g2', start: { date: '2026-11-24' }, end: { date: '2026-11-25' } })).toMatchObject({
      subject: '(제목 없음)',
      start: '2026-11-24T00:00:00',
      end: '2026-11-25T00:00:00',
      isAllDay: true,
    });
  });

  it('조회 쿼리, 취소 일정 제외', async () => {
    const api: any = { call: jest.fn().mockResolvedValue({ items: [{ id: 'x', status: 'cancelled', start: {}, end: {} }] }) };
    const svc = new GoogleCalendarService(api, config);
    expect(await svc.between(new Date('2026-11-23T00:00:00Z'), new Date('2026-11-24T00:00:00Z'))).toEqual([]);
    const url = api.call.mock.calls[0][0] as string;
    expect(url).toContain('singleEvents=true');
    expect(url).toContain('timeZone=Asia%2FSeoul');
  });

  it('생성 본문: 종일은 date, 시간은 dateTime+timeZone', () => {
    const svc = new GoogleCalendarService({} as any, config);
    expect(svc.body({ subject: 's', start: '2026-11-24T00:00:00', end: '2026-11-25T00:00:00', isAllDay: true, location: '' }, false)).toEqual({
      summary: 's',
      start: { date: '2026-11-24' },
      end: { date: '2026-11-25' },
    });
    expect(svc.body({ subject: 's', start: '2026-11-24T15:00:00', end: '2026-11-24T16:00:00', isAllDay: false, location: 'L' }, true)).toEqual({
      summary: 's',
      start: { dateTime: '2026-11-24T15:00:00', timeZone: 'Asia/Seoul', date: null },
      end: { dateTime: '2026-11-24T16:00:00', timeZone: 'Asia/Seoul', date: null },
      location: 'L',
    });
  });

  it('id_token email', () => {
    const tok = `x.${Buffer.from(JSON.stringify({ email: 'a@b.c' })).toString('base64url')}.y`;
    expect(emailFromIdToken(tok)).toBe('a@b.c');
    expect(emailFromIdToken('bad')).toBeNull();
  });
});

describe('CalendarHub', () => {
  function make(o: boolean, g: boolean) {
    const ev = (id: string, start: string) => ({ id, subject: id, start, end: start, isAllDay: false, location: '' });
    const outlook: any = { between: jest.fn().mockResolvedValue([ev('o1', '2026-11-24T12:00:00')]), create: jest.fn().mockResolvedValue(ev('n', 'x')), update: jest.fn().mockResolvedValue(ev('u', 'x')) };
    const google: any = { between: jest.fn().mockResolvedValue([ev('g1', '2026-11-24T09:00:00')]), create: jest.fn().mockResolvedValue(ev('n', 'x')), update: jest.fn().mockResolvedValue(ev('u', 'x')) };
    const oa: any = { configured: true, status: jest.fn().mockResolvedValue({ connected: o }) };
    const ga: any = { configured: true, isConnected: jest.fn().mockResolvedValue(g) };
    return { outlook, google, hub: new CalendarHub(outlook, oa, google, ga, config) };
  }
  const S = new Date('2026-11-24T00:00:00Z');

  it('둘 다 연결: 합쳐서 시간순 + source', async () => {
    const out = await make(true, true).hub.between(S, S);
    expect(out.map((e) => [e.id, e.source])).toEqual([['g1', 'google'], ['o1', 'outlook']]);
  });

  it('한쪽 실패는 무시', async () => {
    const { hub, outlook } = make(true, true);
    outlook.between.mockRejectedValue(new MailError('UPSTREAM', 'x'));
    expect((await hub.between(S, S)).map((e) => e.id)).toEqual(['g1']);
  });

  it('미연결이면 NOT_CONNECTED', async () => {
    await expect(make(false, false).hub.between(S, S)).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('생성은 Google 우선, 수정은 source로', async () => {
    const { hub, google, outlook } = make(true, true);
    expect(await hub.writeTarget()).toBe('google');
    await hub.create({} as any);
    expect(google.create).toHaveBeenCalled();
    await hub.update('id', {} as any, undefined, 'outlook');
    expect(outlook.update).toHaveBeenCalled();
  });
});

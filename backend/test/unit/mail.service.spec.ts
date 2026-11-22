import { MailService } from '../../src/mail/mail.service';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function make() {
  const auth: any = {
    getAccessToken: jest.fn().mockResolvedValue('tok'),
    invalidateAccessToken: jest.fn(),
  };
  const config: any = { get: (k: string) => ({ MAIL_BODY_MAX_CHARS: 10 })[k as 'MAIL_BODY_MAX_CHARS'] };
  return { auth, svc: new MailService(auth, config) };
}

describe('MailService', () => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('list: 매핑, 안 읽음 필터, 토큰 헤더', async () => {
    fetchMock.mockResolvedValue(
      json({
        value: [
          {
            id: 'a',
            subject: 'S1',
            from: { emailAddress: { name: 'Kim', address: 'k@x.com' } },
            receivedDateTime: '2026-11-22T05:03:00Z',
            isRead: false,
            bodyPreview: 'hi',
          },
          { id: 'b', subject: null, receivedDateTime: '2026-11-21T05:03:00Z', isRead: true, bodyPreview: '' },
        ],
      }),
    );
    const { svc } = make();

    const out = await svc.list({ top: 5, unreadOnly: true });

    expect(out).toEqual([
      { id: 'a', subject: 'S1', from: 'Kim <k@x.com>', receivedAt: '2026-11-22T05:03:00Z', isRead: false, preview: 'hi', important: false },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toContain('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('get: text 본문 요청, 길이 제한', async () => {
    fetchMock.mockResolvedValue(
      json({
        id: 'a',
        subject: 'S',
        receivedDateTime: '2026-11-22T05:03:00Z',
        isRead: true,
        body: { content: '0123456789ABCDEF' },
      }),
    );
    const { svc } = make();

    const d = await svc.get('a');

    expect(d.body).toBe('0123456789');
    expect(d.truncated).toBe(true);
    expect((fetchMock.mock.calls[0] as [string, any])[1].headers.Prefer).toContain('text');
  });

  it('401이면 토큰 폐기 후 1회 재시도', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(json({ value: [] }));
    const { svc, auth } = make();

    await svc.list({ top: 5, unreadOnly: false });

    expect(auth.invalidateAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('401 반복이면 NOT_CONNECTED', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 401 }));
    const { svc } = make();
    await expect(svc.list({ top: 1, unreadOnly: false })).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('404 → NOT_FOUND, 5xx → UPSTREAM', async () => {
    const { svc } = make();
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(svc.get('abcdefgh')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(svc.get('abcdefgh')).rejects.toMatchObject({ code: 'UPSTREAM' });
  });
});

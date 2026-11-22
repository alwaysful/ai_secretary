import { decrypt, encrypt } from '../../src/common/crypto';
import { MailAuthService } from '../../src/mail/mail-auth.service';

const KEY = 'c'.repeat(64);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function make(opts: { row?: unknown; configured?: boolean } = {}) {
  const prisma: any = {
    mailAccount: {
      findUnique: jest.fn().mockResolvedValue(opts.row ?? null),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const env: Record<string, string> =
    opts.configured === false ? { MS_TENANT_ID: 'common' } : { MS_CLIENT_ID: 'cid', MS_TENANT_ID: 'common', TOKEN_ENC_KEY: KEY };
  const config: any = { get: (k: string) => env[k] };
  return { prisma, svc: new MailAuthService(prisma, config) };
}

describe('MailAuthService', () => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('설정 없으면 configured=false, NOT_CONFIGURED', async () => {
    const { svc } = make({ configured: false });
    expect(svc.configured).toBe(false);
    await expect(svc.getAccessToken()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it('계정 없으면 NOT_CONNECTED', async () => {
    const { svc } = make();
    await expect(svc.getAccessToken()).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('리프레시: 새 토큰 암호화 저장, 액세스 토큰 캐시', async () => {
    fetchMock.mockResolvedValue(json({ access_token: 'at', refresh_token: 'rt2', expires_in: 3600 }));
    const { svc, prisma } = make({ row: { provider: 'outlook', refreshTokenEnc: encrypt('rt1', KEY) } });

    expect(await svc.getAccessToken()).toBe('at');
    expect(await svc.getAccessToken()).toBe('at');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String((fetchMock.mock.calls[0] as [string, any])[1].body);
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=rt1');
    const saved = prisma.mailAccount.upsert.mock.calls[0][0].update.refreshTokenEnc as string;
    expect(saved).not.toContain('rt2');
    expect(decrypt(saved, KEY)).toBe('rt2');
  });

  it('invalid_grant이면 계정 삭제 후 NOT_CONNECTED', async () => {
    fetchMock.mockResolvedValue(json({ error: 'invalid_grant', error_description: 'expired' }, 400));
    const { svc, prisma } = make({ row: { provider: 'outlook', refreshTokenEnc: encrypt('rt1', KEY) } });

    await expect(svc.getAccessToken()).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    expect(prisma.mailAccount.deleteMany).toHaveBeenCalled();
  });

  it('암호화 키가 바뀌면 AUTH_FAILED', async () => {
    const { svc } = make({ row: { provider: 'outlook', refreshTokenEnc: encrypt('rt1', 'd'.repeat(64)) } });
    await expect(svc.getAccessToken()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('startDeviceLogin: 사용자 코드 반환, 메일은 읽기 전용 scope', async () => {
    fetchMock.mockResolvedValue(
      json({ device_code: 'dc', user_code: 'ABCD-1234', verification_uri: 'https://microsoft.com/devicelogin', expires_in: 900, interval: 5 }),
    );
    const { svc } = make();

    const res = await svc.startDeviceLogin();
    await svc.disconnect(); // 백그라운드 폴링 중단

    expect(res).toEqual({ userCode: 'ABCD-1234', verificationUri: 'https://microsoft.com/devicelogin', expiresIn: 900 });
    const body = String((fetchMock.mock.calls[0] as [string, any])[1].body);
    expect(body).toContain('Mail.Read');
    expect(body).not.toContain('Mail.Send');
    expect(body).not.toContain('Mail.ReadWrite');
    expect(body).toContain('Calendars.ReadWrite');
  });
});

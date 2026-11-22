import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decrypt, encrypt } from '../common/crypto';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { MailError } from './mail.errors';
import { DeviceLogin, MailAuthStatus } from './mail.types';

const PROVIDER = 'outlook';
/** 읽기 전용 권한만 요청한다. 전송·삭제·수정 권한은 요청하지 않는다. */
const SCOPES = 'offline_access User.Read Mail.Read';
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const HTTP_TIMEOUT_MS = 15_000;
const EXPIRY_SKEW_MS = 60_000;

interface TokenOk {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

type TokenResult = { ok: true; data: TokenOk } | { ok: false; error: string; description: string };

interface PendingLogin {
  abort: AbortController;
  expiresAt: number;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Microsoft 계정 인증 (device code flow, 공개 클라이언트).
 * - 리프레시 토큰: AES-256-GCM 암호화 후 DB 저장
 * - 액세스 토큰: 메모리에만 보관
 */
@Injectable()
export class MailAuthService implements OnModuleDestroy {
  private readonly log = new Logger(MailAuthService.name);
  private access?: { token: string; expiresAt: number };
  private pending?: PendingLogin;
  private refreshing?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  get configured(): boolean {
    return Boolean(
      this.config.get('MS_CLIENT_ID', { infer: true }) && this.config.get('TOKEN_ENC_KEY', { infer: true }),
    );
  }

  onModuleDestroy(): void {
    this.pending?.abort.abort();
  }

  async status(): Promise<MailAuthStatus> {
    const acct = this.configured
      ? await this.prisma.mailAccount.findUnique({ where: { provider: PROVIDER } })
      : null;
    return {
      configured: this.configured,
      connected: Boolean(acct),
      pending: Boolean(this.pending),
      email: acct?.email ?? null,
    };
  }

  /** 사용자 코드를 돌려주고, 백그라운드에서 로그인 완료를 폴링한다. */
  async startDeviceLogin(): Promise<DeviceLogin> {
    const { clientId } = this.requireConfig();
    const { ok, body } = await this.post('/devicecode', { client_id: clientId, scope: SCOPES });
    if (!ok) {
      throw new MailError('AUTH_FAILED', String(body.error_description ?? body.error ?? 'device code request failed'));
    }

    this.pending?.abort.abort();
    const expiresIn = Number(body.expires_in);
    const login: PendingLogin = { abort: new AbortController(), expiresAt: Date.now() + expiresIn * 1000 };
    this.pending = login;
    void this.pollForTokens(String(body.device_code), Number(body.interval) || 5, login)
      .catch((e: unknown) => {
        if (!login.abort.signal.aborted) {
          this.log.warn(`device login failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      })
      .finally(() => {
        if (this.pending === login) this.pending = undefined;
      });

    return { userCode: String(body.user_code), verificationUri: String(body.verification_uri), expiresIn };
  }

  async getAccessToken(): Promise<string> {
    if (this.access && this.access.expiresAt > Date.now()) return this.access.token;
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }

  /** Graph가 401을 돌려줬을 때 호출. 다음 getAccessToken에서 갱신된다. */
  invalidateAccessToken(): void {
    this.access = undefined;
  }

  async disconnect(): Promise<void> {
    this.pending?.abort.abort();
    this.pending = undefined;
    this.access = undefined;
    await this.prisma.mailAccount.deleteMany({ where: { provider: PROVIDER } });
  }

  private async pollForTokens(deviceCode: string, intervalSec: number, login: PendingLogin): Promise<void> {
    const { clientId } = this.requireConfig();
    let interval = intervalSec;
    while (Date.now() < login.expiresAt) {
      await sleep(interval * 1000, login.abort.signal);
      const r = await this.tokenRequest(
        { grant_type: DEVICE_GRANT, client_id: clientId, device_code: deviceCode },
        login.abort.signal,
      );
      if (r.ok) {
        await this.saveTokens(r.data, true);
        return;
      }
      if (r.error === 'authorization_pending') continue;
      if (r.error === 'slow_down') {
        interval += 5;
        continue;
      }
      throw new MailError('AUTH_FAILED', r.description || r.error);
    }
    throw new MailError('AUTH_FAILED', 'device code expired');
  }

  private async refresh(): Promise<string> {
    const { clientId, key } = this.requireConfig();
    const acct = await this.prisma.mailAccount.findUnique({ where: { provider: PROVIDER } });
    if (!acct) throw new MailError('NOT_CONNECTED', 'outlook not connected');

    let refreshToken: string;
    try {
      refreshToken = decrypt(acct.refreshTokenEnc, key);
    } catch (e) {
      throw new MailError('AUTH_FAILED', 'stored token unreadable (TOKEN_ENC_KEY changed?)', e);
    }

    const r = await this.tokenRequest({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
      scope: SCOPES,
    });
    if (!r.ok) {
      if (r.error === 'invalid_grant') {
        await this.disconnect();
        throw new MailError('NOT_CONNECTED', 'outlook session expired; reconnect');
      }
      throw new MailError('AUTH_FAILED', r.description || r.error);
    }
    await this.saveTokens(r.data, false);
    return r.data.access_token;
  }

  private async saveTokens(t: TokenOk, lookupEmail: boolean): Promise<void> {
    const { key } = this.requireConfig();
    this.access = { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 - EXPIRY_SKEW_MS };
    if (!t.refresh_token) return; // 갱신 응답에 없으면 기존 토큰 유지

    const email = lookupEmail ? await this.fetchEmail(t.access_token) : null;
    const refreshTokenEnc = encrypt(t.refresh_token, key);
    await this.prisma.mailAccount.upsert({
      where: { provider: PROVIDER },
      create: { provider: PROVIDER, email, refreshTokenEnc },
      update: { refreshTokenEnc, ...(email ? { email } : {}) },
    });
  }

  private async fetchEmail(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const me = (await res.json()) as { mail?: string | null; userPrincipalName?: string | null };
      return me.mail ?? me.userPrincipalName ?? null;
    } catch {
      return null;
    }
  }

  private async tokenRequest(params: Record<string, string>, signal?: AbortSignal): Promise<TokenResult> {
    const { ok, body } = await this.post('/token', params, signal);
    if (ok && typeof body.access_token === 'string') return { ok: true, data: body as unknown as TokenOk };
    return {
      ok: false,
      error: String(body.error ?? 'unknown_error'),
      description: String(body.error_description ?? ''),
    };
  }

  private async post(
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ ok: boolean; body: Record<string, unknown> }> {
    const tenant = this.config.get('MS_TENANT_ID', { infer: true });
    const timeout = AbortSignal.timeout(HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new MailError('UPSTREAM', 'microsoft login unreachable', e);
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, body };
  }

  private requireConfig(): { clientId: string; key: string } {
    const clientId = this.config.get('MS_CLIENT_ID', { infer: true });
    const key = this.config.get('TOKEN_ENC_KEY', { infer: true });
    if (!clientId || !key) throw new MailError('NOT_CONFIGURED', 'set MS_CLIENT_ID and TOKEN_ENC_KEY');
    return { clientId, key };
  }
}

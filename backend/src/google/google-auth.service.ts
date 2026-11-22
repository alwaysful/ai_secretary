import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decrypt, encrypt } from '../common/crypto';
import { EnvVars } from '../config/env';
import { MailError } from '../mail/mail.errors';
import { PrismaService } from '../prisma/prisma.service';

const PROVIDER = 'google';
/** 일정 읽기·쓰기 + 할 일(Tasks). 범위가 바뀌면 재연결 필요. */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
].join(' ');
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const HTTP_TIMEOUT_MS = 15_000;
const EXPIRY_SKEW_MS = 60_000;
const LOGIN_TTL_MS = 10 * 60_000;

export interface GoogleAuthStatus {
  configured: boolean;
  connected: boolean;
  pending: boolean;
  email: string | null;
}

interface TokenOk {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}

const b64url = (b: Buffer) => b.toString('base64url');

/** id_token 페이로드의 email. 토큰 엔드포인트에서 TLS로 직접 받은 값이라 서명 검증은 생략. */
export function emailFromIdToken(idToken?: string): string | null {
  const part = idToken?.split('.')[1];
  if (!part) return null;
  try {
    const p = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { email?: unknown };
    return typeof p.email === 'string' ? p.email : null;
  } catch {
    return null;
  }
}

/**
 * Google 계정 인증 (OAuth 2.0 + PKCE, 루프백 리디렉션).
 * Google device flow는 캘린더·Tasks 범위를 허용하지 않아 브라우저 리디렉션 방식을 쓴다.
 * 리프레시 토큰은 암호화해 MailAccount(provider=google)에 저장, 액세스 토큰은 메모리에만.
 */
@Injectable()
export class GoogleAuthService {
  private readonly log = new Logger(GoogleAuthService.name);
  private access?: { token: string; expiresAt: number };
  private login?: { state: string; verifier: string; expiresAt: number };
  private refreshing?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  get configured(): boolean {
    return Boolean(
      this.config.get('GOOGLE_CLIENT_ID', { infer: true }) &&
        this.config.get('GOOGLE_CLIENT_SECRET', { infer: true }) &&
        this.config.get('TOKEN_ENC_KEY', { infer: true }),
    );
  }

  async isConnected(): Promise<boolean> {
    if (!this.configured) return false;
    return (await this.prisma.mailAccount.count({ where: { provider: PROVIDER } })) > 0;
  }

  async status(): Promise<GoogleAuthStatus> {
    const acct = this.configured ? await this.prisma.mailAccount.findUnique({ where: { provider: PROVIDER } }) : null;
    return {
      configured: this.configured,
      connected: Boolean(acct),
      pending: Boolean(this.login && this.login.expiresAt > Date.now()),
      email: acct?.email ?? null,
    };
  }

  redirectUri(): string {
    return (
      this.config.get('GOOGLE_REDIRECT_URI', { infer: true }) ??
      `http://127.0.0.1:${this.config.get('PORT', { infer: true })}/google/auth/callback`
    );
  }

  /** 브라우저로 열 동의 화면 URL */
  start(): { url: string } {
    const { clientId } = this.requireConfig();
    const verifier = b64url(randomBytes(32));
    const state = b64url(randomBytes(16));
    this.login = { state, verifier, expiresAt: Date.now() + LOGIN_TTL_MS };
    const qs = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
      code_challenge: b64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
    });
    return { url: `${AUTH_URL}?${qs.toString()}` };
  }

  /** 리디렉션 콜백: state 확인 후 코드 교환 */
  async finish(code: string | undefined, state: string | undefined, error?: string): Promise<string | null> {
    const login = this.login;
    if (error) {
      this.login = undefined;
      throw new MailError('AUTH_FAILED', `google: ${error}`);
    }
    if (!login || !state || state !== login.state || login.expiresAt < Date.now() || !code) {
      throw new MailError('AUTH_FAILED', 'invalid or expired login; start again');
    }
    this.login = undefined;
    const { clientId, clientSecret } = this.requireConfig();
    const r = await this.tokenRequest({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: this.redirectUri(),
      code_verifier: login.verifier,
    });
    if (!r.refresh_token) throw new MailError('AUTH_FAILED', 'no refresh token; remove app access in Google account and retry');
    const email = emailFromIdToken(r.id_token);
    await this.save(r, email);
    return email;
  }

  async getAccessToken(): Promise<string> {
    if (this.access && this.access.expiresAt > Date.now()) return this.access.token;
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }

  invalidateAccessToken(): void {
    this.access = undefined;
  }

  async disconnect(): Promise<void> {
    this.login = undefined;
    this.access = undefined;
    const acct = await this.prisma.mailAccount.findUnique({ where: { provider: PROVIDER } });
    if (!acct) return;
    await this.prisma.mailAccount.deleteMany({ where: { provider: PROVIDER } });
    const key = this.config.get('TOKEN_ENC_KEY', { infer: true });
    if (!key) return;
    try {
      const token = decrypt(acct.refreshTokenEnc, key);
      await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (e) {
      this.log.warn(`revoke failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async refresh(): Promise<string> {
    const { clientId, clientSecret, key } = this.requireConfig();
    const acct = await this.prisma.mailAccount.findUnique({ where: { provider: PROVIDER } });
    if (!acct) throw new MailError('NOT_CONNECTED', 'google not connected');
    let refreshToken: string;
    try {
      refreshToken = decrypt(acct.refreshTokenEnc, key);
    } catch (e) {
      throw new MailError('AUTH_FAILED', 'stored token unreadable (TOKEN_ENC_KEY changed?)', e);
    }
    try {
      const r = await this.tokenRequest({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      });
      await this.save(r, null);
      return r.access_token;
    } catch (e) {
      if (e instanceof MailError && e.message === 'invalid_grant') {
        await this.prisma.mailAccount.deleteMany({ where: { provider: PROVIDER } });
        throw new MailError('NOT_CONNECTED', 'google session expired; reconnect');
      }
      throw e;
    }
  }

  private async save(t: TokenOk, email: string | null): Promise<void> {
    const { key } = this.requireConfig();
    this.access = { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 - EXPIRY_SKEW_MS };
    if (!t.refresh_token) return;
    const refreshTokenEnc = encrypt(t.refresh_token, key);
    await this.prisma.mailAccount.upsert({
      where: { provider: PROVIDER },
      create: { provider: PROVIDER, email, refreshTokenEnc },
      update: { refreshTokenEnc, ...(email ? { email } : {}) },
    });
  }

  private async tokenRequest(params: Record<string, string>): Promise<TokenOk> {
    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (e) {
      throw new MailError('UPSTREAM', 'google login unreachable', e);
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && typeof body.access_token === 'string') return body as unknown as TokenOk;
    if (body.error === 'invalid_grant') throw new MailError('AUTH_FAILED', 'invalid_grant');
    throw new MailError('AUTH_FAILED', String(body.error_description ?? body.error ?? `token ${res.status}`));
  }

  private requireConfig(): { clientId: string; clientSecret: string; key: string } {
    const clientId = this.config.get('GOOGLE_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('GOOGLE_CLIENT_SECRET', { infer: true });
    const key = this.config.get('TOKEN_ENC_KEY', { infer: true });
    if (!clientId || !clientSecret || !key) {
      throw new MailError('NOT_CONFIGURED', 'set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENC_KEY');
    }
    return { clientId, clientSecret, key };
  }
}

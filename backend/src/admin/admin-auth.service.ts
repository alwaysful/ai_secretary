import { Injectable, Logger, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { EnvVars } from '../config/env';

/** 기본 관리자 코드의 scrypt 해시. 평문은 코드에 없음. ADMIN_CODE(.env)가 있으면 그것 우선 */
const DEFAULT_SALT = '54ebb211440991f108b8a56407d8c9cc';
const DEFAULT_HASH = '7447ba10ad3cdf2d767fda01bcdf44b3042957a1b4b886373d7b321c55a77e91';

const TOKEN_TTL_MS = 30 * 60_000;
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

@Injectable()
export class AdminAuthService {
  private readonly log = new Logger(AdminAuthService.name);
  private readonly salt: Buffer;
  private readonly hash: Buffer;
  private readonly tokens = new Map<string, number>();
  private readonly fails = new Map<string, { n: number; until: number }>();

  constructor(config: ConfigService<EnvVars, true>) {
    const code = config.get('ADMIN_CODE', { infer: true }) as string | undefined;
    if (code) {
      this.salt = randomBytes(16);
      this.hash = scryptSync(code, this.salt, 32);
    } else {
      this.salt = Buffer.from(DEFAULT_SALT, 'hex');
      this.hash = Buffer.from(DEFAULT_HASH, 'hex');
    }
  }

  login(code: string, ip: string): { token: string; expiresAt: string } {
    const now = Date.now();
    const f = this.fails.get(ip);
    if (f && f.until > now) {
      throw new HttpException({ code: 'LOCKED', message: `잠김. ${Math.ceil((f.until - now) / 1000)}초 후 재시도` }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const ok = timingSafeEqual(scryptSync(code, this.salt, 32), this.hash);
    if (!ok) {
      const n = (f?.n ?? 0) + 1;
      this.fails.set(ip, { n: n >= MAX_FAILS ? 0 : n, until: n >= MAX_FAILS ? now + LOCK_MS : 0 });
      this.log.warn(`admin login failed (${ip})`);
      throw new UnauthorizedException({ code: 'BAD_CODE', message: '코드 틀림' });
    }
    this.fails.delete(ip);
    this.prune(now);
    const token = randomBytes(32).toString('base64url');
    this.tokens.set(token, now + TOKEN_TTL_MS);
    this.log.log(`admin login (${ip})`);
    return { token, expiresAt: new Date(now + TOKEN_TTL_MS).toISOString() };
  }

  verify(token: string | undefined): boolean {
    if (!token) return false;
    const exp = this.tokens.get(token);
    if (!exp) return false;
    if (exp < Date.now()) {
      this.tokens.delete(token);
      return false;
    }
    return true;
  }

  logout(token: string | undefined): void {
    if (token) this.tokens.delete(token);
  }

  private prune(now: number): void {
    for (const [t, exp] of this.tokens) if (exp < now) this.tokens.delete(t);
  }
}

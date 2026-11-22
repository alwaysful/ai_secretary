import { Injectable } from '@nestjs/common';
import { MailError } from '../mail/mail.errors';
import { GoogleAuthService } from './google-auth.service';

const HTTP_TIMEOUT_MS = 15_000;

export interface GoogleWrite {
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/** Google REST 호출 공통: 토큰, 401 재시도, 오류 매핑 */
@Injectable()
export class GoogleApi {
  constructor(private readonly auth: GoogleAuthService) {}

  async call<T>(url: string, signal?: AbortSignal, write?: GoogleWrite, retried = false): Promise<T> {
    const token = await this.auth.getAccessToken();
    const timeout = AbortSignal.timeout(HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: write?.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(write?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: write?.body !== undefined ? JSON.stringify(write.body) : undefined,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'TimeoutError') throw new MailError('TIMEOUT', 'google request timed out', e);
      throw new MailError('UPSTREAM', 'google unreachable', e);
    }
    if (res.status === 401 && !retried) {
      this.auth.invalidateAccessToken();
      return this.call<T>(url, signal, write, true);
    }
    if (res.status === 401 || res.status === 403) {
      throw new MailError('NOT_CONNECTED', 'google unauthorized; reconnect google (calendar/tasks scope needed)');
    }
    if (res.status === 404 || res.status === 410) throw new MailError('NOT_FOUND', 'google item not found');
    if (!res.ok) throw new MailError('UPSTREAM', `google responded ${res.status}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

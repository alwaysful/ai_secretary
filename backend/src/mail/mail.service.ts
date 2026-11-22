import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanText } from '../common/text';
import { EnvVars } from '../config/env';
import { MailAuthService } from './mail-auth.service';
import { MailError } from './mail.errors';
import { MailDetail, MailSummary } from './mail.types';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const HTTP_TIMEOUT_MS = 15_000;
/** 안 읽음 필터는 Graph의 정렬 제약 때문에 서버가 아닌 클라이언트에서 한다. */
const UNREAD_SCAN = 50;
const SUMMARY_FIELDS = 'id,subject,from,receivedDateTime,isRead,bodyPreview,importance,flag';

interface GraphMessage {
  id: string;
  subject?: string | null;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime: string;
  isRead?: boolean;
  bodyPreview?: string;
  importance?: string;
  flag?: { flagStatus?: string };
  body?: { content?: string };
}

function toSummary(m: GraphMessage): MailSummary {
  const a = m.from?.emailAddress;
  const from = a?.address ? (a.name && a.name !== a.address ? `${a.name} <${a.address}>` : a.address) : (a?.name ?? '');
  return {
    id: m.id,
    subject: m.subject || '(제목 없음)',
    from,
    receivedAt: m.receivedDateTime,
    isRead: Boolean(m.isRead),
    preview: cleanText(m.bodyPreview ?? ''),
    important: m.importance === 'high' || m.flag?.flagStatus === 'flagged',
  };
}

function query(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

/** Microsoft Graph 읽기 전용 호출 (GET만). */
@Injectable()
export class MailService {
  constructor(
    private readonly auth: MailAuthService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async list(opts: { top: number; unreadOnly: boolean }, signal?: AbortSignal): Promise<MailSummary[]> {
    const qs = query({
      $top: String(opts.unreadOnly ? UNREAD_SCAN : opts.top),
      $select: SUMMARY_FIELDS,
      $orderby: 'receivedDateTime desc',
    });
    const data = await this.graph<{ value: GraphMessage[] }>(`/me/mailFolders/inbox/messages?${qs}`, {}, signal);
    return data.value
      .map(toSummary)
      .filter((m) => !opts.unreadOnly || !m.isRead)
      .slice(0, opts.top);
  }

  /** 받은편지함 안 읽은 메일 수 (Graph 폴더 집계값) */
  async unreadCount(signal?: AbortSignal): Promise<number> {
    const f = await this.graph<{ unreadItemCount?: number }>('/me/mailFolders/inbox?$select=unreadItemCount', {}, signal);
    return f.unreadItemCount ?? 0;
  }

  async get(id: string, signal?: AbortSignal): Promise<MailDetail> {
    const qs = query({ $select: `${SUMMARY_FIELDS},body` });
    const m = await this.graph<GraphMessage>(
      `/me/messages/${encodeURIComponent(id)}?${qs}`,
      { Prefer: 'outlook.body-content-type="text"' },
      signal,
    );
    const max = this.config.get('MAIL_BODY_MAX_CHARS', { infer: true });
    const text = cleanText(m.body?.content ?? '');
    return { ...toSummary(m), body: text.slice(0, max), truncated: text.length > max };
  }

  private async graph<T>(
    path: string,
    headers: Record<string, string>,
    signal?: AbortSignal,
    retried = false,
  ): Promise<T> {
    const token = await this.auth.getAccessToken();
    const timeout = AbortSignal.timeout(HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(GRAPH + path, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...headers },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'TimeoutError') throw new MailError('TIMEOUT', 'graph request timed out', e);
      throw new MailError('UPSTREAM', 'graph unreachable', e);
    }

    if (res.status === 401) {
      if (retried) throw new MailError('NOT_CONNECTED', 'outlook unauthorized; reconnect');
      this.auth.invalidateAccessToken();
      return this.graph<T>(path, headers, signal, true);
    }
    if (res.status === 404) throw new MailError('NOT_FOUND', 'message not found');
    if (!res.ok) throw new MailError('UPSTREAM', `graph responded ${res.status}`);
    return (await res.json()) as T;
  }
}

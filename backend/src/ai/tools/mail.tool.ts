import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { escapeTags } from '../../common/text';
import { EnvVars } from '../../config/env';
import { MailAuthService } from '../../mail/mail-auth.service';
import { MailError, MailErrorCode } from '../../mail/mail.errors';
import { MailService } from '../../mail/mail.service';
import { MailSummary } from '../../mail/mail.types';
import { ContextTool, ToolError } from './tool';

const MAIL_INTENT = /(메일|이메일|e-?mail|outlook|아웃룩|받은\s*편지함|inbox)/i;
const UNREAD = /(안\s*읽|읽지\s*않|unread|새\s*메일|새로\s*온|신규\s*메일)/i;
const WANT_BODY = /(내용|본문|자세히|상세|요약|읽어|summar)/i;
const COUNT = /(\d{1,2})\s*(?:개|통|건)(?!월)/;

/** 본문까지 읽을 최대 메일 수와, 메일당 프롬프트에 넣을 최대 글자 수 (16GB RAM, 컨텍스트 절약) */
const MAX_BODIES = 3;
const BODY_IN_CONTEXT = 1500;
const MAX_COUNT = 10;

const ERROR_TEXT: Partial<Record<MailErrorCode, string>> = {
  NOT_CONNECTED: 'Outlook 미연결. 사용자에게 POST /mail/auth/start 로 로그인하라고 안내한다.',
  NOT_CONFIGURED: 'Outlook 설정 없음 (MS_CLIENT_ID, TOKEN_ENC_KEY). 사용자에게 backend/README.md 설정을 안내한다.',
};

/** 대화 중 메일 관련 요청이 오면 받은편지함을 읽어 프롬프트에 주입한다. 읽기 전용. */
@Injectable()
export class MailTool implements ContextTool {
  readonly name = 'outlook-mail';
  readonly readOnly = true as const;

  constructor(
    private readonly mail: MailService,
    private readonly auth: MailAuthService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  matches(text: string): boolean {
    return MAIL_INTENT.test(text);
  }

  async run(text: string, signal?: AbortSignal): Promise<string> {
    if (!this.auth.configured) throw new ToolError(ERROR_TEXT.NOT_CONFIGURED!);

    const top = this.parseCount(text);
    const unreadOnly = UNREAD.test(text);
    try {
      const list = await this.mail.list({ top, unreadOnly }, signal);
      if (list.length === 0) return unreadOnly ? '안 읽은 메일 없음.' : '받은편지함이 비어 있음.';

      const bodies = new Map<string, string>();
      if (WANT_BODY.test(text)) {
        await Promise.all(
          list.slice(0, MAX_BODIES).map(async (m) => {
            const detail = await this.mail.get(m.id, signal);
            bodies.set(m.id, detail.body.slice(0, BODY_IN_CONTEXT));
          }),
        );
      }
      return this.format(list, bodies, unreadOnly);
    } catch (e) {
      if (e instanceof MailError) {
        throw new ToolError(ERROR_TEXT[e.code] ?? `메일 조회 실패: ${e.message}`, e);
      }
      throw e;
    }
  }

  private parseCount(text: string): number {
    const m = COUNT.exec(text);
    const n = m ? Number(m[1]) : this.config.get('MAIL_CONTEXT_COUNT', { infer: true });
    return Math.min(Math.max(n, 1), MAX_COUNT);
  }

  private format(list: MailSummary[], bodies: Map<string, string>, unreadOnly: boolean): string {
    const tz = this.config.get('TIMEZONE', { infer: true });
    const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' });
    const when = (iso: string) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? iso : fmt.format(d);
    };
    const flat = (s: string) => escapeTags(s).replace(/\s*\n\s*/g, ' ');

    const rows = list.map((m, i) => {
      const lines = [
        `${i + 1}. ${m.isRead ? '' : '[안읽음] '}${when(m.receivedAt)} | 보낸이: ${flat(m.from)} | 제목: ${flat(m.subject)}`,
      ];
      const body = bodies.get(m.id);
      if (body) lines.push(`   본문: ${flat(body)}`);
      else if (m.preview) lines.push(`   미리보기: ${flat(m.preview)}`);
      return lines.join('\n');
    });
    return [`Outlook 받은편지함 최근 ${list.length}통${unreadOnly ? ' (안 읽음만)' : ''}. 시각은 ${tz} 기준.`, ...rows].join(
      '\n',
    );
  }
}

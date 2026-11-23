import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { escapeTags } from '../../common/text';
import { EnvVars } from '../../config/env';
import { ScrapeService } from '../../scrape/scrape.service';
import { ScrapeKind } from '../../scrape/sources';
import { ContextTool } from './tool';

const NOTICE = /(학사\s*공지|학사|공지|지스트|gist)/i;
const CONTEST = /(공모전|대외\s*활동|콘테스트|contest)/i;
const NEW_ONLY = /(새|새로운|신규|안\s*읽은|new)/i;
const MAX = 12;

/** 요청 문장에서 대상 종류 */
export function kindsOf(text: string): ScrapeKind[] {
  const k: ScrapeKind[] = [];
  if (NOTICE.test(text)) k.push('notice');
  if (CONTEST.test(text)) k.push('contest');
  return k;
}

/** "새 학사공지 있어?", "공모전 뭐 있어" → 저장된 스크래핑 글을 프롬프트에 주입. 읽기 전용. */
@Injectable()
export class ScrapeTool implements ContextTool {
  readonly name = 'web-scrape';
  readonly readOnly = true as const;

  constructor(
    private readonly scrape: ScrapeService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  matches(text: string): boolean {
    return kindsOf(text).length > 0;
  }

  async run(text: string): Promise<string> {
    const tz = this.config.get('TIMEZONE', { infer: true });
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, dateStyle: 'short' });
    const unreadOnly = NEW_ONLY.test(text);
    const sources = await this.scrape.status();
    const blocks: string[] = [];
    for (const kind of kindsOf(text)) {
      let posts = await this.scrape.list({ kind, unread: unreadOnly, limit: MAX });
      const label = kind === 'notice' ? 'GIST 학사공지' : '공모전';
      if (unreadOnly && posts.length === 0) {
        blocks.push(`## ${label}: 새 글 없음 (최근 글 참고)`);
        posts = await this.scrape.list({ kind, limit: 5 });
      } else {
        blocks.push(`## ${label}${unreadOnly ? ' (새 글)' : ' (최신순)'}`);
      }
      const nameOf = new Map(sources.map((s) => [s.id, s.name]));
      for (const p of posts) {
        const parts = [
          p.seenAt ? '' : '[새]',
          p.postedAt ? day.format(p.postedAt) : '',
          kind === 'contest' ? nameOf.get(p.source) ?? p.source : '',
          p.category ?? '',
          p.title,
          p.author ? `(${p.author})` : '',
          p.deadline ? `마감 ${day.format(p.deadline)}` : '',
          p.url,
        ].filter(Boolean);
        blocks.push(`- ${escapeTags(parts.join(' · '))}`);
      }
      const st = sources.filter((s) => s.kind === kind);
      const last = st.map((s) => s.lastOkAt?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
      blocks.push(last ? `(마지막 확인 ${new Date(last).toLocaleString('ko-KR', { timeZone: tz })})` : '(아직 수집 안 됨)');
      const errs = st.filter((s) => s.lastError).map((s) => `${s.name}: 수집 실패`);
      if (errs.length) blocks.push(`(${errs.join(', ')})`);
    }
    return blocks.join('\n');
  }
}

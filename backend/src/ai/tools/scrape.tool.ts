import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { escapeTags } from '../../common/text';
import { EnvVars } from '../../config/env';
import { ScrapeService } from '../../scrape/scrape.service';
import { ContextTool } from './tool';

const NOTICE = /(학사|공지|지스트|gist|장학|학과)/i;
const CONTEST = /(공모전|대외\s*활동|콘테스트|contest)/i;
const NEWS = /(새\s*소식|뉴스피드|스크랩)/;
const NEW_ONLY = /(새|새로운|신규|안\s*읽은|new)/i;
const MAX = 12;

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');

interface Named {
  id: string;
  name: string;
  sites: { name: string }[];
}

/** 질문에 해당하는 카테고리: 이름 직접 언급 > 공지/공모전 키워드 > 전체 */
export function pickCategories<T extends Named>(text: string, cats: T[]): T[] {
  const t = squash(text);
  const named = cats.filter((c) => t.includes(squash(c.name)) || c.sites.some((s) => t.includes(squash(s.name))));
  if (named.length) return named;
  const want = (re: RegExp) => cats.filter((c) => re.test(c.name) || c.sites.some((s) => re.test(s.name)));
  const hits = [
    ...(NOTICE.test(text) ? want(/공지|학사|학과|gist/i) : []),
    ...(CONTEST.test(text) ? want(/공모|대외|활동|contest/i) : []),
  ];
  return hits.length ? [...new Set(hits)] : cats;
}

/** "새 학사공지 있어?", "공모전 뭐 있어" → 모은 글(중복 합침)을 프롬프트에 주입. 읽기 전용. */
@Injectable()
export class ScrapeTool implements ContextTool {
  readonly name = 'web-scrape';
  readonly readOnly = true as const;

  constructor(
    private readonly scrape: ScrapeService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  matches(text: string): boolean {
    return NOTICE.test(text) || CONTEST.test(text) || NEWS.test(text);
  }

  async run(text: string): Promise<string> {
    const tz = this.config.get('TIMEZONE', { infer: true });
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, dateStyle: 'short' });
    const unreadOnly = NEW_ONLY.test(text);
    const cats = await this.scrape.categoryList();
    if (cats.length === 0) return '(새 소식 카테고리 없음. 새 소식 화면에서 사이트 추가 필요)';
    const blocks: string[] = [];
    for (const c of pickCategories(text, cats)) {
      let items = await this.scrape.feed({ categoryId: c.id, unread: unreadOnly, limit: MAX });
      if (unreadOnly && items.length === 0) {
        blocks.push(`## ${c.name}: 새 글 없음 (최근 글 참고)`);
        items = await this.scrape.feed({ categoryId: c.id, limit: 5 });
      } else {
        blocks.push(`## ${c.name}${unreadOnly ? ' (새 글)' : ' (최신순)'}`);
      }
      for (const i of items) {
        const parts = [
          i.unread ? '[새]' : '',
          i.postedAt ? day.format(i.postedAt) : '',
          i.category ?? '',
          i.title,
          i.author ? `(${i.author})` : '',
          i.deadline ? `마감 ${day.format(i.deadline)}` : '',
          i.links.map((l) => `${l.siteName}: ${l.url}`).join(' / '),
        ].filter(Boolean);
        blocks.push(`- ${escapeTags(parts.join(' · '))}`);
      }
      const last = c.sites.map((s) => s.lastOkAt?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
      blocks.push(last ? `(마지막 확인 ${new Date(last).toLocaleString('ko-KR', { timeZone: tz })})` : '(아직 수집 안 됨)');
      const errs = c.sites.filter((s) => s.enabled && s.lastError).map((s) => `${s.name}: 수집 실패`);
      if (errs.length) blocks.push(`(${errs.join(', ')})`);
    }
    return blocks.join('\n');
  }
}

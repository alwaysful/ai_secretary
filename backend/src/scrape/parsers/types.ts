/** 파서가 돌려주는 글 1개 */
export interface ScrapedItem {
  externalId: string;
  title: string;
  url: string;
  category?: string;
  author?: string;
  postedAt?: Date;
  deadline?: Date;
}

export interface ParseCtx {
  /** 목록 페이지 URL (상대 링크 기준) */
  baseUrl: string;
  now: Date;
  /** IANA 시간대 */
  tz: string;
  /** 사용자가 준 글 링크 CSS 선택자 */
  itemSelector?: string;
}

/** 게시판 형식별 파서. parse 는 순수 함수 (네트워크 없음). 새 형식 = 파일 1개 + index.ts 등록 */
export interface Parser {
  readonly id: string;
  readonly label: string;
  parse(html: string, ctx: ParseCtx): ScrapedItem[];
}

export const clean = (s: string | undefined | null): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** 같은 글이 상단 고정 + 일반 목록에 두 번 나올 수 있음 */
export const uniq = (items: ScrapedItem[]): ScrapedItem[] => [...new Map(items.map((i) => [i.externalId, i])).values()];

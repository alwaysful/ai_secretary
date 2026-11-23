export type ScrapeKind = 'notice' | 'contest';

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
}

/**
 * 스크래핑 소스. 새 사이트 = 이 인터페이스 구현 + sources/index.ts 에 추가.
 * parse 는 순수 함수 (네트워크 없음) → 테스트 쉬움.
 */
export interface ScrapeSource {
  readonly id: string;
  readonly name: string;
  readonly kind: ScrapeKind;
  /** 사이트 바로가기 */
  readonly homeUrl: string;
  readonly listUrl: string;
  parse(html: string, ctx: ParseCtx): ScrapedItem[];
}

export const clean = (s: string | undefined | null): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** 카테고리 안 중복 글 합치기 (여러 게시판에 같은 공지가 올라온 경우) */

export interface MergeablePost {
  id: string;
  source: string;
  title: string;
  url: string;
  category: string | null;
  author: string | null;
  postedAt: Date | null;
  deadline: Date | null;
  startsAt?: Date | null;
  eventStartsAt?: Date | null;
  eventEndsAt?: Date | null;
  summary?: string | null;
  seenAt: Date | null;
  createdAt: Date;
}

export interface FeedLink {
  id: string;
  siteId: string;
  siteName: string;
  url: string;
}

export interface FeedItem {
  /** 대표 글 id */
  key: string;
  title: string;
  unread: boolean;
  /** 합쳐진 글 전부 (사이트별 링크) */
  links: FeedLink[];
  category: string | null;
  author: string | null;
  postedAt: Date | null;
  deadline: Date | null;
  startsAt: Date | null;
  eventStartsAt: Date | null;
  eventEndsAt: Date | null;
  summary: string | null;
  createdAt: Date;
  /** 공모전 분야 태그 (공모전이 아니면 빈 배열) */
  tags: string[];
}

const DAY = 86_400_000;
const MAX_GAP_DAYS = 14;
const SIMILAR = 0.85;

/** 앞쪽 [학사]·(AI학과) 같은 말머리, 기호·공백 제거 + 소문자 */
export function normalizeTitle(t: string): string {
  let s = t.toLowerCase();
  for (let i = 0; i < 4; i++) s = s.replace(/^\s*[[(【<〈「][^\])】>〉」]{1,30}[\])】>〉」]\s*/u, '');
  return s.replace(/[^\p{L}\p{N}]+/gu, '');
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

/** Dice 계수 (0~1) */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const x = bigrams(a);
  const y = bigrams(b);
  let hit = 0;
  for (const [k, n] of x) hit += Math.min(n, y.get(k) ?? 0);
  return (2 * hit) / (a.length - 1 + b.length - 1);
}

export function samePost(a: { title: string; postedAt: Date | null }, b: { title: string; postedAt: Date | null }): boolean {
  if (a.postedAt && b.postedAt && Math.abs(a.postedAt.getTime() - b.postedAt.getTime()) > MAX_GAP_DAYS * DAY) return false;
  const x = normalizeTitle(a.title);
  const y = normalizeTitle(b.title);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 12 && long.includes(short)) return true;
  return similarity(x, y) >= SIMILAR;
}

/** posts 는 최신순 가정. 다른 사이트의 같은 글만 합침 (같은 사이트 글은 별개) */
export function mergePosts(
  posts: MergeablePost[],
  siteName: (id: string) => string,
  tagsOf: (p: MergeablePost) => string[] = () => [],
): FeedItem[] {
  const groups: MergeablePost[][] = [];
  for (const p of posts) {
    const g = groups.find((grp) => !grp.some((q) => q.source === p.source) && samePost(grp[0], p));
    if (g) g.push(p);
    else groups.push([p]);
  }
  return groups.map((g) => {
    const head = g[0];
    const pick = <K extends keyof MergeablePost>(k: K) => g.find((p) => p[k] != null)?.[k] ?? null;
    return {
      key: head.id,
      title: head.title,
      unread: g.some((p) => !p.seenAt),
      links: g.map((p) => ({ id: p.id, siteId: p.source, siteName: siteName(p.source), url: p.url })),
      category: pick('category') as string | null,
      author: pick('author') as string | null,
      postedAt: pick('postedAt') as Date | null,
      deadline: pick('deadline') as Date | null,
      startsAt: (pick('startsAt') as Date | null | undefined) ?? null,
      eventStartsAt: (pick('eventStartsAt') as Date | null | undefined) ?? null,
      eventEndsAt: (pick('eventEndsAt') as Date | null | undefined) ?? null,
      summary: (pick('summary') as string | null | undefined) ?? null,
      createdAt: g.reduce((m, p) => (p.createdAt > m ? p.createdAt : m), head.createdAt),
      tags: [...new Set(g.flatMap(tagsOf))],
    };
  });
}

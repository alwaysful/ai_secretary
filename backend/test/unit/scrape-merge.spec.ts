import { pickCategories } from '../../src/ai/tools/scrape.tool';
import { contestTags } from '../../src/scrape/tags';
import { MergeablePost, mergePosts, normalizeTitle, samePost } from '../../src/scrape/merge';

const d = (s: string) => new Date(s);
let n = 0;
const post = (source: string, title: string, postedAt: string | null, seen = false): MergeablePost => ({
  id: `id${++n}`,
  source,
  title,
  url: `https://${source}/${n}`,
  category: null,
  author: null,
  postedAt: postedAt ? d(postedAt) : null,
  deadline: null,
  seenAt: seen ? d('2026-11-22') : null,
  createdAt: d('2026-11-22'),
});

describe('merge', () => {
  it('normalizes prefixes and symbols', () => {
    expect(normalizeTitle('[학사] (AI학과) 2027년 1학기 수강신청 안내!')).toBe('2027년1학기수강신청안내');
  });

  it('same notice on different boards', () => {
    expect(samePost({ title: '[학사] 2027 봄학기 수강신청 안내', postedAt: d('2026-11-20') }, { title: '[물리] 2027 봄학기 수강신청 안내', postedAt: d('2026-11-21') })).toBe(true);
    expect(samePost({ title: '2027 봄학기 수강신청 안내', postedAt: d('2026-01-20') }, { title: '2027 봄학기 수강신청 안내', postedAt: d('2026-11-21') })).toBe(false);
    expect(samePost({ title: '봄학기 수강신청 안내', postedAt: null }, { title: '가을학기 장학금 신청', postedAt: null })).toBe(false);
  });

  it('merges across sites only, keeps links, unread if any', () => {
    const items = mergePosts(
      [
        post('gist', '[학사] 2027년 1학기 국가장학금 신청 안내', '2026-11-20', true),
        post('physics', '2027년 1학기 국가장학금 신청 안내 (재공지)', '2026-11-21'),
        post('gist', '[학사] 2027년 1학기 국가장학금 신청 안내', '2026-11-20'),
        post('ai', '전혀 다른 세미나 공지', '2026-11-20'),
      ],
      (id) => id.toUpperCase(),
    );
    expect(items).toHaveLength(3);
    expect(items[0].links.map((l) => l.siteName)).toEqual(['GIST', 'PHYSICS']);
    expect(items[0].unread).toBe(true);
  });
});

describe('pickCategories', () => {
  const cats = [
    { id: '1', name: '학사공지', sites: [{ name: 'GIST 학사공지' }, { name: 'GIST 물리·광과학과' }] },
    { id: '2', name: '공모전', sites: [{ name: '위비티' }] },
    { id: '3', name: '장학', sites: [] },
  ];
  it.each([
    ['새 학사공지 있어?', ['1']],
    ['요즘 공모전 뭐 있어', ['2']],
    ['위비티 새 글', ['2']],
    ['장학 소식', ['3']],
    ['새 소식 알려줘', ['1', '2', '3']],
  ])('%s', (t, ids) => expect(pickCategories(t, cats).map((c) => c.id)).toEqual(ids));
});

describe('contest tags', () => {
  it.each([
    ['광고/마케팅, 논문/리포트, 기타', '아무 제목', ['광고/마케팅', '논문/리포트', '기타']],
    [null, '제5회 AI 해커톤 참가자 모집', ['웹/모바일/IT']],
    ['요리/뷰티/배우/오디션', '오디션', ['예체능/미술/음악']],
    [null, '2027 대학생 서포터즈 10기', ['대외활동/서포터즈']],
    [null, '그냥 행사', ['기타']],
    ['기타', '해외 탐방 프로그램', ['해외', '기타']],
  ])('%s %s', (c, t, tags) => expect(contestTags(c, t)).toEqual(tags));
});

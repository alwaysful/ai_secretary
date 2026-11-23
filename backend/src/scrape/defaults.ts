/** 처음 실행 시 만드는 기본 카테고리·사이트. 이후엔 사용자가 화면에서 추가·수정·삭제. */
export interface DefaultSite {
  id: string;
  name: string;
  url: string;
  parser: string;
}

export const DEFAULT_CATEGORIES: { name: string; sites: DefaultSite[] }[] = [
  {
    name: '학사공지',
    sites: [
      { id: 'gist-academic', name: 'GIST 학사공지', url: 'https://www.gist.ac.kr/kr/html/sub05/050209.html', parser: 'gist' },
      { id: 'gist-physics', name: 'GIST 물리·광과학과', url: 'https://physics.gist.ac.kr/news-events/notice/', parser: 'kboard' },
      {
        id: 'gist-ai',
        name: 'GIST AI학과 (AI융합학과)',
        url: 'https://ai.gist.ac.kr/prog/bbsArticle/BBSMSTR_000000012331/list.do',
        parser: 'egov',
      },
    ],
  },
  {
    name: '공모전',
    sites: [
      { id: 'wevity', name: '위비티', url: 'https://www.wevity.com/?c=find&s=1&gub=1', parser: 'wevity' },
      { id: 'linkareer', name: '링커리어', url: 'https://linkareer.com/list/contest', parser: 'linkareer' },
    ],
  },
];

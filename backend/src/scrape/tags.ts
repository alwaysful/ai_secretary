/** 공모전 분야 태그. 사이트마다 다른 분류·제목 키워드를 공통 분야로 맞춤 */
export const CONTEST_TAGS: [tag: string, re: RegExp][] = [
  ['기획/아이디어', /기획|아이디어|제안|정책|혁신/],
  ['광고/마케팅', /광고|마케팅|홍보|브랜드|네이밍|슬로건|카피/],
  ['디자인', /디자인|캐릭터|일러스트|웹툰|만화|로고|포스터|건축|인테리어/],
  ['영상/UCC', /영상|ucc|유튜브|숏폼|쇼츠|영화|애니메이션|콘텐츠/i],
  ['사진', /사진|포토/],
  ['IT/SW', /\bit\b|sw|소프트웨어|해커톤|앱|개발|프로그래밍|코딩|인공지능|\bai\b|데이터|보안|게임/i],
  ['과학/공학', /과학|공학|발명|특허|로봇|에너지|환경/],
  ['문학/글', /문학|글짓기|글쓰기|시나리오|수기|에세이|소설|신춘문예|백일장|논술|독후감|시\s*공모/],
  ['학술/논문', /논문|리포트|학술|연구/],
  ['창업/경영', /창업|스타트업|경영|비즈니스|경제|금융|투자/],
  ['예체능', /음악|노래|오디션|댄스|공연|예체능|미술|체육|요리|뷰티|배우|연기/],
  ['대외활동', /대외활동|서포터즈|기자단|봉사|홍보대사|원정대|앰배서더|멘토링/],
];

/** 분야 텍스트 우선, 없으면 제목에서 추정. 하나도 없으면 '기타' */
export function contestTags(category: string | null | undefined, title: string): string[] {
  const pick = (text: string) => CONTEST_TAGS.filter(([, re]) => re.test(text)).map(([t]) => t);
  const fromCat = category ? pick(category) : [];
  const tags = fromCat.length ? fromCat : pick(title);
  return tags.length ? tags : ['기타'];
}

/** 공모전 사이트(또는 이름이 공모전류인 카테고리)만 태그 */
export const CONTEST_PARSERS = new Set(['wevity', 'linkareer', 'contestkorea']);
export const isContestCategory = (name: string | null | undefined) => !!name && /공모|대외|활동|contest/i.test(name);

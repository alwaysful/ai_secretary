/**
 * 공모전 분야 태그 = 위비티 분류 17개.
 * 위비티 글은 분류 이름 그대로, 다른 사이트는 분류·제목 키워드로 맞춤.
 */
export const CONTEST_TAGS: [tag: string, re: RegExp][] = [
  ['기획/아이디어', /기획|아이디어|제안|정책|혁신/],
  ['광고/마케팅', /광고|마케팅|홍보(?!대사)|브랜드|카피/],
  ['논문/리포트', /논문|리포트|학술|연구|보고서/],
  ['영상/UCC/사진', /영상|ucc|유튜브|숏폼|쇼츠|영화|애니메이션|사진|포토/i],
  ['디자인/캐릭터/웹툰', /디자인|캐릭터|일러스트|웹툰|만화|로고|포스터|이모티콘/],
  ['웹/모바일/IT', /\bit\b|웹(?!툰|소설)|모바일|앱|인공지능|\bai\b|데이터|보안|해커톤|코딩|프로그래밍/i],
  ['게임/소프트웨어', /게임|소프트웨어|\bsw\b|개발/i],
  ['과학/공학', /과학|공학|발명|특허|로봇|에너지|환경|기술/],
  ['문학/글/시나리오', /문학|글짓기|글쓰기|시나리오|수기|에세이|소설|신춘문예|백일장|논술|독후감|시\s*공모|웹소설/],
  ['건축/건설/인테리어', /건축|건설|인테리어|도시|조경/],
  ['네이밍/슬로건', /네이밍|슬로건|표어|명칭|이름\s*공모/],
  ['예체능/미술/음악', /예체능|미술|음악|노래|오디션|댄스|공연|체육|스포츠|요리|뷰티|배우|연기|그림/],
  ['대외활동/서포터즈', /대외활동|서포터즈|기자단|홍보대사|원정대|앰배서더|멘토링|체험단/],
  ['봉사활동', /봉사/],
  ['취업/창업', /취업|채용|인턴|창업|스타트업|경영|비즈니스|경제|금융/],
  ['해외', /해외|글로벌|국제|외국|유학/],
];

const NAMES = new Set([...CONTEST_TAGS.map(([t]) => t), '기타']);

const pick = (text: string) => CONTEST_TAGS.filter(([, re]) => re.test(text)).map(([t]) => t);

/** 분야 텍스트(쉼표 구분) 우선: 태그 이름 그대로면 사용, 아니면 키워드 매칭. 없으면 제목에서 추정. 하나도 없으면 '기타' */
export function contestTags(category: string | null | undefined, title: string): string[] {
  const fromCat = (category ?? '')
    .split(/\s*,\s*/)
    .filter(Boolean)
    .flatMap((c) => (NAMES.has(c) ? [c] : pick(c)));
  const tags = fromCat.filter((t) => t !== '기타').length ? fromCat : [...fromCat, ...pick(title)];
  const uniq = [...new Set(tags)];
  const real = uniq.filter((t) => t !== '기타');
  return real.length ? [...real, ...(uniq.includes('기타') ? ['기타'] : [])] : ['기타'];
}

/** 공모전 사이트(또는 이름이 공모전류인 카테고리)만 태그 */
export const CONTEST_PARSERS = new Set(['wevity', 'linkareer', 'contestkorea']);
export const isContestCategory = (name: string | null | undefined) => !!name && /공모|대외|활동|contest/i.test(name);

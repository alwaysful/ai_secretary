/**
 * 설명 양식(템플릿). JSON 항목 {"tpl": "기술사", ...값} 을 펼쳐 CertDetail로 만듦.
 * 공통 문구는 여기 한 곳만 고치면 같은 양식 전부 바뀜.
 */

/** text: 본문, items: 목록(도서 등), links: 버튼 링크 */
export type CertDetailItem = { label: string; text: string; items?: string[]; links?: { label: string; url: string }[] };
export type CertDetail = CertDetailItem[];

type Params = Record<string, unknown>;
interface Template {
  required: string[];
  optional: string[];
  build: (p: Params) => CertDetail;
}

const s = (p: Params, k: string): string => String(p[k] ?? '');
const QNET = { label: 'Q-net', url: 'https://www.q-net.or.kr' };
const CBT = { label: '전자문제집 CBT (기출 연습)', url: 'https://www.comcbt.com' };

const 기술사: Template = {
  required: ['what', 'subjects', 'use', 'study'],
  optional: [],
  build: (p) => [
    { label: '무엇', text: s(p, 'what') },
    { label: '시행', text: '한국산업인력공단 (Q-net). 해마다 정기 3~4회.' },
    {
      label: '응시자격',
      text: '기사+실무 4년, 산업기사+실무 6년, 기능사+실무 8년, 관련 학과 4년제 졸업+실무 6년, 실무 9년 등. Q-net 자가진단으로 확인.',
    },
    {
      label: '필기',
      text: `4교시(교시당 100분) 주관식. 1교시 단답형 13문제 중 10문제, 2~4교시 논술형 6문제 중 4문제 선택. 출제: ${s(p, 'subjects')}`,
    },
    { label: '실기', text: '구술 면접. 전문 지식·기술 자질·윤리 평가. 필기 합격자만 응시.' },
    { label: '합격 기준', text: '필기: 4교시 평균 60점 이상. 면접: 60점 이상. 필기 합격 후 2년간 면접만 응시 가능.' },
    { label: '합격률', text: '필기 대략 한 자리~10%대. 최종 합격률 낮음. 회차마다 편차 큼.' },
    { label: '쓰임', text: s(p, 'use') },
    { label: '공부법', text: s(p, 'study') },
    { label: '링크', text: '접수·일정은 Q-net.', links: [QNET] },
  ],
};

const 기사: Template = {
  required: ['what', 'subjects', 'practical', 'rate', 'use', 'study'],
  optional: ['books', 'orgName', 'orgUrl'],
  build: (p) => {
    const org = p.orgName ? { label: s(p, 'orgName'), url: s(p, 'orgUrl') } : null;
    const books = Array.isArray(p.books) ? (p.books as string[]) : null;
    return [
      { label: '무엇', text: s(p, 'what') },
      { label: '시행', text: org ? `${org.label}. 해마다 정기 시행.` : '한국산업인력공단 (Q-net). 해마다 정기 3회.' },
      {
        label: '응시자격',
        text: '산업기사+실무 1년, 기능사+실무 3년, 관련 학과 4년제 졸업(예정), 3년제+실무 1년, 2년제+실무 2년, 실무 4년 등. Q-net 자가진단으로 확인.',
      },
      { label: '필기', text: `객관식 CBT. ${s(p, 'subjects')}` },
      { label: '실기', text: s(p, 'practical') },
      { label: '합격 기준', text: '필기: 과목마다 40점 이상 + 평균 60점 이상. 실기: 60점 이상. 필기 합격 후 2년간 필기 면제.' },
      { label: '합격률', text: s(p, 'rate') },
      { label: '쓰임', text: s(p, 'use') },
      ...(books ? [{ label: '준비 도서', text: '출판사별 한 시리즈만 골라 끝까지.', items: books }] : []),
      { label: '공부법', text: s(p, 'study') },
      {
        label: '링크',
        text: `접수·일정은 ${org ? org.label : 'Q-net'}. 연습은 CBT 기출 사이트.`,
        links: [org ?? QNET, CBT],
      },
    ];
  },
};

export const TEMPLATES: Record<string, Template> = { 기술사, 기사 };

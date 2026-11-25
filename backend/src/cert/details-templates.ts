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

interface Grade {
  /** 시행 (산업인력공단) */
  sched: string;
  eligible: string;
  written: string;
  pass: string;
  rate: string;
  study: string;
  /** 기본 시행처 (없으면 Q-net) */
  org?: { label: string; url: string };
}

/** 국가기술 등급별 공통 양식. 값: what·subjects·practical·use 필수, 나머지 선택 */
const grade = (g: Grade): Template => ({
  required: ['what', 'subjects', 'practical', 'use'],
  optional: ['rate', 'study', 'books', 'orgName', 'orgUrl', 'eligible'],
  build: (p) => {
    const org = p.orgName ? { label: s(p, 'orgName'), url: s(p, 'orgUrl') } : (g.org ?? null);
    const books = Array.isArray(p.books) ? (p.books as string[]) : null;
    return [
      { label: '무엇', text: s(p, 'what') },
      { label: '시행', text: org && !g.org ? `${org.label}. 해마다 정기 시행.` : g.sched },
      { label: '응시자격', text: p.eligible ? s(p, 'eligible') : g.eligible },
      { label: '필기', text: `${g.written} ${s(p, 'subjects')}` },
      { label: '실기', text: s(p, 'practical') },
      { label: '합격 기준', text: g.pass },
      { label: '합격률', text: p.rate ? s(p, 'rate') : g.rate },
      { label: '쓰임', text: s(p, 'use') },
      ...(books ? [{ label: '준비 도서', text: '출판사별 한 시리즈만 골라 끝까지.', items: books }] : []),
      { label: '공부법', text: p.study ? s(p, 'study') : g.study },
      {
        label: '링크',
        text: `접수·일정은 ${org ? org.label : 'Q-net'}. 연습은 CBT 기출 사이트.`,
        links: [org ?? QNET, CBT],
      },
    ];
  },
});

const PASS = '필기: 과목마다 40점 이상 + 평균 60점 이상. 실기: 60점 이상. 필기 합격 후 2년간 필기 면제.';
const PASS60 = '필기·실기 각 100점 만점에 60점 이상. 필기 합격 후 2년간 필기 면제.';

const 기사 = grade({
  sched: '한국산업인력공단 (Q-net). 해마다 정기 3회.',
  eligible: '산업기사+실무 1년, 기능사+실무 3년, 관련 학과 4년제 졸업(예정), 3년제+실무 1년, 2년제+실무 2년, 실무 4년 등. Q-net 자가진단으로 확인.',
  written: '객관식 CBT.',
  pass: PASS,
  rate: '대략 필기 30~50%대, 실기 30~50%대. 종목·회차 편차 큼.',
  study: '필기: 기출 5년치 반복 (6~8주). 실기: 유형별 풀이·실습 반복.',
});

const 산업기사 = grade({
  sched: '한국산업인력공단 (Q-net). 해마다 정기 3회.',
  eligible: '기능사+실무 1년, 관련 학과 2년제 졸업(예정), 동일 직무 실무 2년 등. Q-net 자가진단으로 확인.',
  written: '객관식 CBT (과목당 20문항).',
  pass: PASS,
  rate: '대략 필기 30~50%대, 실기 30~50%대. 종목·회차 편차 큼.',
  study: '필기: 기출 3~5년치 반복 (4~6주). 실기: 유형별 풀이·실습 반복.',
});

const 기능장 = grade({
  sched: '한국산업인력공단 (Q-net). 해마다 정기 2회.',
  eligible: '산업기사+실무 5년, 기능사+실무 7년, 실무 9년, 기능대학 기능장 과정 이수 등. Q-net 자가진단으로 확인.',
  written: '객관식 60문항 CBT.',
  pass: PASS60,
  rate: '대략 필기 30~50%대, 실기 20~40%대.',
  study: '필기: 기출 반복. 실기: 현장 숙련 바탕으로 과제 시간 안에 완성 연습.',
});

const 기능사 = grade({
  sched: '한국산업인력공단 (Q-net). 해마다 정기 4회 (일부 종목 상시).',
  eligible: '제한 없음. 누구나 응시.',
  written: '객관식 60문항 CBT.',
  pass: PASS60,
  rate: '대략 필기 40~60%대, 실기 30~60%대.',
  study: '필기: 기출 반복 (2~4주). 실기: 공개 과제 반복 실습.',
});

/** 서비스 분야 2급 (사회조사분석사·직업상담사 등) */
const 서비스 = grade({
  sched: '한국산업인력공단 (Q-net). 해마다 정기 3회.',
  eligible: '제한 없음 (종목별 예외는 Q-net 확인).',
  written: '객관식 CBT.',
  pass: PASS,
  rate: '대략 필기 40~60%대, 실기 30~60%대.',
  study: '필기: 기출 반복 (3~4주). 실기: 유형별 답안 작성 연습.',
});

const KORCHAM = { label: '대한상공회의소', url: 'https://license.korcham.net' };
/** 대한상공회의소 시행 (컴활·워드 등) */
const 상공회의소 = grade({
  sched: '대한상공회의소. 상시 시험 (지역 상공회의소 시험장).',
  eligible: '제한 없음. 누구나 응시.',
  written: '객관식 CBT.',
  pass: '필기: 과목마다 40점 이상 + 평균 60점 이상. 실기: 70점 이상 (종목별 상이). 필기 합격 후 2년간 필기 면제.',
  rate: '대략 필기 40~60%대, 실기 20~50%대.',
  study: '필기: 기출 반복 (1~2주). 실기: 기출 작업 시간 재며 반복.',
  org: KORCHAM,
});

/** 국가전문자격 공통 양식. 시행처는 orgName·orgUrl (url 없으면 링크 생략) */
const 국가전문: Template = {
  required: ['what', 'eligible', 'exam', 'use', 'orgName'],
  optional: ['exam2', 'sched', 'pass', 'rate', 'study', 'orgUrl', 'books'],
  build: (p) => {
    const org = s(p, 'orgName');
    const books = Array.isArray(p.books) ? (p.books as string[]) : null;
    return [
      { label: '무엇', text: s(p, 'what') },
      { label: '시행', text: `${org}. ${p.sched ? s(p, 'sched') : '해마다 정기 시행. 일정은 공고 확인.'}` },
      { label: '응시자격', text: s(p, 'eligible') },
      { label: p.exam2 ? '1차·필기' : '시험', text: s(p, 'exam') },
      ...(p.exam2 ? [{ label: '2차·실기', text: s(p, 'exam2') }] : []),
      { label: '합격 기준', text: p.pass ? s(p, 'pass') : '과목마다 40점 이상 + 평균 60점 이상 (종목별 상이, 공고 확인).' },
      { label: '합격률', text: p.rate ? s(p, 'rate') : '종목·회차별 편차 큼. 시행처 공고 통계 확인.' },
      { label: '쓰임', text: s(p, 'use') },
      ...(books ? [{ label: '준비 도서', text: '출판사별 한 시리즈만 골라 끝까지.', items: books }] : []),
      { label: '공부법', text: p.study ? s(p, 'study') : '기출 반복. 최신 법령·출제 기준 확인.' },
      {
        label: '링크',
        text: `접수·일정은 ${org}.`,
        ...(p.orgUrl ? { links: [{ label: org, url: s(p, 'orgUrl') }] } : {}),
      },
    ];
  },
};

/** 국가공인 민간자격. 국가전문 틀, 응시자격 기본 '제한 없음' */
const 공인민간: Template = {
  required: ['what', 'exam', 'use', 'orgName'],
  optional: [...국가전문.optional, 'eligible'],
  build: (p) => 국가전문.build({ eligible: '제한 없음. 누구나 응시.', ...p }),
};

export const TEMPLATES: Record<string, Template> = { 기술사, 기사, 산업기사, 기능장, 기능사, 서비스, 상공회의소, 국가전문, 공인민간 };

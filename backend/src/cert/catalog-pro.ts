import type { PrivateCert } from './catalog-private';

/**
 * 국가전문자격 (부처별 법령에 따른 자격). 이름 겹치면 catalog.ts 기본 목록이 우선.
 * Q-net 시행분은 일정 수집 때 이름으로 연결됨. 값은 참고값.
 */
type R = [id: string, name: string, grade: string | null, prep?: string, summary?: string];

const QNET = ['한국산업인력공단', 'https://www.q-net.or.kr'] as const;
const KUKSIWON = ['한국보건의료인국가시험원', 'https://www.kuksiwon.or.kr'] as const;
const KOTSA = ['한국교통안전공단', 'https://www.kotsa.or.kr'] as const;
const SEAMAN = ['한국해양수산연수원', null] as const;
const KSPO = ['국민체육진흥공단', null] as const;

const GROUPS: { field: string; org: readonly [string, string | null]; rows: R[] }[] = [
  {
    field: '법률/행정',
    org: QNET,
    rows: [
      ['np-patent', '변리사', null, '2~3년'],
      ['np-labor', '공인노무사', null, '1~2년'],
      ['np-admin', '행정사', null, '3~6개월'],
      ['np-franchise', '가맹거래사', null, '3~6개월'],
      ['np-guard', '경비지도사', null, '2~4개월'],
    ],
  },
  {
    field: '경영/사무/OA',
    org: QNET,
    rows: [
      ['np-tech-guide', '기술지도사', null, '6~12개월'],
      ['np-loss-eval', '손해평가사', null, '3~6개월', '농작물재해보험 손해평가'],
      ['np-agri-q', '농산물품질관리사', null, '3~6개월'],
      ['np-fish-q', '수산물품질관리사', null, '3~6개월'],
    ],
  },
  {
    field: '안전/환경/에너지',
    org: QNET,
    rows: [
      ['np-ind-safety-guide', '산업안전지도사', null, '6~12개월'],
      ['np-ind-health-guide', '산업보건지도사', null, '6~12개월'],
      ['np-fire-mgr', '소방시설관리사', null, '1~2년'],
      ['np-fire-edu', '소방안전교육사', null, '3~6개월'],
      ['np-water-op', '정수시설운영관리사', '1~3급', '2~3개월'],
    ],
  },
  {
    field: '안전/환경/에너지',
    org: ['한국소방안전원', 'https://www.kfsi.or.kr'],
    rows: [
      ['np-fire2', '소방안전관리자 2급', '2급', '강습 + 2주'],
      ['np-fire3', '소방안전관리자 3급', '3급', '강습 + 1주'],
    ],
  },
  {
    field: '안전/환경/에너지',
    org: ['한국원자력안전재단', null],
    rows: [
      ['np-reactor-op', '원자로조종사면허', null, '6~12개월'],
      ['np-reactor-sv', '원자로조종감독자면허', null, '1년 이상'],
      ['np-ri', '방사성동위원소취급자 일반면허', null, '3~6개월'],
    ],
  },
  {
    field: '조리/미용/관광',
    org: QNET,
    rows: [
      ['np-hotel-ceo', '호텔경영사', null, '6개월'],
      ['np-hotel-svc', '호텔서비스사', null, '1~2개월'],
    ],
  },
  {
    field: '교육/상담/인문',
    org: QNET,
    rows: [
      ['np-curator', '박물관및미술관 준학예사', null, '6개월'],
      ['np-heritage', '문화재수리기술자', null, '1~2년'],
    ],
  },
  {
    field: '디자인/미디어',
    org: ['한국무대예술전문인자격검정위원회', null],
    rows: [['np-stage', '무대예술전문인', '1~3급', '2~3개월', '무대기계·조명·음향']],
  },
  {
    field: '농림/조경',
    org: ['산림청', null],
    rows: [
      ['np-tree-doctor', '나무의사', null, '6~12개월', '양성과정 수료 후 시험'],
      ['np-forest-heal', '산림치유지도사', '1·2급', '양성과정 + 1개월'],
    ],
  },
  {
    field: '보건/의료/복지',
    org: KUKSIWON,
    rows: [
      ['np-doctor', '의사 국가시험', null, '졸업 전 6~12개월'],
      ['np-dentist', '치과의사 국가시험', null, '졸업 전 6~12개월'],
      ['np-oriental', '한의사 국가시험', null, '졸업 전 6~12개월'],
      ['np-pharm', '약사 국가시험', null, '졸업 전 6~12개월'],
      ['np-herb-pharm', '한약사 국가시험', null, '졸업 전 6개월'],
      ['np-midwife', '조산사', null, '수련 1년 + 3개월'],
      ['np-radio', '방사선사', null, '졸업 전 4~6개월'],
      ['np-dhyg', '치과위생사', null, '졸업 전 4~6개월'],
      ['np-dtech', '치과기공사', null, '졸업 전 4~6개월'],
      ['np-ot', '작업치료사', null, '졸업 전 4~6개월'],
      ['np-optician', '안경사', null, '졸업 전 4~6개월'],
      ['np-prosth', '의지·보조기 기사', null, '졸업 전 4~6개월'],
      ['np-emt2', '응급구조사 2급', '2급', '교육 + 1~2개월'],
      ['np-slp', '언어재활사', '1·2급', '졸업 전 4~6개월'],
      ['np-rehab', '장애인재활상담사', '1~3급', '2~4개월'],
      ['np-mh-psy', '정신건강임상심리사', '1·2급', '수련 1~3년'],
    ],
  },
  {
    field: '보건/의료/복지',
    org: QNET,
    rows: [['np-sw-pass', '사회복지사 1급', '1급', '3~6개월']],
  },
  {
    field: '금융/부동산',
    org: ['보험개발원', null],
    rows: [
      ['np-actuary', '보험계리사', null, '1~2년'],
      ['np-adjuster', '손해사정사', null, '6~12개월'],
    ],
  },
  {
    field: '기타',
    org: KOTSA,
    rows: [
      ['mp-drone', '초경량비행장치 조종자 (드론)', '1~4종', '교육 1~3주', '1종(25kg 초과)~4종(250g~2kg). 종별 비행경력·교육 필요'],
      ['np-ulpilot', '경량항공기 조종사', null, '2~4개월'],
      ['np-ppl', '자가용 조종사', null, '6~12개월'],
      ['np-cpl', '사업용 조종사', null, '1~2년'],
      ['np-atpl', '운송용 조종사', null, '경력 필요'],
      ['np-atc', '항공교통관제사', null, '교육 1년'],
      ['np-amt', '항공정비사', null, '교육 2년 또는 경력'],
      ['np-dispatcher', '운항관리사', null, '6~12개월'],
      ['np-fe', '항공기관사', null, '경력 필요'],
      ['np-rail', '철도차량 운전면허', '고속·제1종·제2종 등', '교육 + 2~3개월'],
      ['np-traffic-safety', '교통안전관리자', null, '2~3개월'],
      ['np-car-eval', '자동차진단평가사', null, '1~2개월'],
      ['np-bus', '버스운전 자격', null, '1~2주'],
      ['np-taxi', '택시운전 자격', null, '1~2주'],
      ['np-cargo', '화물운송종사 자격', null, '1~2주'],
    ],
  },
  {
    field: '기타',
    org: SEAMAN,
    rows: [
      ['np-navi', '항해사', '1~6급', '교육 + 2~3개월'],
      ['np-engineer', '기관사', '1~6급', '교육 + 2~3개월'],
      ['np-small-boat', '소형선박조종사', null, '1~2개월'],
    ],
  },
  {
    field: '기타',
    org: ['해양경찰청', null],
    rows: [['np-water-leisure', '동력수상레저기구 조종면허', '일반 1·2급, 요트', '교육 1~2일 또는 2~4주']],
  },
  {
    field: '기타',
    org: KSPO,
    rows: [
      ['np-sport-life', '생활스포츠지도사 2급', '2급', '2~3개월'],
      ['np-sport-pro', '전문스포츠지도사 2급', '2급', '2~3개월'],
      ['np-sport-health', '건강운동관리사', null, '6개월'],
      ['np-sport-youth', '유소년스포츠지도사', null, '1~2개월'],
      ['np-sport-senior', '노인스포츠지도사', null, '1~2개월'],
      ['np-sport-dis', '장애인스포츠지도사 2급', '2급', '2~3개월'],
    ],
  },
  {
    field: '기타',
    org: ['기상청 (한국기상산업기술원)', null],
    rows: [
      ['np-forecaster', '기상예보사', null, '1년 이상'],
      ['np-weather-appr', '기상감정사', null, '6~12개월'],
    ],
  },
];

export const PRO_CERTS: PrivateCert[] = GROUPS.flatMap(({ field, org: [org, url], rows }) =>
  rows.map(([id, name, grade, prep, summary]) => ({ id, name, field, kind: '국가전문', grade, org, url, prep, summary, validity: '평생 (만료 없음)' })),
);

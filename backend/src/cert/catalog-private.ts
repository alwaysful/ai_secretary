/**
 * 국가공인 민간자격 + 유명 민간자격(국제자격 포함).
 * 값(응시료·준비기간·유효기간)은 참고값. url 모르면 null → 화면의 「일정 검색」 링크 사용.
 */
export interface PrivateCert {
  id: string;
  name: string;
  field: string;
  kind: string;
  grade: string | null;
  org: string;
  url: string | null;
  summary?: string;
  prep?: string;
  fee?: string;
  validity?: string;
}

type P = [id: string, name: string, grade: string | null, org: string, url: string | null, extra?: Partial<Pick<PrivateCert, 'summary' | 'prep' | 'fee' | 'validity' | 'kind'>>];

const KAIT = ['한국정보통신진흥협회', 'https://www.ihd.or.kr'] as const;
const ICQA = ['한국정보통신자격협회', 'https://www.icqa.or.kr'] as const;
const KORCHAM = ['대한상공회의소', 'https://license.korcham.net'] as const;
const KICPA = ['한국공인회계사회', 'https://license.kicpa.or.kr'] as const;
const KBI = ['한국금융연수원', 'https://www.kbi.or.kr'] as const;
const KOFIA = ['금융투자협회', 'https://license.kofia.or.kr'] as const;
const DATAQ = ['한국데이터산업진흥원', 'https://www.dataq.or.kr'] as const;
const KPC = ['한국생산성본부', 'https://license.kpc.or.kr'] as const;

/** 국가공인 민간자격 (분야별) */
const PUBLIC: Record<string, P[]> = {
  '정보통신/IT': [
    ['pv-linux1', '리눅스마스터 1급', '1급', ...KAIT, { prep: '2~3개월' }],
    ['pv-net1', '네트워크관리사 1급', '1급', ...ICQA, { kind: '민간', prep: '2~3개월' }],
    ['pv-pc', 'PC정비사', '1·2급', ...ICQA, { prep: '1개월' }],
    ['pv-iim', '인터넷정보관리사', '전문가·1·2급', ...KAIT, { kind: '민간', prep: '1개월' }],
    ['pv-diat', 'DIAT (디지털정보활용능력)', null, ...KAIT, { prep: '2~4주', summary: '한글·엑셀·PPT·인터넷 과목별' }],
    ['pv-itpm', '정보기술프로젝트관리전문가 (IT-PMP)', null, ...KAIT, { prep: '1~2개월' }],
    ['pv-isa', '정보시스템감리사', null, '한국지능정보사회진흥원', 'https://www.nia.or.kr', { prep: '6~12개월', summary: '정보시스템 감리 전문 인력' }],
    ['pv-dap', 'DAP (데이터아키텍처 전문가)', null, ...DATAQ, { prep: '3~6개월', fee: '필기·실기 각 100,000원', validity: '없음' }],
    ['pv-dasp', 'DAsP (데이터아키텍처 준전문가)', null, ...DATAQ, { kind: '민간', prep: '1~2개월', fee: '50,000원', validity: '없음' }],
    ['pv-etest', 'e-Test Professionals', null, 'e-Test', 'https://www.e-test.co.kr', { prep: '2~4주' }],
  ],
  '경영/사무/OA': [
    ['pv-trade', '국제무역사', '1급', '한국무역협회', 'https://www.tradecampus.com', { kind: '민간', prep: '2~3개월', summary: '무역 실무·법규' }],
    ['pv-tradeeng', '무역영어', '1~3급', ...KORCHAM, { prep: '1~2개월' }],
    ['pv-docs', '문서실무사', '1~3급', '한국정보관리협회', null, { kind: '민간', prep: '2~4주' }],
    ['pv-admin', '행정관리사', '1~3급', '한국행정관리협회', null, { prep: '1~2개월' }],
    ['pv-itq-ad', 'ITQ OA Master', null, ...KPC, { kind: '민간', prep: '1~2개월', summary: 'ITQ 3과목 A등급' }],
    ['pv-erp1', 'ERP 정보관리사 1급', '1급', ...KPC, { prep: '1~2개월' }],
  ],
  '회계/세무': [
    ['pv-tat1', 'TAT (세무실무) 1급', '1급', ...KICPA, { prep: '2~3개월' }],
    ['pv-tat2', 'TAT (세무실무) 2급', '2급', ...KICPA, { prep: '1~2개월' }],
    ['pv-fat1', 'FAT (회계실무) 1급', '1급', ...KICPA, { prep: '1개월' }],
    ['pv-fat2', 'FAT (회계실무) 2급', '2급', ...KICPA, { prep: '2~4주' }],
    ['pv-ca2', '전산회계 2급', '2급', '한국세무사회', 'https://license.kacpta.or.kr', { prep: '2~4주' }],
    ['pv-ct1', '전산세무 1급', '1급', '한국세무사회', 'https://license.kacpta.or.kr', { prep: '3~6개월' }],
    ['pv-acc2', '회계관리 2급', '2급', '삼일회계법인', 'https://www.samilexam.com', { prep: '2~4주' }],
    ['pv-biz-acc', '기업회계', '1~3급', '한국세무사회', 'https://license.kacpta.or.kr', { kind: '민간', prep: '1~3개월' }],
    ['pv-tax-acc', '세무회계', '1~3급', '한국세무사회', 'https://license.kacpta.or.kr', { prep: '1~3개월' }],
  ],
  '금융/부동산': [
    ['pv-cra', '신용위험분석사 (CRA)', null, ...KBI, { prep: '3~4개월' }],
    ['pv-intfin', '국제금융역', null, ...KBI, { prep: '2~3개월' }],
    ['pv-fp', '자산관리사 (은행FP)', null, ...KBI, { prep: '2~3개월' }],
    ['pv-fx1', '외환전문역 1종', '1종', ...KBI, { prep: '1~2개월' }],
    ['pv-fx2', '외환전문역 2종', '2종', ...KBI, { prep: '1~2개월' }],
    ['pv-credit-mgr', '신용관리사', null, ...KBI, { prep: '1~2개월' }],
    ['pv-deriv', '파생상품투자권유자문인력', null, ...KOFIA, { kind: '민간', prep: '1~2개월' }],
  ],
  '교육/상담/인문': [
    ['pv-kbs', 'KBS 한국어능력시험', '1~4급', 'KBS', null, { prep: '1~2개월', summary: '언론사·공기업 가산점', validity: '2년' }],
    ['pv-tokl', '국어능력인증시험 (ToKL)', null, '한국언어문화연구원', null, { kind: '민간', prep: '1~2개월', validity: '2년' }],
    ['pv-hanja-kh', '한자급수자격검정', '사범~8급', '대한검정회', null, { prep: '급수별 2주~3개월', validity: '없음' }],
  ],
};

/** 유명 민간자격·국제자격 (분야별) */
const POPULAR: Record<string, P[]> = {
  '정보통신/IT': [
    ['mp-ccna', 'CCNA', null, 'Cisco', 'https://www.cisco.com/site/us/en/learn/training-certifications/', { prep: '2~3개월', fee: 'US$300', validity: '3년' }],
    ['mp-ccnp', 'CCNP Enterprise', null, 'Cisco', 'https://www.cisco.com/site/us/en/learn/training-certifications/', { prep: '4~6개월', fee: '시험별 US$400 안팎', validity: '3년' }],
    ['mp-aws-ccp', 'AWS Cloud Practitioner', null, 'Amazon Web Services', 'https://aws.amazon.com/certification/', { prep: '2~4주', fee: 'US$100', validity: '3년' }],
    ['mp-aws-dva', 'AWS Developer Associate', null, 'Amazon Web Services', 'https://aws.amazon.com/certification/', { prep: '1~2개월', fee: 'US$150', validity: '3년' }],
    ['mp-aws-sap', 'AWS Solutions Architect Professional', null, 'Amazon Web Services', 'https://aws.amazon.com/certification/', { prep: '2~4개월', fee: 'US$300', validity: '3년' }],
    ['mp-az900', 'Azure Fundamentals (AZ-900)', null, 'Microsoft', 'https://learn.microsoft.com/credentials/', { prep: '2~3주', fee: 'US$99 (국가별 상이)', validity: '없음' }],
    ['mp-az104', 'Azure Administrator (AZ-104)', null, 'Microsoft', 'https://learn.microsoft.com/credentials/', { prep: '1~2개월', fee: 'US$165 (국가별 상이)', validity: '1년 (무료 온라인 갱신)' }],
    ['mp-gcp-ace', 'Google Cloud Associate Cloud Engineer', null, 'Google Cloud', 'https://cloud.google.com/learn/certification', { prep: '1~2개월', fee: 'US$125', validity: '3년' }],
    ['mp-ckad', 'CKAD (Kubernetes 개발자)', null, 'Linux Foundation', 'https://training.linuxfoundation.org', { prep: '1~2개월', fee: 'US$445', validity: '2년' }],
    ['mp-cissp', 'CISSP', null, 'ISC2', 'https://www.isc2.org', { prep: '3~6개월', fee: 'US$749', validity: '3년 (CPE로 유지)', summary: '보안 실무 경력 5년 필요' }],
    ['mp-cisa', 'CISA', null, 'ISACA', 'https://www.isaca.org', { prep: '3~4개월', fee: 'US$575~760', validity: '3년 (CPE로 유지)', summary: 'IT 감사' }],
    ['mp-ceh', 'CEH (윤리적 해커)', null, 'EC-Council', 'https://www.eccouncil.org', { prep: '2~3개월', validity: '3년' }],
    ['mp-ocp-java', 'OCP Java SE Developer', null, 'Oracle', 'https://education.oracle.com', { prep: '2~3개월', fee: 'US$245', validity: '없음' }],
    ['mp-rhcsa', 'RHCSA (Red Hat 시스템 관리자)', null, 'Red Hat', 'https://www.redhat.com/ko/services/certification', { prep: '2~3개월', validity: '3년' }],
    ['mp-lpic1', 'LPIC-1', null, 'Linux Professional Institute', 'https://www.lpi.org', { prep: '1~2개월', fee: '시험당 US$200', validity: '5년' }],
    ['mp-cospro', 'COS Pro (코딩 전문가)', '1·2급', 'YBM', 'https://www.ybmit.com', { prep: '1~2개월' }],
    ['mp-kait-sa', '검색광고마케터', '1·2급', ...KAIT, { prep: '2~4주', summary: '최근 5년 취득 약 1.1만명' }],
    ['mp-kait-sns', 'SNS광고마케터', '1급', ...KAIT, { prep: '2~4주', summary: '최근 5년 취득 약 4천명' }],
    ['mp-cdt', '코딩창의개발능력(CDT)', '1~3급', '창의융합인재교육원', null, { prep: '1~2개월', summary: '초·중등 코딩. 최근 5년 취득 약 4.4만명' }],
    ['mp-kpc-sw', 'SW코딩자격', '1~3급', ...KPC, { prep: '1개월', summary: '최근 5년 취득 약 1.6만명' }],
    ['mp-aipot', 'AI-POT (AI 프롬프트 활용능력)', '1·2급', ...KPC, { prep: '2~3주', summary: '생성형 AI 활용. 2025년 취득 약 3천명' }],
    ['mp-aidata', '인공지능학습데이터전문가', '1·2급', '한국인공지능협회', null, { prep: '2~4주', summary: '데이터 라벨링. 최근 5년 취득 약 2.2만명' }],
    ['mp-prods', 'ProDS (데이터 사이언스)', 'Associate~Professional', '멀티캠퍼스', null, { prep: '1~2개월', summary: '최근 5년 취득 약 6천명' }],
    ['mp-cppg', 'CPPG (개인정보관리사)', null, '한국CPO포럼', null, { prep: '1~2개월', summary: '개인정보보호 실무. 최근 5년 취득 약 4천명' }],
  ],
  '경영/사무/OA': [
    ['mp-pmp', 'PMP (프로젝트관리 전문가)', null, 'PMI', 'https://www.pmi.org', { prep: '2~3개월', fee: 'US$405 (회원) / US$575', validity: '3년 (PDU로 유지)' }],
    ['mp-6sigma', '6시그마 그린벨트', null, '한국표준협회 등', null, { prep: '교육 + 1개월' }],
    ['mp-csl', 'CS Leaders (관리사)', null, '한국정보평가협회', null, { prep: '2~4주', summary: '서비스·고객관리' }],
    ['mp-gaiq', 'Google Analytics 인증', null, 'Google', 'https://skillshop.withgoogle.com', { prep: '1~2주', fee: '무료', validity: '1년' }],
    ['mp-mos', 'MOS (Microsoft Office Specialist)', null, 'Microsoft · YBM', null, { prep: '2~4주', validity: '없음' }],
    ['mp-organize', '정리수납전문가', '1·2급', '한국정리수납협회', null, { prep: '교육 과정', summary: '최근 5년 취득 약 3.3만명' }],
    ['mp-kac', 'KAC (인증코치)', null, '한국코치협회', null, { prep: '교육 + 코칭 실습', validity: '3년 (갱신)', summary: '최근 5년 취득 약 9천명' }],
    ['mp-esg', '한경협 ESG 전문가', null, '국제경영원', null, { prep: '교육 과정', summary: '최근 5년 취득 약 4천명' }],
  ],
  '회계/세무': [
    ['mp-aicpa', 'AICPA (미국공인회계사)', null, 'AICPA·NASBA', 'https://nasba.org', { prep: '1~2년', fee: '과목당 약 US$260 + 원서비', validity: '면허는 주별 갱신' }],
    ['mp-cma', 'CMA (미국관리회계사)', null, 'IMA', 'https://www.imanet.org', { prep: '6~12개월', validity: '평생 (연 CPE)' }],
  ],
  '금융/부동산': [
    ['mp-frm', 'FRM (재무위험관리사)', 'Part 1·2', 'GARP', 'https://www.garp.org', { prep: '파트당 3~6개월', validity: '평생' }],
    ['mp-cfp', 'CFP (국제공인재무설계사)', null, '한국FPSB', 'https://www.fpsbkorea.org', { prep: '6~12개월', validity: '2년 (계속교육으로 갱신)' }],
    ['mp-teller', '은행텔러', null, ...KBI, { prep: '2~4주' }],
    ['mp-fund-agent', '펀드투자권유대행인', null, ...KOFIA, { prep: '2~3주', summary: '최근 5년 취득 약 9천명' }],
    ['mp-sec-agent', '증권투자권유대행인', null, ...KOFIA, { prep: '2~3주', summary: '최근 5년 취득 약 7천명' }],
    ['mp-comp', '영업점컴플라이언스오피서(은행)', null, ...KBI, { prep: '3~4주', summary: '최근 5년 취득 약 4천명' }],
  ],
  '디자인/미디어': [
    ['mp-acp', 'Adobe Certified Professional', null, 'Adobe', 'https://certifiedprofessional.adobe.com', { prep: '2~4주', validity: '3년' }],
    ['mp-gtq2', 'GTQ (그래픽기술자격) 2급', '2급', ...KPC, { prep: '2주' }],
    ['mp-gtqi', 'GTQi (일러스트)', null, ...KPC, { prep: '2~3주' }],
    ['mp-gtqid', 'GTQid (인디자인)', '1·2급', ...KPC, { prep: '2~3주', summary: '최근 5년 취득 약 1.2만명' }],
  ],
  '보건/의료/복지': [
    ['mp-hosp', '병원행정사', null, '여러 협회', null, { prep: '1~2개월' }],
    ['mp-coord', '병원코디네이터', null, '여러 협회', null, { prep: '1개월' }],
    ['mp-pet', '반려동물관리사', null, '여러 협회', null, { prep: '1~2개월' }],
    ['mp-dental-ins', '치과보험청구사', '1~3급', '대한치과건강보험협회', null, { prep: '1~2개월', summary: '치과 건강보험 청구. 최근 5년 취득 약 2.2만명' }],
  ],
  '교육/상담/인문': [
    ['mp-psy', '심리상담사', null, '여러 협회', null, { prep: '1~3개월', summary: '발급 기관마다 공신력 차이 큼' }],
    ['mp-piano', '음악실기급수 (피아노)', '1~12급', '한국학원총연합회', null, { prep: '급수별 상이', summary: '최근 5년 취득 약 11만명 (실용피아노 포함)' }],
    ['mp-abacus', '주산암산', '급·단', '한국주산협회', null, { prep: '급수별 상이', summary: '최근 5년 취득 약 6.5만명' }],
    ['mp-sv-counsel', '학교폭력상담사', '1~3급', '푸른나무재단', null, { prep: '교육 과정', summary: '최근 5년 취득 약 1.3만명' }],
    ['mp-origami', '종이접기 (강사·사범)', null, '종이문화재단', null, { prep: '교육 과정', summary: '최근 5년 취득 약 1만명' }],
  ],
  '조리/미용/관광': [
    ['mp-somm', '소믈리에', null, '여러 협회', null, { prep: '2~3개월' }],
    ['mp-barista1', '바리스타 1급', '1급', '한국커피협회', 'https://www.kca-coffee.org', { prep: '2~3개월' }],
    ['mp-barista2', '바리스타 2급', '2급', '한국커피협회', 'https://www.kca-coffee.org', { prep: '1~2개월', summary: '한국커피협회 바리스타 1·2급 최근 5년 취득 약 14만명' }],
    ['mp-topas', '항공예약·발권 (TOPAS)', '1·2급', '토파스여행정보', null, { prep: '1~2개월', summary: '여행사·항공사 취업. 최근 5년 취득 약 2.8만명' }],
    ['mp-sabre', '항공예약·발권 (세이버)', '1·2급', '한진세이버', null, { prep: '1~2개월', summary: '최근 5년 취득 약 1.5만명' }],
    ['mp-dog-groom', '애견미용사', '1~3급', '한국애견연맹', null, { prep: '3~6개월', summary: '최근 5년 취득 약 2.7만명' }],
  ],
  '전기/전자': [
    ['mp-dist', '배전활선전공 (배전공사기능자격)', null, '대한전기산업연합회', null, { prep: '교육 과정', summary: '한전 배전공사 협력사 현장 인력 필수' }],
  ],
  기타: [
    ['mp-swim', '수영능력검정', 'Level 1~10', '대한수영협회', null, { prep: '실력별 상이', summary: '최근 5년 취득 약 5만명' }],
    ['mp-lifeguard', '수상안전요원', '1~3급', '한국수영장경영자협회', null, { prep: '교육 과정', validity: '2년 (보수교육)', summary: '수영장 안전요원' }],
    ['mp-scuba', '스쿠버다이빙 (PADI·PTRD 등)', null, '여러 단체', null, { prep: '3~5일 교육', summary: '단체별 등급 (오픈워터~강사)' }],
    ['mp-parkgolf', '파크골프지도자', '1·2급', '대한파크골프협회', null, { prep: '교육 과정', summary: '최근 5년 취득 약 2.8만명' }],
    ['mp-ski', '스키지도자 (알파인)', 'Level 1~3', '대한스키스노보드협회', null, { prep: '시즌 단위', summary: '최근 5년 취득 약 9천명' }],
    ['mp-tkd', '국제태권도사범', '1~3급', '국기원', 'https://www.kukkiwon.or.kr', { prep: '교육 과정', summary: '최근 5년 취득 약 5천명' }],
    ['mp-baduk', '바둑 아마 급·단증', '1~30급', '한국기원', null, { prep: '실력별 상이', summary: '최근 5년 취득 약 2.5만명' }],
  ],
};

const build = (src: Record<string, P[]>, kind: string): PrivateCert[] =>
  Object.entries(src).flatMap(([field, rows]) =>
    rows.map(([id, name, grade, org, url, x]) => ({ id, name, field, kind, grade, org, url, ...(x ?? {}) })),
  );

export const PRIVATE_CERTS: PrivateCert[] = [...build(PUBLIC, '국가공인민간'), ...build(POPULAR, '민간')];

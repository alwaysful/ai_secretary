/** 자격증 분야 (공모전 분야 태그처럼 고정 목록) */
export const CERT_FIELDS = [
  '정보통신/IT',
  '전기/전자',
  '기계/자동차',
  '건설/건축',
  '안전/환경/에너지',
  '화학/식품/바이오',
  '경영/사무/OA',
  '회계/세무',
  '금융/부동산',
  '법률/행정',
  '보건/의료/복지',
  '교육/상담/인문',
  '디자인/미디어',
  '조리/미용/관광',
  '농림/조경',
  '어학',
  '기타',
] as const;

export const CERT_KINDS = ['국가기술', '국가전문', '국가공인민간', '민간', '어학'] as const;

/** Q-net 정기 일정 묶음. 상시 = 수시 접수(회차 일정 없음) */
export const SERIES_LABEL: Record<string, string> = {
  'qnet-기술사': 'Q-net 정기 기술사',
  'qnet-기능장': 'Q-net 정기 기능장',
  'qnet-기사': 'Q-net 정기 기사·산업기사',
  'qnet-기능사': 'Q-net 정기 기능사',
  'qnet-상시': 'Q-net 상시 시험',
};

export interface CatalogCert {
  id: string;
  name: string;
  field: string;
  kind: string;
  grade: string | null;
  org: string;
  url: string;
  series: string | null;
  summary: string | null;
}

const QNET = 'https://www.q-net.or.kr';
const HRD = '한국산업인력공단';
const KORCHAM = 'https://license.korcham.net';
const KPC = 'https://license.kpc.or.kr';
const DATAQ = 'https://www.dataq.or.kr';
const KUKSIWON = 'https://www.kuksiwon.or.kr';
const CQ = 'https://www.cq.or.kr';

type Row = [id: string, name: string, kind: string, grade: string | null, org: string, url: string, series: string | null, summary?: string];

/** 등급에 맞는 Q-net 정기 묶음 */
const qs = (grade: string) =>
  grade === '기술사' ? 'qnet-기술사' : grade === '기능장' ? 'qnet-기능장' : grade === '기능사' ? 'qnet-기능사' : 'qnet-기사';

/** Q-net 국가기술 한 줄 */
const q = (id: string, name: string, grade: string, summary?: string): Row => [id, name, '국가기술', grade, HRD, QNET, qs(grade), summary];
/** Q-net 상시 기능사 */
const qa = (id: string, name: string, summary?: string): Row => [id, name, '국가기술', '기능사', HRD, QNET, 'qnet-상시', summary];
/** Q-net 시행 국가전문 */
const qp = (id: string, name: string, summary?: string): Row => [id, name, '국가전문', null, HRD, QNET, null, summary];

const DATA: Record<string, Row[]> = {
  '정보통신/IT': [
    q('it-ipe', '정보처리기사', '기사', 'SW 개발·DB·네트워크 전반. 개발자 기본 자격'),
    q('it-ipie', '정보처리산업기사', '산업기사'),
    q('it-ipc', '정보처리기능사', '기능사'),
    q('it-pe-im', '정보관리기술사', '기술사'),
    q('it-pe-cs', '컴퓨터시스템응용기술사', '기술사'),
    ['it-sec', '정보보안기사', '국가기술', '기사', '한국인터넷진흥원', 'https://www.kisq.or.kr', null, '보안 실무. 필기·실기'],
    ['it-sec2', '정보보안산업기사', '국가기술', '산업기사', '한국인터넷진흥원', 'https://www.kisq.or.kr', null],
    ['it-bigdata', '빅데이터분석기사', '국가기술', '기사', '한국데이터산업진흥원', DATAQ, null, '통계·머신러닝·분석 실기(R/Python)'],
    ['it-sqld', 'SQLD (SQL 개발자)', '국가공인민간', null, '한국데이터산업진흥원', DATAQ, null],
    ['it-sqlp', 'SQLP (SQL 전문가)', '국가공인민간', null, '한국데이터산업진흥원', DATAQ, null],
    ['it-adsp', 'ADsP (데이터분석 준전문가)', '국가공인민간', null, '한국데이터산업진흥원', DATAQ, null],
    ['it-adp', 'ADP (데이터분석 전문가)', '국가공인민간', null, '한국데이터산업진흥원', DATAQ, null],
    ['it-comm', '정보통신기사', '국가기술', '기사', '한국방송통신전파진흥원', CQ, null],
    ['it-radio', '무선설비기사', '국가기술', '기사', '한국방송통신전파진흥원', CQ, null],
    ['it-linux', '리눅스마스터 2급', '국가공인민간', '2급', '한국정보통신진흥협회', 'https://www.ihd.or.kr', null],
    ['it-net', '네트워크관리사 2급', '국가공인민간', '2급', '한국정보통신자격협회', 'https://www.icqa.or.kr', null],
    ['it-aws-saa', 'AWS Solutions Architect Associate', '민간', null, 'Amazon Web Services', 'https://aws.amazon.com/certification/', null, '클라우드 설계. 상시 응시(온라인·테스트센터)'],
    ['it-cka', 'CKA (Kubernetes 관리자)', '민간', null, 'Linux Foundation', 'https://training.linuxfoundation.org', null, '상시 온라인 실기'],
  ],
  '전기/전자': [
    q('el-ee', '전기기사', '기사', '전기 설계·시공·감리. 수요 많음'),
    q('el-eie', '전기산업기사', '산업기사'),
    q('el-ec', '전기기능사', '기능사'),
    q('el-ew', '전기공사기사', '기사'),
    q('el-ewi', '전기공사산업기사', '산업기사'),
    q('el-fire-e', '소방설비기사(전기분야)', '기사'),
    q('el-elec', '전자기사', '기사'),
    q('el-elecie', '전자산업기사', '산업기사'),
    q('el-pe-bp', '발송배전기술사', '기술사'),
    q('el-master', '전기기능장', '기능장'),
  ],
  '기계/자동차': [
    q('me-gm', '일반기계기사', '기사'),
    q('me-design', '기계설계산업기사', '산업기사'),
    q('me-cm', '건설기계설비기사', '기사'),
    q('me-hvac', '공조냉동기계기사', '기사'),
    q('me-mecha', '메카트로닉스기사', '기사'),
    q('me-fire-m', '소방설비기사(기계분야)', '기사'),
    q('me-car', '자동차정비기사', '기사'),
    q('me-cari', '자동차정비산업기사', '산업기사'),
    q('me-carc', '자동차정비기능사', '기능사'),
    q('me-lathe', '컴퓨터응용선반기능사', '기능사'),
    q('me-weld', '용접기능사', '기능사'),
    qa('me-forklift', '지게차운전기능사'),
    qa('me-excav', '굴착기운전기능사'),
  ],
  '건설/건축': [
    q('cv-arch', '건축기사', '기사'),
    q('cv-archi', '건축산업기사', '산업기사'),
    q('cv-civil', '토목기사', '기사'),
    q('cv-survey', '측량및지형공간정보기사', '기사'),
    q('cv-interior', '실내건축기사', '기사'),
    q('cv-archeq', '건축설비기사', '기사'),
    q('cv-urban', '도시계획기사', '기사'),
    q('cv-concrete', '콘크리트기사', '기사'),
    qp('cv-housing', '주택관리사(보)', '공동주택 관리. 1·2차'),
    ['cv-architect', '건축사', '국가전문', null, '대한건축사협회', 'https://www.kira.or.kr', null],
  ],
  '안전/환경/에너지': [
    q('sf-ind', '산업안전기사', '기사', '안전관리자 선임 요건'),
    q('sf-indi', '산업안전산업기사', '산업기사'),
    q('sf-cons', '건설안전기사', '기사'),
    q('sf-hyg', '산업위생관리기사', '기사'),
    q('sf-haz', '위험물산업기사', '산업기사'),
    q('sf-hazc', '위험물기능사', '기능사'),
    q('sf-gas', '가스기사', '기사'),
    q('sf-air', '대기환경기사', '기사'),
    q('sf-water', '수질환경기사', '기사'),
    q('sf-waste', '폐기물처리기사', '기사'),
    q('sf-noise', '소음진동기사', '기사'),
    q('sf-energy', '에너지관리기사', '기사'),
    q('sf-solar', '신재생에너지발전설비기사(태양광)', '기사'),
    q('sf-ghg', '온실가스관리기사', '기사'),
    q('sf-weather', '기상기사', '기사'),
    ['sf-fire1', '소방안전관리자 1급', '국가전문', '1급', '한국소방안전원', 'https://www.kfsi.or.kr', null, '강습 수료 후 시험'],
  ],
  '화학/식품/바이오': [
    q('ch-chem', '화공기사', '기사'),
    q('ch-anal', '화학분석기사', '기사'),
    q('ch-food', '식품기사', '기사'),
    q('ch-foodi', '식품산업기사', '산업기사'),
    q('ch-bio', '바이오화학제품제조기사', '기사'),
  ],
  '경영/사무/OA': [
    ['of-cos1', '컴퓨터활용능력 1급', '국가기술', '1급', '대한상공회의소', KORCHAM, null, '엑셀·액세스. 상시 시험'],
    ['of-cos2', '컴퓨터활용능력 2급', '국가기술', '2급', '대한상공회의소', KORCHAM, null, '상시 시험'],
    ['of-word', '워드프로세서', '국가기술', null, '대한상공회의소', KORCHAM, null],
    ['of-itq', 'ITQ (정보기술자격)', '국가공인민간', null, '한국생산성본부', KPC, null, '한글·엑셀·파워포인트'],
    ['of-erp', 'ERP 정보관리사', '국가공인민간', null, '한국생산성본부', KPC, null],
    ['of-dist2', '유통관리사 2급', '국가전문', '2급', '대한상공회의소', KORCHAM, null],
    ['of-sec2', '비서 2급', '국가기술', '2급', '대한상공회의소', KORCHAM, null],
    q('of-quality', '품질경영기사', '기사'),
    q('of-survey', '사회조사분석사 2급', '2급', '설문·통계 분석'),
    q('of-conv', '컨벤션기획사 2급', '2급'),
    qp('of-logis', '물류관리사'),
    qp('of-mgmt', '경영지도사'),
  ],
  '회계/세무': [
    ['ac-cpa', '공인회계사 (CPA)', '국가전문', null, '금융감독원', 'https://cpa.fss.or.kr', null],
    qp('ac-tax', '세무사'),
    ['ac-ca1', '전산회계 1급', '국가공인민간', '1급', '한국세무사회', 'https://license.kacpta.or.kr', null],
    ['ac-ct2', '전산세무 2급', '국가공인민간', '2급', '한국세무사회', 'https://license.kacpta.or.kr', null],
    ['ac-fin', '재경관리사', '국가공인민간', null, '삼일회계법인', 'https://www.samilexam.com', null],
    ['ac-acc1', '회계관리 1급', '국가공인민간', '1급', '삼일회계법인', 'https://www.samilexam.com', null],
  ],
  '금융/부동산': [
    ['fn-invest', '투자자산운용사', '국가공인민간', null, '금융투자협회', 'https://license.kofia.or.kr', null],
    ['fn-fund', '펀드투자권유자문인력', '민간', null, '금융투자협회', 'https://license.kofia.or.kr', null],
    ['fn-sec', '증권투자권유자문인력', '민간', null, '금융투자협회', 'https://license.kofia.or.kr', null],
    ['fn-credit', '신용분석사', '국가공인민간', null, '한국금융연수원', 'https://www.kbi.or.kr', null],
    ['fn-afpk', 'AFPK', '민간', null, '한국FPSB', 'https://www.fpsbkorea.org', null],
    ['fn-cfa', 'CFA', '민간', null, 'CFA Institute', 'https://www.cfainstitute.org', null],
    qp('fn-realtor', '공인중개사', '부동산 중개. 1·2차 동시 응시 가능'),
    qp('fn-apprais', '감정평가사'),
  ],
  '법률/행정': [
    ['lw-bar', '변호사시험', '국가전문', null, '법무부', 'https://www.moj.go.kr', null],
    qp('lw-patent', '변리사'),
    qp('lw-customs', '관세사'),
    qp('lw-labor', '공인노무사'),
    qp('lw-admin', '행정사'),
    ['lw-judicial', '법무사', '국가전문', null, '법원행정처', 'https://www.scourt.go.kr', null],
  ],
  '보건/의료/복지': [
    qp('hc-sw1', '사회복지사 1급'),
    ['hc-nurse', '간호사 국가시험', '국가전문', null, '한국보건의료인국가시험원', KUKSIWON, null],
    ['hc-diet', '영양사', '국가전문', null, '한국보건의료인국가시험원', KUKSIWON, null],
    ['hc-pt', '물리치료사', '국가전문', null, '한국보건의료인국가시험원', KUKSIWON, null],
    ['hc-clin', '임상병리사', '국가전문', null, '한국보건의료인국가시험원', KUKSIWON, null],
    ['hc-him', '보건의료정보관리사', '국가전문', null, '한국보건의료인국가시험원', KUKSIWON, null],
    ['hc-sanit', '위생사', '국가전문', null, '한국보건의료인국가시험원', KUKSIWON, null],
    ['hc-emt1', '응급구조사 1급', '국가전문', '1급', '한국보건의료인국가시험원', KUKSIWON, null],
    ['hc-care', '요양보호사', '국가전문', null, '한국보건의료인국가시험원', KUKSIWON, null],
    ['hc-hedu', '보건교육사', '국가전문', null, '한국보건의료인국가시험원', KUKSIWON, null],
  ],
  '교육/상담/인문': [
    ['ed-history', '한국사능력검정시험', '국가전문', null, '국사편찬위원회', 'https://www.historyexam.go.kr', null, '공무원·공기업 가산점'],
    ['ed-hanja', '한자능력검정시험', '국가공인민간', null, '한국어문회', 'https://www.hanja.re.kr', null],
    q('ed-job2', '직업상담사 2급', '2급'),
    q('ed-clinpsy2', '임상심리사 2급', '2급'),
    qp('ed-youthcoun', '청소년상담사'),
    qp('ed-youthguide', '청소년지도사'),
    qp('ed-korteach', '한국어교육능력검정시험'),
  ],
  '디자인/미디어': [
    q('ds-color', '컬러리스트기사', '기사'),
    q('ds-visual', '시각디자인기사', '기사'),
    q('ds-visuali', '시각디자인산업기사', '산업기사'),
    q('ds-product', '제품디자인기사', '기사'),
    q('ds-web', '웹디자인기능사', '기능사'),
    q('ds-cg', '컴퓨터그래픽스운용기능사', '기능사'),
    q('ds-photo', '사진기능사', '기능사'),
    ['ds-gtq', 'GTQ (그래픽기술자격) 1급', '국가공인민간', '1급', '한국생산성본부', KPC, null, '포토샵'],
  ],
  '조리/미용/관광': [
    qa('ck-kor', '한식조리기능사'),
    qa('ck-west', '양식조리기능사'),
    qa('ck-chn', '중식조리기능사'),
    qa('ck-jpn', '일식조리기능사'),
    qa('ck-pastry', '제과기능사'),
    qa('ck-bread', '제빵기능사'),
    qa('ck-bar', '조주기능사'),
    qa('bt-hair', '미용사(일반)'),
    qa('bt-skin', '미용사(피부)'),
    qa('bt-nail', '미용사(네일)'),
    ['ck-barista', '바리스타 2급', '민간', '2급', '한국커피협회', 'https://www.kca-coffee.org', null],
    qp('tr-guide', '관광통역안내사', '외국어 시험 성적 필요'),
    qp('tr-domestic', '국내여행안내사'),
    qp('tr-hotel', '호텔관리사'),
  ],
  '농림/조경': [
    q('ag-land', '조경기사', '기사'),
    q('ag-landc', '조경기능사', '기능사'),
    q('ag-forest', '산림기사', '기사'),
    q('ag-plant', '식물보호기사', '기사'),
    q('ag-organic', '유기농업기능사', '기능사'),
    q('ag-flower', '화훼장식기능사', '기능사'),
  ],
  어학: [
    ['ln-toeic', 'TOEIC', '어학', null, 'YBM 한국TOEIC위원회', 'https://www.toeic.co.kr', null, '취업 영어 기본'],
    ['ln-toeics', 'TOEIC Speaking', '어학', null, 'YBM 한국TOEIC위원회', 'https://www.toeic.co.kr', null],
    ['ln-opic', 'OPIc', '어학', null, '멀티캠퍼스', 'https://www.opic.or.kr', null],
    ['ln-teps', 'TEPS', '어학', null, '서울대 TEPS관리위원회', 'https://www.teps.or.kr', null],
    ['ln-toefl', 'TOEFL iBT', '어학', null, 'ETS', 'https://www.ets.org/toefl', null, '유학'],
    ['ln-ielts', 'IELTS', '어학', null, 'British Council·IDP', 'https://www.ielts.org', null, '유학·이민'],
    ['ln-jlpt', 'JLPT (일본어능력시험)', '어학', 'N1~N5', '일본국제교류기금', 'https://www.jlpt.or.kr', null, '7월·12월 연 2회'],
    ['ln-jpt', 'JPT', '어학', null, 'YBM', 'https://www.jpt.co.kr', null],
    ['ln-hsk', 'HSK (중국어)', '어학', '1~6급', '중국 국가한반', 'https://www.hsk.or.kr', null],
    ['ln-topik', 'TOPIK (한국어능력시험)', '어학', null, '국립국제교육원', 'https://www.topik.go.kr', null],
  ],
};

export const CATALOG: CatalogCert[] = Object.entries(DATA).flatMap(([field, rows]) =>
  rows.map(([id, name, kind, grade, org, url, series, summary]) => ({ id, name, field, kind, grade, org, url, series, summary: summary ?? null })),
);

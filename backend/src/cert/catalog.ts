import { PRIVATE_CERTS } from './catalog-private';
import { PRO_CERTS } from './catalog-pro';
import { otherOrg, QGrade, QNET_ALL, QNET_ALWAYS } from './catalog-qnet';

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
  url: string | null;
  series: string | null;
  summary: string | null;
  /** 평균 준비기간 (참고값) */
  prep: string | null;
  /** 응시료 (참고값) */
  fee: string | null;
  /** 유효기간 (참고값) */
  validity: string | null;
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
    ['ln-toeicb', 'TOEIC Bridge', '어학', null, 'YBM 한국TOEIC위원회', 'https://www.toeic.co.kr', null, '입문 영어'],
    ['ln-gtelp', 'G-TELP', '어학', 'Level 1~5', '한국 G-TELP 위원회', 'https://www.g-telp.co.kr', null, '공무원·군무원 영어 대체'],
    ['ln-flex', 'FLEX (외국어능력시험)', '어학', null, '한국외국어대학교', 'https://flex.hufs.ac.kr', null, '영어·중국어·일본어·스페인어 등 다언어'],
    ['ln-pte', 'PTE Academic', '어학', null, 'Pearson', 'https://www.pearsonpte.com', null, '유학·이민. 컴퓨터 시험'],
    ['ln-det', 'Duolingo English Test', '어학', null, 'Duolingo', 'https://englishtest.duolingo.com', null, '온라인 응시'],
    ['ln-cae', 'Cambridge C1 Advanced', '어학', 'C1', 'Cambridge English', 'https://www.cambridgeenglish.org', null],
    ['ln-sjpt', 'SJPT (일본어 말하기)', '어학', null, 'YBM', 'https://www.ybmsisa.com', null],
    ['ln-jtest', 'J.TEST (실용일본어검정)', '어학', null, 'J.TEST 한국위원회', 'https://www.jtest.or.kr', null],
    ['ln-hskk', 'HSKK (중국어 말하기)', '어학', '초·중·고급', '중국 국가한반', 'https://www.hsk.or.kr', null],
    ['ln-tsc', 'TSC (중국어 말하기)', '어학', null, 'YBM', 'https://www.ybmsisa.com', null],
    ['ln-tocfl', 'TOCFL (대만 중국어)', '어학', null, '대만 화어문능력시험위원회', 'https://tocfl.edu.tw', null, '대만 유학·장학'],
    ['ln-dele', 'DELE (스페인어)', '어학', 'A1~C2', '세르반테스 문화원', 'https://examenes.cervantes.es', null, '스페인 교육부 공인'],
    ['ln-siele', 'SIELE (스페인어)', '어학', null, '세르반테스 문화원', 'https://siele.org', null, '컴퓨터 시험'],
    ['ln-delf', 'DELF (프랑스어)', '어학', 'A1~B2', '프랑스 교육부 (FEI)', 'https://www.france-education-international.fr', null, '프랑스 교육부 공인'],
    ['ln-dalf', 'DALF (프랑스어)', '어학', 'C1~C2', '프랑스 교육부 (FEI)', 'https://www.france-education-international.fr', null, '고급 프랑스어'],
    ['ln-tcf', 'TCF (프랑스어)', '어학', null, '프랑스 교육부 (FEI)', 'https://www.france-education-international.fr', null],
    ['ln-tef', 'TEF (프랑스어)', '어학', null, '파리 상공회의소', 'https://www.lefrancaisdesaffaires.fr', null, '캐나다 이민 등'],
    ['ln-goethe', 'Goethe-Zertifikat (독일어)', '어학', 'A1~C2', '괴테 인스티투트', 'https://www.goethe.de/korea', null],
    ['ln-testdaf', 'TestDaF (독일어)', '어학', null, 'TestDaF-Institut', 'https://www.testdaf.de', null, '독일 대학 입학'],
    ['ln-torfl', 'TORFL (러시아어)', '어학', '1~4단계', '러시아 교육부', 'https://www.google.com/search?q=TORFL', null],
    ['ln-cils', 'CILS (이탈리아어)', '어학', 'A1~C2', '시에나 외국인대학', 'https://cils.unistrasi.it', null],
    ['ln-celi', 'CELI (이탈리아어)', '어학', 'A1~C2', '페루자 외국인대학', 'https://www.cvcl.it', null],
    ['ln-plida', 'PLIDA (이탈리아어)', '어학', 'A1~C2', '단테 알리기에리 협회', 'https://plida.it', null],
    ['ln-caple', 'CAPLE (포르투갈어)', '어학', 'A1~C2', '리스본 대학교', 'https://caple.letras.ulisboa.pt', null],
  ],
};

/** 등급·종류별 기본 준비기간·응시료 (참고값, 해마다 바뀔 수 있음) */
function defaults(kind: string, grade: string | null, series: string | null): { prep: string | null; fee: string | null } {
  if (series?.startsWith('qnet-')) {
    if (grade === '기술사') return { prep: '6~12개월', fee: '필기 67,800원 · 면접 87,100원' };
    if (grade === '기능장') return { prep: '4~6개월', fee: '필기 34,400원 · 실기 종목별' };
    if (grade === '기사') return { prep: '3~4개월', fee: '필기 19,400원 · 실기 종목별' };
    if (grade === '기능사') return { prep: '1~2개월', fee: '필기 14,500원 · 실기 종목별' };
    return { prep: '2~3개월', fee: '필기 19,400원 · 실기 종목별' };
  }
  if (kind === '어학') return { prep: '1~3개월', fee: null };
  if (kind === '국가공인민간' || kind === '민간') return { prep: '1~2개월', fee: null };
  return { prep: null, fee: null };
}

/** 종목별 참고값 (기본값 덮어씀). 응시료 '약'은 대략치 */
const EXTRA: Record<string, { prep?: string; fee?: string }> = {
  'it-ipe': { prep: '2~3개월', fee: '필기 19,400원 · 실기 22,600원' },
  'it-ipie': { prep: '2~3개월', fee: '필기 19,400원 · 실기 20,800원' },
  'it-sec': { prep: '4~6개월', fee: '필기·실기 각 약 2만원' },
  'it-sec2': { prep: '3~4개월', fee: '필기·실기 각 약 2만원' },
  'it-bigdata': { prep: '2~3개월', fee: '필기 17,800원 · 실기 40,800원' },
  'it-sqld': { prep: '2~4주', fee: '50,000원' },
  'it-sqlp': { prep: '2~3개월', fee: '100,000원' },
  'it-adsp': { prep: '3~4주', fee: '50,000원' },
  'it-adp': { prep: '6개월 이상', fee: '필기·실기 각 100,000원' },
  'it-comm': { prep: '3~4개월', fee: '필기·실기 각 약 2~3만원' },
  'it-radio': { prep: '3~4개월', fee: '필기·실기 각 약 2~3만원' },
  'it-linux': { prep: '1~2개월', fee: '1차 약 2만원 · 2차 약 2.5만원' },
  'it-net': { prep: '1개월', fee: '약 4만원' },
  'it-aws-saa': { prep: '1~2개월', fee: 'US$150' },
  'it-cka': { prep: '1~2개월', fee: 'US$445 (재응시 1회 포함)' },
  'el-ee': { prep: '4~6개월' },
  'el-ec': { prep: '2~3개월' },
  'sf-ind': { prep: '2~3개월' },
  'of-cos1': { prep: '1~2개월', fee: '필기 19,000원 · 실기 22,500원' },
  'of-cos2': { prep: '2~4주', fee: '필기 19,000원 · 실기 22,500원' },
  'of-word': { prep: '2~4주', fee: '필기 19,000원 · 실기 약 2.2만원' },
  'of-itq': { prep: '2~3주', fee: '과목당 약 2만원' },
  'of-erp': { prep: '1개월', fee: '과목당 약 2~4만원' },
  'of-dist2': { prep: '1~2개월', fee: '약 3만원' },
  'of-sec2': { prep: '1개월', fee: '필기 약 2만원 · 실기 약 2.3만원' },
  'of-survey': { prep: '2~3개월' },
  'of-logis': { prep: '3~6개월', fee: '약 2만원' },
  'of-mgmt': { prep: '6~12개월' },
  'ac-cpa': { prep: '2~4년' },
  'ac-tax': { prep: '2~3년' },
  'ac-ca1': { prep: '1~2개월', fee: '약 2.5만원' },
  'ac-ct2': { prep: '2~3개월', fee: '약 2.5만원' },
  'ac-fin': { prep: '2~3개월', fee: '약 7만원' },
  'ac-acc1': { prep: '1~2개월', fee: '약 7만원' },
  'fn-invest': { prep: '1~2개월', fee: '약 5만원' },
  'fn-fund': { prep: '3~4주', fee: '약 3.5만원' },
  'fn-sec': { prep: '3~4주', fee: '약 3.5만원' },
  'fn-credit': { prep: '3~6개월' },
  'fn-afpk': { prep: '3~6개월 (교육 수료 필요)' },
  'fn-cfa': { prep: '레벨당 300시간 이상', fee: 'US$1,000 안팎 (레벨당)' },
  'fn-realtor': { prep: '6~12개월', fee: '1차 13,700원 · 2차 14,300원' },
  'fn-apprais': { prep: '1.5~3년' },
  'lw-bar': { prep: '로스쿨 3년' },
  'lw-patent': { prep: '2~3년' },
  'lw-customs': { prep: '1~2년' },
  'lw-labor': { prep: '1~2년' },
  'lw-admin': { prep: '3~6개월' },
  'lw-judicial': { prep: '2~4년' },
  'cv-housing': { prep: '6~12개월' },
  'cv-architect': { prep: '1~2년' },
  'hc-sw1': { prep: '3~6개월' },
  'hc-nurse': { prep: '졸업 전 4~6개월' },
  'hc-care': { prep: '교육 240시간 + 2~4주' },
  'ed-history': { prep: '2~4주', fee: '심화 약 2.7만원' },
  'ed-hanja': { prep: '급수별 2주~3개월', fee: '급수별 상이' },
  'ed-job2': { prep: '2~3개월' },
  'ed-clinpsy2': { prep: '수련 1년 + 2~3개월' },
  'ed-youthcoun': { prep: '3~6개월' },
  'ed-korteach': { prep: '3~6개월' },
  'sf-fire1': { prep: '강습 + 2~4주' },
  'ck-barista': { prep: '1~2개월', fee: '필기·실기 합산 약 10만원' },
  'tr-guide': { prep: '6개월 (어학 성적 별도)' },
  'ln-toeic': { fee: '52,500원' },
  'ln-toeics': { fee: '84,000원' },
  'ln-opic': { fee: '84,000원' },
  'ln-teps': { fee: '약 4.6만원' },
  'ln-toefl': { prep: '2~4개월', fee: 'US$220 안팎' },
  'ln-ielts': { prep: '2~4개월', fee: '약 30만원' },
  'ln-jlpt': { prep: '급수별 1~6개월', fee: '급수별 약 4~6만원' },
  'ln-jpt': { fee: '약 5만원' },
  'ln-hsk': { prep: '급수별 1~6개월', fee: '급수별 상이' },
  'ln-topik': { fee: '약 4~5.5만원' },
};

/** 유효기간 (참고값). 국가자격은 기본 평생 */
const VALIDITY: Record<string, string> = {
  'it-sqld': '없음',
  'it-sqlp': '없음',
  'it-adsp': '없음',
  'it-adp': '없음',
  'it-aws-saa': '3년',
  'it-cka': '2년',
  'fn-afpk': '2년 (계속교육으로 갱신)',
  'fn-cfa': '평생 (회원 자격은 연회비)',
  'sf-fire1': '없음 (선임 시 2년마다 실무교육)',
  'ed-history': '없음 (기관별 인정기간 상이)',
  'ed-hanja': '없음',
  'ln-toeic': '2년',
  'ln-toeics': '2년',
  'ln-toeicb': '2년',
  'ln-opic': '2년',
  'ln-teps': '2년',
  'ln-toefl': '2년',
  'ln-ielts': '2년 (기관별)',
  'ln-gtelp': '2년',
  'ln-flex': '2년',
  'ln-pte': '2년',
  'ln-det': '2년',
  'ln-cae': '평생 (기관별 2년 인정도 있음)',
  'ln-jlpt': '없음 (기관별 2년 인정 많음)',
  'ln-jpt': '2년',
  'ln-sjpt': '2년',
  'ln-jtest': '2년 (기관별)',
  'ln-hsk': '2년',
  'ln-hskk': '2년',
  'ln-tsc': '2년',
  'ln-tocfl': '2년',
  'ln-topik': '2년',
  'ln-dele': '평생',
  'ln-siele': '5년',
  'ln-delf': '평생',
  'ln-dalf': '평생',
  'ln-tcf': '2년',
  'ln-tef': '2년 (이민용 기준)',
  'ln-goethe': '평생 (기관별 인정기간 상이)',
  'ln-testdaf': '평생 (대학별 인정기간 상이)',
  'ln-torfl': '평생 (기관별)',
  'ln-cils': '평생',
  'ln-celi': '평생',
  'ln-plida': '평생',
  'ln-caple': '평생',
};

const validityOf = (id: string, kind: string) =>
  VALIDITY[id] ?? (kind === '국가기술' || kind === '국가전문' ? '평생 (만료 없음)' : null);

const BASE: CatalogCert[] = Object.entries(DATA).flatMap(([field, rows]) =>
  rows.map(([id, name, kind, grade, org, url, series, summary]) => {
    const d = defaults(kind, grade, series);
    const x = EXTRA[id] ?? {};
    return { id, name, field, kind, grade, org, url, series, summary: summary ?? null, prep: x.prep ?? d.prep, fee: x.fee ?? d.fee, validity: validityOf(id, kind) };
  }),
);

/** 국가기술 전 종목 (기본 목록에 없는 이름만). id = q-이름 */
/** 국가공인 민간·유명 민간 (기본 목록에 없는 이름만) */
const PRIVATE: CatalogCert[] = (() => {
  const seen = new Set(BASE.map((c) => c.name.replace(/\s/g, '')));
  return [...PRO_CERTS, ...PRIVATE_CERTS].filter((c) => {
    const k = c.name.replace(/\s/g, '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map((c) => {
    const d = defaults(c.kind, c.grade, null);
    return {
      id: c.id,
      name: c.name,
      field: c.field,
      kind: c.kind,
      grade: c.grade,
      org: c.org,
      url: c.url,
      series: null,
      summary: c.summary ?? null,
      prep: c.prep ?? d.prep,
      fee: c.fee ?? null,
      validity: c.validity ?? (c.kind === '국가전문' ? '평생 (만료 없음)' : null),
    };
  });
})();

const BULK: CatalogCert[] = (() => {
  const seen = new Set([...BASE, ...PRIVATE].map((c) => c.name.replace(/\s/g, '')));
  const out: CatalogCert[] = [];
  for (const [field, grades] of Object.entries(QNET_ALL)) {
    for (const [grade, names] of Object.entries(grades) as [QGrade, string[]][]) {
      for (const name of names) {
        const key = name.replace(/\s/g, '');
        if (seen.has(key)) continue;
        seen.add(key);
        const other = otherOrg(name);
        const series = other ? null : QNET_ALWAYS.has(name) ? 'qnet-상시' : seriesOfGrade(grade);
        const d = defaults('국가기술', grade, series ?? `qnet-${grade}`);
        out.push({
          id: `q-${key}`,
          name,
          field,
          kind: '국가기술',
          grade,
          org: other?.org ?? HRD,
          url: other?.url ?? QNET,
          series,
          summary: null,
          prep: d.prep,
          fee: d.fee,
          validity: '평생 (만료 없음)',
        });
      }
    }
  }
  return out;
})();

export const CATALOG: CatalogCert[] = [...BASE, ...PRIVATE, ...BULK];

/** Q-net 직무분야 → 자격증 분야 */
export function fieldOfQnet(obligfld: string): string {
  const f = obligfld.replace(/\s/g, '');
  const map: [RegExp, string][] = [
    [/정보통신/, '정보통신/IT'],
    [/전기|전자|반도체/, '전기/전자'],
    [/기계|재료/, '기계/자동차'],
    [/건설/, '건설/건축'],
    [/안전|환경|에너지/, '안전/환경/에너지'],
    [/화학|식품/, '화학/식품/바이오'],
    [/경영|회계|사무/, '경영/사무/OA'],
    [/디자인|문화|예술|방송/, '디자인/미디어'],
    [/음식|이용|숙박|여행|스포츠|미용/, '조리/미용/관광'],
    [/농림|어업/, '농림/조경'],
    [/보건|의료|사회복지/, '보건/의료/복지'],
    [/교육|과학/, '교육/상담/인문'],
  ];
  return map.find(([re]) => re.test(f))?.[1] ?? '기타';
}

/** 등급 → Q-net 정기 묶음 (상시 여부는 알 수 없어 정기로) */
export function seriesOfGrade(grade: string): string {
  return /기술사/.test(grade) ? 'qnet-기술사' : /기능장/.test(grade) ? 'qnet-기능장' : /기능사/.test(grade) ? 'qnet-기능사' : 'qnet-기사';
}

export const defaultsOf = defaults;

/** 국가기술 등급 (이 외 등급값은 Q-net 목록에서 종목명이 잘못 들어온 것) */
export const TECH_GRADES = ['기술사', '기능장', '기사', '산업기사', '기능사'] as const;
export const isTechGrade = (g: string | null | undefined): boolean => !!g && (TECH_GRADES as readonly string[]).includes(g.trim());

/** 이름 키워드로 분야 (Q-net 직무분야가 '기타'로 오는 국가전문 보정). 못 찾으면 null */
export function fieldOfName(name: string): string | null {
  const n = name.replace(/\s/g, '');
  const map: [RegExp, string][] = [
    [/관광|호텔|여행|조리|미용/, '조리/미용/관광'],
    [/경영지도|기술지도|가맹|품질관리사|물류/, '경영/사무/OA'],
    [/행정사|경비|노무|변리|법무|감정평가|공인중개/, '법률/행정'],
    [/청소년|국가유산|문화재|학예|평생교육|상담|한자|국어/, '교육/상담/인문'],
    [/산업안전|산업보건|정수시설|소방|위험물|원자|방사/, '안전/환경/에너지'],
    [/손해평가|농산물|수산물|산림|나무|조경|경매사/, '농림/조경'],
    [/회계|세무/, '회계/세무'],
    [/보험|금융|투자|자산|신용|부동산|주택/, '금융/부동산'],
    [/정보|데이터|네트워크|소프트웨어|컴퓨터|보안|클라우드|인공지능|AI/i, '정보통신/IT'],
    [/의료|간호|보건|복지|요양|재활|위생|약사|의약/, '보건/의료/복지'],
    [/무역|사무|비서|경영|유통|마케팅/, '경영/사무/OA'],
    [/디자인|영상|방송|사진|무대|색채/, '디자인/미디어'],
    [/전기|전자|반도체/, '전기/전자'],
    [/건축|토목|건설|측량/, '건설/건축'],
    [/자동차|기계|용접/, '기계/자동차'],
    [/식품|화학|바이오/, '화학/식품/바이오'],
  ];
  return map.find(([re]) => re.test(n))?.[1] ?? null;
}

/** 국가공인 민간자격 분야: 이름 키워드 → 소관부처 순 */
export function fieldOfPrivate(name: string, ministry: string): string {
  const m = ministry.replace(/\s/g, '');
  const byName = fieldOfName(name);
  if (byName) return byName;
  if (/금융위/.test(m)) return '금융/부동산';
  if (/과학기술정보통신|과기정통/.test(m)) return '정보통신/IT';
  if (/식품의약품|보건복지/.test(m)) return '보건/의료/복지';
  if (/교육부/.test(m)) return '교육/상담/인문';
  if (/국토교통/.test(m)) return '건설/건축';
  if (/농림|산림|해양수산/.test(m)) return '농림/조경';
  if (/문화체육/.test(m)) return '디자인/미디어';
  if (/환경|고용노동|소방|행정안전/.test(m)) return '안전/환경/에너지';
  return '기타';
}

/**
 * 국가전문 변형 이름 → 기본 이름과 변형 표시.
 * '관광통역안내사(영어)' → ['관광통역안내사', '영어'], '1급 청소년상담사' → ['청소년상담사', '1급']
 */
export function baseOfVariant(name: string): { base: string; tag: string | null } {
  let base = name.trim();
  const tags: string[] = [];
  base = base.replace(/\s*[(（]([^)）]*)[)）]\s*/g, (_, t: string) => (tags.push(t.trim()), ''));
  base = base.replace(/^([0-9])급\s*/, (_, g: string) => (tags.push(`${g}급`), ''));
  base = base.replace(/\s*([0-9])급$/, (_, g: string) => (tags.push(`${g}급`), ''));
  base = base.trim();
  return { base: base || name.trim(), tag: tags.filter(Boolean).join(' ') || null };
}

/** 변형 표시 묶기: ['1급','2급','3급'] → '1~3급', 그 외 '·'로 */
export function joinTags(tags: string[]): string | null {
  const u = [...new Set(tags.filter(Boolean))];
  if (!u.length) return null;
  const lv = u.map((t) => /^([0-9])급$/.exec(t)?.[1]).filter(Boolean).map(Number);
  if (lv.length === u.length && lv.length > 1) {
    lv.sort((a, b) => a - b);
    const contiguous = lv.every((v, i) => i === 0 || v === lv[i - 1] + 1);
    return contiguous ? `${lv[0]}~${lv[lv.length - 1]}급` : lv.map((v) => `${v}급`).join('·');
  }
  const s = u.join('·');
  return s.length > 60 ? `${u.slice(0, 5).join('·')} 외 ${u.length - 5}` : s;
}

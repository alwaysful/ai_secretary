import { load } from 'cheerio';

/** 공공데이터포털: 한국산업인력공단 국가자격 시험일정 조회 */
export const QNET_SCHEDULE_URL = 'https://apis.data.go.kr/B490007/qualExamSchd/getQualExamSchdList';

/** T = 국가기술, S = 국가전문 */
export type QnetGb = 'T' | 'S';

export interface QnetPhase {
  regStart: Date | null;
  regEnd: Date | null;
  examStart: Date | null;
  examEnd: Date | null;
  resultAt: Date | null;
}

export interface QnetRound {
  gb: string;
  year: string;
  seq: string;
  description: string;
  /** 필기(1차) */
  doc: QnetPhase | null;
  /** 실기(2차) */
  prac: QnetPhase | null;
}

/** 20260113 → KST 자정 */
export function ymd(v: unknown): Date | null {
  const s = String(v ?? '').replace(/\D/g, '');
  if (s.length !== 8) return null;
  const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 키 대소문자 무시 */
function pick(o: Record<string, unknown>, k: string): unknown {
  const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
  return hit ? o[hit] : undefined;
}

function phase(o: Record<string, unknown>, p: 'doc' | 'prac'): QnetPhase | null {
  const r: QnetPhase = {
    regStart: ymd(pick(o, `${p}RegStartDt`)),
    regEnd: ymd(pick(o, `${p}RegEndDt`)),
    examStart: ymd(pick(o, `${p}ExamStartDt`)),
    examEnd: ymd(pick(o, `${p}ExamEndDt`)),
    resultAt: ymd(pick(o, `${p}PassDt`)),
  };
  return Object.values(r).some(Boolean) ? r : null;
}

function toRound(o: Record<string, unknown>): QnetRound {
  return {
    gb: String(pick(o, 'qualgbCd') ?? ''),
    year: String(pick(o, 'implYy') ?? ''),
    seq: String(pick(o, 'implSeq') ?? ''),
    description: String(pick(o, 'description') ?? pick(o, 'qualgbNm') ?? '').trim(),
    doc: phase(o, 'doc'),
    prac: phase(o, 'prac'),
  };
}

/** JSON 또는 XML 응답 → item 레코드 목록. 오류 응답이면 throw */
export function parseItems(text: string): Record<string, unknown>[] {
  const t = text.trim();
  if (t.startsWith('<')) {
    const $ = load(t, { xml: true });
    const auth = $('returnAuthMsg').first().text() || $('errMsg').first().text();
    const code = $('resultCode').first().text();
    if (auth || (code && code !== '00')) throw new Error(`Q-net API 오류: ${auth || $('resultMsg').first().text() || code}`);
    return $('item')
      .toArray()
      .map((el) => {
        const o: Record<string, unknown> = {};
        $(el)
          .children()
          .each((_, c) => {
            o[(c as { name: string }).name] = $(c).text();
          });
        return o;
      });
  }
  let j: unknown;
  try {
    j = JSON.parse(t);
  } catch {
    throw new Error(`Q-net API 응답 해석 실패: ${t.slice(0, 120)}`);
  }
  const root = (j as { response?: unknown }).response ?? j;
  const { header, body } = root as { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: unknown } };
  if (header?.resultCode && header.resultCode !== '00') throw new Error(`Q-net API 오류: ${header.resultMsg ?? header.resultCode}`);
  let items = body?.items as unknown;
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as { item?: unknown }).item;
  if (!items) return [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
}

/** 시험 일정 응답 → 회차 목록 */
export const parseQnet = (text: string): QnetRound[] => parseItems(text).map(toRound);

/** 국가자격 종목 1개 */
export interface QnetJm {
  jmCd: string;
  name: string;
  /** 기사·기능사 등 */
  grade: string;
  /** 직무분야 (정보통신 등) */
  obligfld: string;
  /** 국가기술자격 등 */
  qualgb: string;
}

/** 종목 목록 응답 → 종목 */
export function parseJmList(text: string): QnetJm[] {
  return parseItems(text)
    .map((o) => ({
      jmCd: String(pick(o, 'jmcd') ?? '').trim(),
      name: String(pick(o, 'jmfldnm') ?? '').trim(),
      grade: String(pick(o, 'seriesnm') ?? '').trim(),
      obligfld: String(pick(o, 'obligfldnm') ?? '').trim(),
      qualgb: String(pick(o, 'qualgbnm') ?? '').trim(),
    }))
    .filter((j) => j.jmCd && j.name);
}

/** 공공데이터포털: 한국산업인력공단 국가자격 종목 목록 */
export const QNET_JM_URL = 'http://openapi.q-net.or.kr/api/service/rest/InquiryListNationalQualifcationSVC/getList';

export function qnetJmUrl(key: string, page = 1): string {
  const k = key.includes('%') ? key : encodeURIComponent(key);
  return `${QNET_JM_URL}?serviceKey=${k}&numOfRows=${QNET_PAGE}&pageNo=${page}`;
}

/** 국가기술 회차 설명 → 일정 묶음 */
export function seriesOf(description: string): string | null {
  const d = description.replace(/\s/g, '');
  if (/상시/.test(d)) return null;
  if (/기술사/.test(d)) return 'qnet-기술사';
  if (/기능장/.test(d)) return 'qnet-기능장';
  if (/기능사/.test(d)) return 'qnet-기능사';
  if (/기사/.test(d)) return 'qnet-기사';
  return null;
}

/** 이름 비교용: 한글·영숫자만 */
export const norm = (s: string) => s.replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase();

/** serviceKey: 인코딩된 키(% 포함)는 그대로, 디코딩 키는 인코딩 */
/** 한 페이지 최대 줄 수 (API 제한 50) */
export const QNET_PAGE = 50;

export function qnetUrl(key: string, year: number, gb: QnetGb, page = 1): string {
  const k = key.includes('%') ? key : encodeURIComponent(key);
  return `${QNET_SCHEDULE_URL}?serviceKey=${k}&numOfRows=${QNET_PAGE}&pageNo=${page}&dataFormat=json&implYy=${year}&qualgbCd=${gb}`;
}

/** 공공데이터포털(odcloud): 한국직업능력연구원 공인민간자격등록현황 (약 100줄 → 1회 호출) */
export const KPRIVATE_URL = 'https://api.odcloud.kr/api/15069557/v1/uddi:dd42dfb1-fe74-4303-a2e2-c3411586bb4d';
export const KPRIVATE_PAGE = 500;

export function kprivateUrl(key: string, page = 1): string {
  const k = key.includes('%') ? key : encodeURIComponent(key);
  return `${KPRIVATE_URL}?page=${page}&perPage=${KPRIVATE_PAGE}&returnType=JSON&serviceKey=${k}`;
}

/** 공인민간 1종목 (등급별 줄을 묶은 것) */
export interface KPrivate {
  name: string;
  grades: string[];
  org: string;
  ministry: string;
  /** 공인 유효기간 만료 (YYYY-MM-DD 등 원문) */
  until: string | null;
}

const blank = (v: unknown) => {
  const s = String(v ?? '').trim();
  return !s || /^(미입력|없음|-|null)$/i.test(s) ? '' : s;
};

/** odcloud 응답 {totalCount, data[]} → 종목별로 묶음. 오류 응답이면 throw */
export function parseKPrivate(text: string): { items: KPrivate[]; total: number; rows: number } {
  let j: { data?: unknown; totalCount?: number; code?: number; msg?: string };
  try {
    j = JSON.parse(text.trim());
  } catch {
    throw new Error(`공인민간자격 API 응답 해석 실패: ${text.trim().slice(0, 120)}`);
  }
  if (!Array.isArray(j.data)) throw new Error(`공인민간자격 API 오류: ${j.msg ?? j.code ?? '데이터 없음'}`);
  const by = new Map<string, KPrivate>();
  for (const o of j.data as Record<string, unknown>[]) {
    const name = blank(o['자격종목'] ?? o['자격명']);
    if (!name) continue;
    const k = norm(name);
    const cur = by.get(k) ?? { name, grades: [], org: '', ministry: '', until: null };
    const g = blank(o['등급'] ?? o['등급명']);
    if (g && !cur.grades.includes(g)) cur.grades.push(g);
    cur.org ||= blank(o['자격관리자'] ?? o['자격관리기관']);
    cur.ministry ||= blank(o['소관 부처'] ?? o['소관부처'] ?? o['주무부처']);
    const until = blank(o['공인유효기간(만료)']);
    if (until && (!cur.until || until > cur.until)) cur.until = until;
    by.set(k, cur);
  }
  return { items: [...by.values()], total: Number(j.totalCount ?? 0), rows: (j.data as unknown[]).length };
}

/** Q-net 산업인력 국가기술자격 통계: 종목별 취득자 (jmCd 필수, 종목마다 1회 호출) */
export const QNET_STAT_URL = 'http://openapi.q-net.or.kr/api/service/rest/InquiryStatSVC/getEventCertYearList';

export function qnetStatUrl(key: string, year: number, jmCd: string): string {
  const k = key.includes('%') ? key : encodeURIComponent(key);
  return `${QNET_STAT_URL}?serviceKey=${k}&baseYY=${year}&jmCd=${encodeURIComponent(jmCd)}`;
}

export interface CertStats {
  /** 연도별 취득자 (오래된 해 → 최근 해) */
  years: { year: number; count: number }[];
  /** 전체 누적 (baseYY까지) */
  total: number;
}

/**
 * 성별 행(남·여)을 합침. 실측: ilpcnt1 = 5년 구간 이전까지 누적, ilpcnt2~6 = baseYY-4 ~ baseYY.
 * (baseYY 하나 바꿔 호출하면 한 칸씩 밀리는 것으로 확인)
 */
export function parseCertStats(text: string, baseYY: number): CertStats | null {
  const rows = parseItems(text);
  if (!rows.length) return null;
  const num = (v: unknown) => Number(String(v ?? '0').replace(/[^0-9-]/g, '')) || 0;
  const sum = (k: string) => rows.reduce((a, r) => a + num(pick(r, k)), 0);
  const years = [2, 3, 4, 5, 6].map((i) => ({ year: baseYY - 6 + i, count: sum(`ilpcnt${i}`) }));
  const total = sum('ilpcnt1') + years.reduce((a, y) => a + y.count, 0);
  return { years, total };
}

/** 공공데이터포털(odcloud): 한국직업능력연구원 국가전문자격정보 (20250601본, 약 210줄 → 1회 호출) */
export const KPRO_URL = 'https://api.odcloud.kr/api/15090299/v1/uddi:4bbc44e3-f420-4533-a582-fcf901e1b259';

export function kproUrl(key: string, page = 1): string {
  const k = key.includes('%') ? key : encodeURIComponent(key);
  return `${KPRO_URL}?page=${page}&perPage=${KPRIVATE_PAGE}&returnType=JSON&serviceKey=${k}`;
}

/** 국가전문 1종목 */
export interface KPro {
  name: string;
  grades: string[];
  law: string;
  ministry: string;
  org: string;
  url: string | null;
}

/** odcloud 응답 → 국가전문 목록. 오류 응답이면 throw */
export function parseKPro(text: string): KPro[] {
  let j: { data?: unknown; code?: number; msg?: string };
  try {
    j = JSON.parse(text.trim());
  } catch {
    throw new Error(`국가전문자격 API 응답 해석 실패: ${text.trim().slice(0, 120)}`);
  }
  if (!Array.isArray(j.data)) throw new Error(`국가전문자격 API 오류: ${j.msg ?? j.code ?? '데이터 없음'}`);
  const clean = (v: unknown) => {
    const s = blank(v);
    return /^내용\s*없음$/.test(s) ? '' : s;
  };
  const seen = new Set<string>();
  const out: KPro[] = [];
  for (const o of j.data as Record<string, unknown>[]) {
    const name = clean(o['자격명']);
    if (!name || seen.has(norm(name))) continue;
    seen.add(norm(name));
    // 등급: 괄호 밖 쉼표로만 나눔 ('제1종(보통, 대형), 제2종' → 2개)
    const raw = clean(o['등급']);
    const grades: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of raw) {
      if (ch === '(' || ch === '（') depth++;
      if (ch === ')' || ch === '）') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) {
        if (cur.trim()) grades.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) grades.push(cur.trim());
    const home = clean(o['시행기관홈페이지']);
    const url = home ? (/^https?:\/\//i.test(home) ? home : `https://${home}`) : null;
    out.push({ name, grades, law: clean(o['관련법']), ministry: clean(o['소관부처']), org: clean(o['시행기관']), url });
  }
  return out;
}

const enc = (key: string) => (key.includes('%') ? key : encodeURIComponent(key));
const num = (v: unknown) => Number(String(v ?? '0').replace(/[^0-9.-]/g, '')) || 0;

/** 산업인력 국가기술자격 통계: 종목별 연도별 필기(Pi)·실기(Si) 응시·합격 */
export const QNET_PASS_URL = 'http://openapi.q-net.or.kr/api/service/rest/InquiryStatSVC';

export function qnetPassUrl(key: string, year: number, jmCd: string, kind: 'Pi' | 'Si'): string {
  return `${QNET_PASS_URL}/getEventYear${kind}List?serviceKey=${enc(key)}&baseYY=${year}&jmCd=${encodeURIComponent(jmCd)}`;
}

export interface PassYear {
  year: number;
  /** 응시자 */
  applied: number;
  /** 합격자 */
  passed: number;
}

export interface PassStats {
  written: PassYear[];
  practical: PassYear[];
}

/** 취득자 통계와 같은 칸 순서 (ilXcnt2~6 = 4년 전~기준년도). ilecnt = 응시, ilpcnt = 합격. 응시 0인 해는 뺌 */
export function parsePassYears(text: string, baseYY: number): PassYear[] {
  const rows = parseItems(text);
  const sum = (k: string) => rows.reduce((a, r) => a + num(pick(r, k)), 0);
  return [2, 3, 4, 5, 6]
    .map((i) => ({ year: baseYY - 6 + i, applied: sum(`ilecnt${i}`), passed: sum(`ilpcnt${i}`) }))
    .filter((y) => y.applied > 0 && y.passed <= y.applied);
}

const pct = (p: number, a: number) => `${Math.round((p / a) * 1000) / 10}%`;
const sumOf = (ys: PassYear[]) => ys.reduce((a, y) => ({ applied: a.applied + y.applied, passed: a.passed + y.passed }), { applied: 0, passed: 0 });

/** 칩용 짧은 문구: '필기 45.2% · 실기 30.1% (2025)' */
export function passShort(p: PassStats | null): string | null {
  if (!p) return null;
  const w = p.written.at(-1);
  const s = p.practical.at(-1);
  const parts = [w && `필기 ${pct(w.passed, w.applied)}`, s && `실기 ${pct(s.passed, s.applied)}`].filter(Boolean);
  if (!parts.length) return null;
  return `${parts.join(' · ')} (${Math.max(w?.year ?? 0, s?.year ?? 0)})`;
}

/** 설명 「합격률」 항목 본문 (실제 숫자) */
export function passText(p: PassStats | null): string | null {
  if (!p || (!p.written.length && !p.practical.length)) return null;
  const fmt = (n: number) => n.toLocaleString('ko-KR');
  const line = (label: string, ys: PassYear[]) => {
    if (!ys.length) return null;
    const last = ys[ys.length - 1];
    const t = sumOf(ys);
    return `${label} ${last.year}년 ${pct(last.passed, last.applied)} (응시 ${fmt(last.applied)}명·합격 ${fmt(last.passed)}명), ${ys.length}년 평균 ${pct(t.passed, t.applied)}`;
  };
  return [line('필기', p.written), line('실기', p.practical)].filter(Boolean).join('. ') + '. 출처: 한국산업인력공단 국가기술자격 통계.';
}

/** 국가자격 공개문제 목록 (qualgbCd T = 국가기술) */
export const OPEN_QST_URL = 'https://apis.data.go.kr/B490007/openQst/getOpenQstList';

export function openQstUrl(key: string, jmCd: string, rows = 20): string {
  return `${OPEN_QST_URL}?serviceKey=${enc(key)}&numOfRows=${rows}&pageNo=1&dataFormat=json&qualgbCd=T&jmCd=${encodeURIComponent(jmCd)}`;
}

export interface OpenQst {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string | null;
  series: string;
  jmNm: string;
}

const dt = (v: unknown) => {
  const s = String(v ?? '').replace(/\D/g, '');
  return s.length >= 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
};

/** 공개문제 목록 → 최신순 */
export function parseOpenQst(text: string): OpenQst[] {
  return parseItems(text)
    .map((o) => ({
      id: String(pick(o, 'artlSeq') ?? '').trim(),
      title: String(pick(o, 'title') ?? '').trim(),
      date: dt(pick(o, 'modDttm')) ?? dt(pick(o, 'regDttm')),
      series: String(pick(o, 'seriesNm') ?? '').trim(),
      jmNm: String(pick(o, 'jmNm') ?? '').trim(),
    }))
    .filter((q) => q.title)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/** 국가자격시험 시험장소 (지사별). 이 API만 파라미터 이름이 ServiceKey */
export const EXAM_AREA_URL = 'http://openapi.q-net.or.kr/api/service/rest/InquiryExamAreaSVC/getList';
export const EXAM_AREA_PAGE = 100;

/** 지사 코드 → 이름 */
export const BRANCHES: Record<string, string> = {
  '01': '서울', '02': '서울서부', '03': '부산', '04': '대구', '05': '인천', '06': '광주', '07': '서울남부', '08': '충남(천안)',
  '09': '울산', '10': '경기', '11': '강원', '12': '충북', '13': '대전', '14': '전북', '15': '전남', '16': '경북', '17': '경남',
  '18': '제주', '19': '강원동부', '20': '전남서부', '21': '부산남부', '22': '경북동부', '23': '경기북부', '24': '경기동부',
};

export function examAreaUrl(key: string, brchCd: string, page = 1): string {
  return `${EXAM_AREA_URL}?ServiceKey=${enc(key)}&brchCd=${brchCd}&numOfRows=${EXAM_AREA_PAGE}&pageNo=${page}`;
}

export interface ExamArea {
  name: string;
  /** 훈련기관 등 */
  type: string;
  address: string;
  tel: string;
  guide: string;
  branch: string;
}

export function parseExamArea(text: string): ExamArea[] {
  return parseItems(text)
    .map((o) => ({
      name: String(pick(o, 'examAreaNm') ?? '').trim(),
      type: String(pick(o, 'examAreaGbNm') ?? '').trim(),
      address: String(pick(o, 'address') ?? '').trim(),
      tel: String(pick(o, 'telNo') ?? '').trim(),
      guide: String(pick(o, 'plceLoctGid') ?? '').trim(),
      branch: String(pick(o, 'brchNm') ?? '').trim(),
    }))
    .filter((a) => a.name);
}

/** 공공데이터포털(odcloud): 한국직업능력연구원 민간자격등록정보 (20260630본, 반기 갱신). 자격명으로 검색 */
export const KREG_URL = 'https://api.odcloud.kr/api/15075600/v1/uddi:6f36844c-a64b-4543-8e8c-82e0fc5f24c8';

export function kregUrl(key: string, name: string): string {
  return `${KREG_URL}?page=1&perPage=20&returnType=JSON&serviceKey=${enc(key)}&${encodeURIComponent('cond[자격명::LIKE]')}=${encodeURIComponent(name)}`;
}

/** 민간자격 등록 1건 (등급별 줄 묶음) */
export interface KReg {
  name: string;
  regNo: string;
  regDate: string | null;
  status: string;
  ministry: string;
  org: string;
  url: string | null;
  summary: string;
  grades: { name: string; duty: string; isPublic: boolean }[];
  isPublic: boolean;
}

/** odcloud 응답 → 등록 건. 폐지·취소 건은 뒤로. 오류면 throw */
export function parseKReg(text: string): KReg[] {
  let j: { data?: unknown; code?: number; msg?: string };
  try {
    j = JSON.parse(text.trim());
  } catch {
    throw new Error(`민간자격등록정보 API 응답 해석 실패: ${text.trim().slice(0, 120)}`);
  }
  if (!Array.isArray(j.data)) throw new Error(`민간자격등록정보 API 오류: ${j.msg ?? j.code ?? '데이터 없음'}`);
  const by = new Map<string, KReg>();
  const yes = (v: unknown) => /^(y|yes|공인|예|o)$/i.test(blank(v));
  for (const o of j.data as Record<string, unknown>[]) {
    const name = blank(o['자격명']);
    if (!name) continue;
    const regNo = blank(o['등록번호'] ?? o['등록번호(등록정보연도-등록정보순번)']);
    const k = regNo || norm(name);
    const home = blank(o['기관홈페이지']);
    const cur =
      by.get(k) ??
      ({
        name,
        regNo,
        regDate: blank(o['등록일자']).slice(0, 10) || null,
        status: blank(o['현재상태']),
        ministry: blank(o['주무부처'] ?? o['최종주무부처(주무부처이름(상세)']),
        org: blank(o['자격관리기관'] ?? o['신청기관']),
        url: home ? (/^https?:\/\//i.test(home) ? home : `https://${home}`) : null,
        summary: blank(o['자격개요(직무내용)'] ?? o['자격개요']),
        grades: [],
        isPublic: yes(o['공인여부']),
      } satisfies KReg);
    const g = blank(o['등급명']);
    if (g && !cur.grades.some((x) => x.name === g)) cur.grades.push({ name: g, duty: blank(o['등급별직무내용']), isPublic: yes(o['등급공인여부']) });
    by.set(k, cur);
  }
  const dead = (r: KReg) => (/폐지|취소|말소/.test(r.status) ? 1 : 0);
  return [...by.values()].sort((a, b) => dead(a) - dead(b));
}

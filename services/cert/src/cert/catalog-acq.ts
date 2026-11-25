import { createHash } from 'node:crypto';
import raw from './data/private-acq.json';

/**
 * 민간자격취득현황 (한국직업능력연구원, data.go.kr 15090560) 2021~2025 집계.
 * 응시자 합 1,000명 이상 + 공인 등급 없는 자격. 자격명+발급기관 묶음 1행.
 */
export interface AcqRow {
  name: string;
  org: string;
  ministry: string;
  grades: string[];
  applicants: number;
  acquired: number;
  lastYear: number;
  lastAcquired: number;
  years: Record<string, number>;
  applicantsYears?: Record<string, number>;
  suspect?: boolean;
}

export const ACQ_ROWS = raw as AcqRow[];
export const ACQ_SOURCE = '민간자격취득현황 (한국직업능력연구원) 2021~2025';

const norm = (s: string) => s.replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase();

/** '사단법인 한국커피협회' → '한국커피협회' */
export function shortOrg(org: string): string {
  return (
    org
      .replace(/\(사단?\)|\(사\)|사\)|\(재\)|\(주\)|\(사단법인\)|사단법인|재단법인|주식회사|\(유\)|유한회사/g, '')
      .replace(/\s+/g, ' ')
      .trim() || org
  );
}

/** 같은 기관인지 (이름 일부만 같아도) */
export function sameOrg(a: string, b: string): boolean {
  const x = norm(shortOrg(a));
  const y = norm(shortOrg(b));
  return !!x && !!y && (x.includes(y) || y.includes(x));
}

export const acqId = (r: AcqRow) => `pa-${createHash('sha1').update(`${norm(r.name)}|${norm(r.org)}`).digest('hex').slice(0, 10)}`;

/** 등급 칸: 'N급'은 범위로 묶고 나머지는 앞부분만 */
export function acqGrade(grades: string[]): string | null {
  const g = [...new Set(grades.map((t) => t.trim()).filter((t) => t && !/^(등급\s*없음|없음|단일\s*등급|등급없음)$/.test(t)))];
  if (!g.length) return null;
  const lv = [...new Set(g.map((t) => /^([0-9]+)급$/.exec(t)?.[1]).filter(Boolean).map(Number))].sort((a, b) => a - b);
  const rest = g.filter((t) => !/^[0-9]+급$/.test(t));
  const parts: string[] = [];
  // 연속 급수는 범위로: 1,2,10,11,12 → 1~2급·10~12급
  for (let i = 0; i < lv.length; ) {
    let j = i;
    while (j + 1 < lv.length && lv[j + 1] === lv[j] + 1) j++;
    parts.push(i === j ? `${lv[i]}급` : `${lv[i]}~${lv[j]}급`);
    i = j + 1;
  }
  parts.push(...rest);
  return parts.length > 4 ? `${parts.slice(0, 4).join('·')} 등` : parts.join('·');
}

/** 민간자격 분야 먼저 보는 이름 키워드 (없으면 fieldOfPrivate) */
const ACQ_FIELD: [RegExp, string][] = [
  [/미용|네일|메이크업|피부|헤어|두피|반려견스타일|퍼스널컬러|이미지컨설|바리스타|커피|카페|소믈리에|제과|제빵|요리|조리|관광|여행|항공예약|발권|호텔|플라워|꽃꽂이|파티/, '조리/미용/관광'],
  [/수영|골프|스키|스노보드|태권|무도|요가|필라테스|줄넘기|게이트볼|스쿠버|다이빙|체육|운동|댄스|레크리에이션|안전요원|인명구조|스포츠/, '기타'],
  [/음악|피아노|악기|미술|바둑|주산|암산|종이접기|책놀이|보드게임|독서|웃음|캘리그라피|코딩|창의/, '교육/상담/인문'],
];
export const acqFieldHint = (name: string): string | null => ACQ_FIELD.find(([re]) => re.test(name.replace(/\s/g, '')))?.[1] ?? null;

const fmt = (n: number) => n.toLocaleString('ko-KR');

export function acqRate(r: Pick<AcqRow, 'applicants' | 'acquired' | 'suspect'>): string | null {
  if (r.suspect || !r.applicants || r.acquired > r.applicants) return null;
  return `${Math.round((r.acquired / r.applicants) * 1000) / 10}%`;
}

export function acqSummary(r: AcqRow): string {
  const rate = acqRate(r);
  const parts = [`5년(2021~25) 응시 ${fmt(r.applicants)}명 · 취득 ${fmt(r.acquired)}명`];
  if (rate) parts.push(`합격률 ${rate}`);
  if (r.suspect) parts.push('응시자 수 입력 오류 의심');
  return parts.join(' · ');
}

/** 설명 탭 취득자 막대용 */
export function acqYears(r: AcqRow): { year: number; count: number }[] {
  return Object.entries(r.years)
    .map(([y, c]) => ({ year: Number(y), count: c }))
    .sort((a, b) => a.year - b.year);
}

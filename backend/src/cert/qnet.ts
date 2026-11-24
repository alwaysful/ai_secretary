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

/** JSON 또는 XML 응답 → 회차 목록. 오류 응답이면 throw */
export function parseQnet(text: string): QnetRound[] {
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
        return toRound(o);
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
  return arr.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').map(toRound);
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
export function qnetUrl(key: string, year: number, gb: QnetGb): string {
  const k = key.includes('%') ? key : encodeURIComponent(key);
  return `${QNET_SCHEDULE_URL}?serviceKey=${k}&numOfRows=300&pageNo=1&dataFormat=json&implYy=${year}&qualgbCd=${gb}`;
}

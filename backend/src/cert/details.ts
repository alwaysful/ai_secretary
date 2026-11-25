import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CertDetail, TEMPLATES } from './details-templates';

export type { CertDetail } from './details-templates';

/**
 * 자격증별 설명 (「설명」 버튼). 원본: data/details/**\/*.json (id → 항목).
 * 항목 = 설명 배열 그대로, 또는 {"tpl": 양식이름, ...값} (details-templates.ts 로 펼침).
 * 시작 때 DB certificate.detail 로 복사. 형식은 data/details/README.md.
 */
export const DETAILS_DIR = join(__dirname, 'data', 'details');

export interface DetailIssue {
  file: string;
  id: string;
  msg: string;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function checkItems(d: unknown): string | null {
  if (!Array.isArray(d) || !d.length) return '빈 배열 또는 배열 아님';
  for (const [i, it] of d.entries()) {
    const x = it as Record<string, unknown>;
    if (!x || typeof x !== 'object') return `${i}번 항목 객체 아님`;
    if (!isStr(x.label) || typeof x.text !== 'string') return `${i}번 항목 label/text 없음`;
    if (x.items !== undefined && !(Array.isArray(x.items) && x.items.every(isStr))) return `${i}번 items 형식 오류`;
    if (x.links !== undefined && !(Array.isArray(x.links) && x.links.every((l: { label?: unknown; url?: unknown }) => isStr(l?.label) && isStr(l?.url) && /^https?:\/\//.test(l.url as string))))
      return `${i}번 links 형식 오류`;
  }
  return null;
}

/** 항목 하나 펼치기. 오류면 문자열 */
export function expandDetail(entry: unknown): CertDetail | string {
  if (Array.isArray(entry)) return checkItems(entry) ?? (entry as CertDetail);
  if (!entry || typeof entry !== 'object') return '배열 또는 {tpl} 객체여야 함';
  const { tpl, ...p } = entry as Record<string, unknown>;
  const t = TEMPLATES[String(tpl)];
  if (!t) return `모르는 양식: ${String(tpl)}`;
  const miss = t.required.filter((k) => !isStr(p[k]));
  if (miss.length) return `필수 값 없음: ${miss.join(', ')}`;
  const extra = Object.keys(p).filter((k) => !t.required.includes(k) && !t.optional.includes(k));
  if (extra.length) return `모르는 값: ${extra.join(', ')}`;
  const d = t.build(p);
  return checkItems(d) ?? d;
}

function walk(dir: string): string[] {
  let out: string[] = [];
  let ents: import('node:fs').Dirent[];
  try {
    ents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of ents.sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

/** 폴더 전체 읽기. 잘못된 항목은 issues 로, 나머지는 details 로 */
export function loadDetails(dir = DETAILS_DIR): { details: Record<string, CertDetail>; issues: DetailIssue[] } {
  const details: Record<string, CertDetail> = {};
  const where: Record<string, string> = {};
  const issues: DetailIssue[] = [];
  for (const path of walk(dir)) {
    const file = relative(dir, path);
    let obj: unknown;
    try {
      obj = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      issues.push({ file, id: '-', msg: `JSON 오류: ${(e as Error).message}` });
      continue;
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      issues.push({ file, id: '-', msg: '최상위는 {id: 항목} 객체여야 함' });
      continue;
    }
    for (const [id, entry] of Object.entries(obj)) {
      if (where[id]) {
        issues.push({ file, id, msg: `중복 id (${where[id]} 에도 있음)` });
        continue;
      }
      const d = expandDetail(entry);
      if (typeof d === 'string') issues.push({ file, id, msg: d });
      else {
        details[id] = d;
        where[id] = file;
      }
    }
  }
  return { details, issues };
}

const loaded = loadDetails();
for (const i of loaded.issues) console.warn(`[cert-details] ${i.file} ${i.id}: ${i.msg}`);
export const CERT_DETAILS: Record<string, CertDetail> = loaded.details;

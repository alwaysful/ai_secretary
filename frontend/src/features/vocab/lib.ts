export { SAMPLE } from './sample';


/** 간격 표시: 1분 · 10분 · 1일 · 3개월 */
export function fmtIv(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${Math.max(1, m)}분`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}일`;
  if (d < 365) return `${Math.round(d / 30)}개월`;
  return `${(d / 365).toFixed(1)}년`;
}

export function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** CSV 한 줄 (따옴표 지원) */
function csvRow(line: string, sep: string): string[] {
  if (sep === '\t') return line.split('\t');
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * 파일 → 업로드할 데이터. .json 은 그대로.
 * .txt·.tsv·.csv: 한 줄에 단어, 뜻, 읽기, 예문, 예문뜻 (Anki "텍스트로 내보내기" 호환). # 줄 무시
 */
export function parseFile(name: string, text: string): unknown {
  const t = text.replace(/^﻿/, '');
  if (/\.json$/i.test(name) || /^\s*[[{]/.test(t)) {
    try {
      return JSON.parse(t);
    } catch (e) {
      throw new Error(`JSON 문법 오류: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const lines = t.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  const sep = /\.csv$/i.test(name) ? ',' : lines.some((l) => l.includes('\t')) ? '\t' : ',';
  const cards = lines.map((l) => csvRow(l, sep).map((c) => c.replace(/<[^>]+>/g, '').trim()));
  return { name: name.replace(/\.[^.]+$/, ''), cards };
}

export function readFile(f: File): Promise<unknown> {
  return f.text().then((t) => parseFile(f.name, t));
}

/** 브라우저 음성으로 읽기 (무료·오프라인) */
export function speak(text: string, lang?: string | null) {
  if (typeof speechSynthesis === 'undefined' || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (lang) u.lang = lang;
  speechSynthesis.speak(u);
}

export const canSpeak = () => typeof speechSynthesis !== 'undefined';

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const LANGS: [string, string][] = [
  ['', '없음'],
  ['ja-JP', '일본어'],
  ['en-US', '영어'],
  ['zh-CN', '중국어'],
  ['ko-KR', '한국어'],
  ['de-DE', '독일어'],
  ['fr-FR', '프랑스어'],
  ['es-ES', '스페인어'],
];

import { req } from '../../shared/api';

export interface CertExam {
  id: string;
  title: string;
  phase: string | null;
  source: 'qnet' | 'manual' | string;
  seriesLabel: string | null;
  certId: string | null;
  regStart: string | null;
  regEnd: string | null;
  examStart: string | null;
  examEnd: string | null;
  resultAt: string | null;
  note: string | null;
}

export interface Cert {
  id: string;
  /** 자격증 번호 (국가기술 100001~) */
  no: number | null;
  name: string;
  field: string;
  kind: string;
  grade: string | null;
  org: string;
  url: string | null;
  summary: string | null;
  series: string | null;
  seriesLabel: string | null;
  prep: string | null;
  fee: string | null;
  validity: string | null;
  prepEdited: boolean;
  feeEdited: boolean;
  validityEdited: boolean;
  /** 유용도 0~10 (참고값, 직접 수정 가능) */
  score: number;
  scoreEdited: boolean;
  isNew: boolean;
  starred: boolean;
  custom: boolean;
  /** 국가공인 받은 등급 ('등급 없음' = 단일 등급), 공인 만료일 */
  publicGrades: string | null;
  publicUntil: string | null;
  exams: CertExam[];
}

export interface CertStats {
  stats: { years: { year: number; count: number }[]; total: number } | null;
  at: string | null;
  /** 통계 없는 이유 등 */
  note: string | null;
  /** 큰 숫자 두 번째 칸 이름 (기본 '누적') */
  totalLabel?: string;
  /** 응시 대비 취득 비율 (민간자격취득현황) */
  rate?: string | null;
  /** 합격률 원자료 (Q-net 종목) */
  pass?: { written: PassYear[]; practical: PassYear[] } | null;
  /** 공개문제 (Q-net 종목) */
  questions?: { items: OpenQst[]; note: string | null; url: string } | null;
  /** 민간자격 등록정보 (민간만) */
  registry?: { items: KReg[]; note: string | null } | null;
  /** 상세 설명 (「설명」 열 때만 받음) */
  detail: { label: string; text: string; items?: string[]; links?: { label: string; url: string }[] }[] | null;
}

export interface PassYear {
  year: number;
  applied: number;
  passed: number;
}

export interface OpenQst {
  id: string;
  title: string;
  date: string | null;
  series: string;
}

export interface ExamArea {
  name: string;
  type: string;
  address: string;
  tel: string;
  guide: string;
  branch: string;
}

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

export interface CertMeta {
  fields: string[];
  kinds: string[];
  series: Record<string, string>;
}

export interface CertJob {
  name: string;
  label: string;
  lastAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  lastCount: number;
  nextAt: string | null;
}

export interface CertConfig {
  key: string | null;
  envKey: boolean;
  /** 자격증 서비스 배치 작업 상태 */
  jobs?: CertJob[];
  lastSyncAt: string | null;
  lastError: string | null;
  lastCount: number;
  lastCatalogAt: string | null;
  lastCatalogNew: number;
  lastCatalogError: string | null;
  apiDayCount: number;
  apiMonthCount: number;
  apiDayLimit: number;
  apiMonthLimit: number;
}

export interface CertFilter {
  field?: string;
  kind?: string;
  starred?: boolean;
  q?: string;
}

export interface CertInput {
  name?: string;
  field?: string;
  kind?: string;
  grade?: string | null;
  org?: string;
  url?: string | null;
  summary?: string | null;
  prep?: string | null;
  fee?: string | null;
  validity?: string | null;
  starred?: boolean;
  score?: number | null;
}

export interface ExamInput {
  title: string;
  phase?: string | null;
  regStart?: string | null;
  regEnd?: string | null;
  examStart?: string | null;
  examEnd?: string | null;
  resultAt?: string | null;
  note?: string | null;
}

function qs(f: CertFilter, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra);
  if (f.field) p.set('field', f.field);
  if (f.kind) p.set('kind', f.kind);
  if (f.starred) p.set('starred', 'true');
  if (f.q) p.set('q', f.q);
  const s = p.toString();
  return s ? `?${s}` : '';
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const certApi = {
  meta: () => req<CertMeta>('/certs/meta'),
  list: (f: CertFilter) => req<Cert[]>(`/certs${qs(f)}`),
  fields: (f: CertFilter) => req<Record<string, number>>(`/certs/fields${qs({ ...f, field: undefined })}`),
  calendar: (from: Date, to: Date, f: CertFilter) =>
    req<(CertExam & { certs: string[] })[]>(`/certs/calendar${qs(f, { from: from.toISOString(), to: to.toISOString() })}`),
  create: (b: CertInput & { name: string }) => req<Cert>('/certs', json('POST', b)),
  update: (id: string, b: CertInput) => req<Cert>(`/certs/${encodeURIComponent(id)}`, json('PATCH', b)),
  remove: (id: string) => req<void>(`/certs/${encodeURIComponent(id)}`, json('DELETE')),
  addExam: (id: string, b: ExamInput) => req<Cert>(`/certs/${encodeURIComponent(id)}/exams`, json('POST', b)),
  removeExam: (id: string) => req<void>(`/certs/exams/${id}`, json('DELETE')),
  config: () => req<CertConfig>('/certs/config'),
  setKey: (key: string | null) => req<CertConfig>('/certs/config/key', json('PUT', { key })),
  discover: () => req<CertConfig>('/certs/discover', json('POST')),
  sync: () => req<CertConfig>('/certs/sync', json('POST')),
  stats: (id: string) => req<CertStats>(`/certs/${encodeURIComponent(id)}/stats`),
  collect: () => req<CertConfig>('/certs/collect', json('POST')),
  branches: () => req<{ code: string; name: string }[]>('/certs/places/branches'),
  places: (brch: string) => req<{ branch: string; items: ExamArea[]; note: string | null }>(`/certs/places?brch=${brch}`),
};

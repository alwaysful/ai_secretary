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
  prepEdited: boolean;
  feeEdited: boolean;
  isNew: boolean;
  starred: boolean;
  custom: boolean;
  exams: CertExam[];
}

export interface CertMeta {
  fields: string[];
  kinds: string[];
  series: Record<string, string>;
}

export interface CertConfig {
  key: string | null;
  envKey: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  lastCount: number;
  lastCatalogAt: string | null;
  lastCatalogNew: number;
  lastCatalogError: string | null;
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
  starred?: boolean;
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
};

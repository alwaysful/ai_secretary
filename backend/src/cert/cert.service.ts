import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CertCustom, CertPref, CertUserExam, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CertClient } from './cert.client';

const DAY = 86_400_000;

export interface ExamView {
  id: string;
  title: string;
  phase: string | null;
  source: string;
  seriesLabel: string | null;
  certId: string | null;
  regStart: Date | string | null;
  regEnd: Date | string | null;
  examStart: Date | string | null;
  examEnd: Date | string | null;
  resultAt: Date | string | null;
  note: string | null;
}

/** 자격증 서비스가 주는 자격증 (참고값) */
interface RemoteCert {
  id: string;
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
  score: number;
  isNew: boolean;
  publicGrades: string | null;
  publicUntil: string | null;
  exams: ExamView[];
}

/** 화면용 = 참고값 + 사용자 값 */
export interface CertView extends RemoteCert {
  prepEdited: boolean;
  feeEdited: boolean;
  validityEdited: boolean;
  scoreEdited: boolean;
  starred: boolean;
  custom: boolean;
}

export interface CertInput {
  name?: string;
  field?: string;
  kind?: string;
  grade?: string | null;
  org?: string;
  url?: string | null;
  summary?: string | null;
  /** 빈 문자열/null = 기본값으로 */
  prep?: string | null;
  fee?: string | null;
  validity?: string | null;
  /** 유용도 0~10, null = 기본값으로 */
  score?: number | null;
  starred?: boolean;
}

export interface ExamInput {
  title: string;
  phase?: string | null;
  regStart?: Date | null;
  regEnd?: Date | null;
  examStart?: Date | null;
  examEnd?: Date | null;
  resultAt?: Date | null;
  note?: string | null;
}

type Filter = { field?: string; kind?: string; starred?: boolean; q?: string };

const time = (v: Date | string | null) => (v ? new Date(v).getTime() : null);
/** 회차 끝난 날 / 시작 날 */
const lastT = (e: ExamView) => [e.resultAt, e.examEnd, e.examStart, e.regEnd, e.regStart].map(time).find((t) => t !== null) ?? null;
const firstT = (e: ExamView) => [e.regStart, e.regEnd, e.examStart, e.examEnd, e.resultAt].map(time).find((t) => t !== null) ?? null;

/**
 * 자격증 탭 (AURA 쪽). 자격증 정보·일정·통계는 자격증 서비스에서 받고,
 * 별표·고친 값·직접 추가·직접 일정만 AURA DB에 둠.
 */
@Injectable()
export class CertService {
  private meta$?: Promise<{ fields: string[]; kinds: string[]; series: Record<string, string> }>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly remote: CertClient,
  ) {}

  meta() {
    // 거의 안 바뀜 → 성공한 값 재사용
    this.meta$ ??= this.remote.get<{ fields: string[]; kinds: string[]; series: Record<string, string> }>('/certs/meta').catch((e) => {
      this.meta$ = undefined;
      throw e;
    });
    return this.meta$;
  }

  private examView(e: CertUserExam): ExamView {
    return {
      id: e.id,
      title: e.title,
      phase: e.phase,
      source: 'manual',
      seriesLabel: null,
      certId: e.certId,
      regStart: e.regStart,
      regEnd: e.regEnd,
      examStart: e.examStart,
      examEnd: e.examEnd,
      resultAt: e.resultAt,
      note: e.note,
    };
  }

  private merge(c: RemoteCert, p: CertPref | undefined, mine: CertUserExam[], custom: boolean): CertView {
    const since = Date.now() - DAY;
    const exams = [...c.exams, ...mine.filter((e) => (lastT(this.examView(e)) ?? Infinity) >= since).map((e) => this.examView(e))].sort(
      (a, b) => (firstT(a) ?? Infinity) - (firstT(b) ?? Infinity),
    );
    return {
      ...c,
      prep: p?.userPrep ?? c.prep,
      fee: p?.userFee ?? c.fee,
      validity: p?.userValidity ?? c.validity,
      score: p?.userScore ?? c.score,
      prepEdited: custom ? false : p?.userPrep != null,
      feeEdited: custom ? false : p?.userFee != null,
      validityEdited: custom ? false : p?.userValidity != null,
      scoreEdited: p?.userScore != null,
      starred: p?.starred ?? false,
      custom,
      exams,
    };
  }

  /** 직접 추가한 자격증 → 자격증 서비스 모양 */
  private async customRows(q: Filter, onlyIds?: string[]): Promise<RemoteCert[]> {
    const where: Prisma.CertCustomWhereInput = {};
    if (q.field) where.field = q.field;
    if (q.kind) where.kind = q.kind;
    if (onlyIds) where.id = { in: onlyIds };
    const text = q.q?.trim();
    if (text) where.OR = (['name', 'org', 'summary', 'grade', 'field'] as const).map((k) => ({ [k]: { contains: text, mode: 'insensitive' } }));
    const rows = await this.prisma.certCustom.findMany({ where, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
    const scores = rows.length
      ? await this.remote.post<number[]>('/certs/score', { items: rows.map((r) => ({ name: r.name, kind: r.kind, grade: r.grade, field: r.field })) }).catch(() => rows.map(() => 5))
      : [];
    return rows.map((r, i) => this.customView(r, scores[i] ?? 5));
  }

  private customView(r: CertCustom, score: number): RemoteCert {
    return {
      id: r.id,
      no: r.no,
      name: r.name,
      field: r.field,
      kind: r.kind,
      grade: r.grade,
      org: r.org,
      url: r.url,
      summary: r.summary,
      series: null,
      seriesLabel: null,
      prep: null,
      fee: null,
      validity: null,
      score,
      isNew: false,
      publicGrades: null,
      publicUntil: null,
      exams: [],
    };
  }

  async list(q: Filter): Promise<CertView[]> {
    const prefs = await this.prisma.certPref.findMany();
    const byId = new Map(prefs.map((p) => [p.certId, p]));
    const starIds = q.starred ? prefs.filter((p) => p.starred).map((p) => p.certId) : undefined;
    const filter = { field: q.field, kind: q.kind, q: q.q };
    const [remote, custom] = await Promise.all([
      starIds && !starIds.length ? Promise.resolve([] as RemoteCert[]) : this.remote.post<RemoteCert[]>('/certs/query', { ...filter, ids: starIds }, 30_000),
      this.customRows(q, starIds),
    ]);
    const all = [...custom.map((c) => ({ c, custom: true })), ...remote.map((c) => ({ c, custom: false }))];
    const ids = all.map((x) => x.c.id);
    const mine = await this.prisma.certUserExam.findMany({ where: { certId: { in: ids } } });
    const views = all.map(({ c, custom: cu }) => this.merge(c, byId.get(c.id), mine.filter((e) => e.certId === c.id), cu));
    // 별표 → 직접 추가 → 기본 순서 (sort 는 안정 정렬)
    return views.sort((a, b) => Number(b.starred) - Number(a.starred) || Number(b.custom) - Number(a.custom));
  }

  /** 분야별 개수 (검색어·종류 반영, 분야 거르기 전) */
  async fieldCounts(q: Filter): Promise<Record<string, number>> {
    const all = await this.list(q);
    const out: Record<string, number> = {};
    for (const c of all) out[c.field] = (out[c.field] ?? 0) + 1;
    return out;
  }

  /** 기간과 겹치는 회차 (자동 수집 + 직접 넣은 일정) */
  async calendar(q: Filter & { from: Date; to: Date }) {
    const certs = await this.list(q);
    const remoteIds = certs.filter((c) => !c.custom).map((c) => c.id);
    const remote = remoteIds.length
      ? await this.remote.post<(ExamView & { certs: string[] })[]>('/certs/calendar', { ids: remoteIds, from: q.from, to: q.to }, 30_000)
      : [];
    const names = new Map(certs.map((c) => [c.id, c.name]));
    const mine = (await this.prisma.certUserExam.findMany({ where: { certId: { in: [...names.keys()] } } }))
      .map((e) => this.examView(e))
      .filter((e) => {
        const f = firstT(e);
        const l = lastT(e);
        return f !== null && l !== null && f <= q.to.getTime() && l >= q.from.getTime();
      })
      .map((e) => ({ ...e, certs: [names.get(e.certId!) ?? ''] }));
    return [...remote, ...mine];
  }

  private async isCustom(id: string): Promise<CertCustom | null> {
    return this.prisma.certCustom.findUnique({ where: { id } });
  }

  async one(id: string): Promise<CertView> {
    const pref = (await this.prisma.certPref.findUnique({ where: { certId: id } })) ?? undefined;
    const mine = await this.prisma.certUserExam.findMany({ where: { certId: id } });
    const cu = await this.isCustom(id);
    if (cu) {
      const [score] = await this.remote.post<number[]>('/certs/score', { items: [{ name: cu.name, kind: cu.kind, grade: cu.grade, field: cu.field }] }).catch(() => [5]);
      return this.merge(this.customView(cu, score), pref, mine, true);
    }
    return this.merge(await this.remote.get<RemoteCert>(`/certs/${encodeURIComponent(id)}`), pref, mine, false);
  }

  private async checkField(b: CertInput) {
    if (!b.field && !b.kind) return;
    const m = await this.meta();
    if (b.field && !m.fields.includes(b.field)) throw new BadRequestException('분야 이름 오류');
    if (b.kind && !m.kinds.includes(b.kind)) throw new BadRequestException('종류 오류');
  }

  async create(b: CertInput & { name: string }): Promise<CertView> {
    await this.checkField(b);
    const max = await this.prisma.certCustom.aggregate({ _max: { position: true, no: true } });
    const id = randomUUID();
    await this.prisma.$transaction([
      this.prisma.certCustom.create({
        data: {
          id,
          // 직접 추가 번호 대역 9xxxxx
          no: Math.max(900_000, max._max.no ?? 0) + 1,
          name: b.name.trim(),
          field: b.field ?? '기타',
          kind: b.kind ?? '등록민간',
          grade: b.grade?.trim() || null,
          org: b.org?.trim() || '-',
          url: b.url?.trim() || null,
          summary: b.summary?.trim() || null,
          position: (max._max.position ?? 0) + 1,
        },
      }),
      this.prisma.certPref.create({
        data: { certId: id, starred: b.starred ?? true, userPrep: b.prep?.trim() || null, userFee: b.fee?.trim() || null, userValidity: b.validity?.trim() || null },
      }),
    ]);
    return this.one(id);
  }

  /** 모든 자격증: 별표·준비기간·응시료·유효기간·유용도. 직접 추가한 건 나머지도 */
  async update(id: string, b: CertInput): Promise<CertView> {
    const cu = await this.isCustom(id);
    // 없는 id 막기 (자격증 서비스에 물어봄)
    if (!cu) await this.remote.get(`/certs/${encodeURIComponent(id)}`);
    await this.checkField(b);
    const data: Prisma.CertPrefUpdateInput = {};
    if (b.starred !== undefined) data.starred = b.starred;
    if (b.prep !== undefined) data.userPrep = b.prep?.trim() || null;
    if (b.fee !== undefined) data.userFee = b.fee?.trim() || null;
    if (b.validity !== undefined) data.userValidity = b.validity?.trim() || null;
    if (b.score !== undefined) data.userScore = b.score === null ? null : Math.round(Math.min(10, Math.max(0, b.score)) * 10) / 10;
    if (Object.keys(data).length) {
      await this.prisma.certPref.upsert({
        where: { certId: id },
        create: { ...(data as Omit<Prisma.CertPrefCreateInput, "certId">), certId: id },
        update: data,
      });
    }
    if (cu) {
      const c: Prisma.CertCustomUpdateInput = {};
      if (b.name !== undefined) c.name = b.name.trim();
      if (b.field !== undefined) c.field = b.field;
      if (b.kind !== undefined) c.kind = b.kind;
      if (b.grade !== undefined) c.grade = b.grade?.trim() || null;
      if (b.org !== undefined) c.org = b.org.trim() || '-';
      if (b.url !== undefined) c.url = b.url?.trim() || null;
      if (b.summary !== undefined) c.summary = b.summary?.trim() || null;
      if (Object.keys(c).length) await this.prisma.certCustom.update({ where: { id }, data: c });
    }
    return this.one(id);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.isCustom(id))) throw new BadRequestException('기본 목록 자격증은 삭제 불가 (별표만 해제)');
    await this.prisma.$transaction([
      this.prisma.certUserExam.deleteMany({ where: { certId: id } }),
      this.prisma.certPref.deleteMany({ where: { certId: id } }),
      this.prisma.certCustom.delete({ where: { id } }),
    ]);
  }

  async addExam(certId: string, b: ExamInput): Promise<CertView> {
    if (!(await this.isCustom(certId))) await this.remote.get(`/certs/${encodeURIComponent(certId)}`);
    if (![b.regStart, b.regEnd, b.examStart, b.examEnd, b.resultAt].some(Boolean)) throw new BadRequestException('날짜 하나 이상 필요');
    await this.prisma.certUserExam.create({
      data: {
        certId,
        title: b.title.trim(),
        phase: b.phase?.trim() || null,
        regStart: b.regStart ?? null,
        regEnd: b.regEnd ?? null,
        examStart: b.examStart ?? null,
        examEnd: b.examEnd ?? null,
        resultAt: b.resultAt ?? null,
        note: b.note?.trim() || null,
      },
    });
    return this.one(certId);
  }

  async removeExam(id: string): Promise<void> {
    const e = await this.prisma.certUserExam.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('일정 없음 (자동 수집 일정은 삭제 불가)');
    await this.prisma.certUserExam.delete({ where: { id } });
  }

  /** 「설명」 자료 (자격증 서비스 DB 값). 직접 추가한 건 설명 없음 */
  async stats(id: string) {
    if (await this.isCustom(id)) return { stats: null, at: null, note: '직접 추가한 자격증', rate: null, pass: null, detail: null, questions: null, registry: null };
    return this.remote.get(`/certs/${encodeURIComponent(id)}/about`);
  }

  branches() {
    return this.remote.get('/certs/places/branches');
  }

  places(brch: string) {
    return this.remote.get(`/certs/places?brch=${encodeURIComponent(brch)}`);
  }

  getConfig() {
    return this.remote.get('/certs/config');
  }

  setKey(key: string | null) {
    return this.remote.put('/certs/config/key', { key });
  }

  /** 버튼: 새 자격증 확인 */
  discover() {
    return this.remote.post('/certs/run', { jobs: ['catalog'] }, 180_000);
  }

  /** 버튼: 일정 수집 */
  sync() {
    return this.remote.post('/certs/run', { jobs: ['schedule'] }, 180_000);
  }

  /** 버튼: 전부 */
  collect() {
    return this.remote.post('/certs/run', { jobs: ['catalog', 'schedule', 'stats', 'questions', 'places', 'registry'] }, 600_000);
  }
}

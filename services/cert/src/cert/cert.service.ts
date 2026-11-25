import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { CertExam, Certificate } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { API_DAY_LIMIT, API_MONTH_LIMIT, CertApi } from './cert.api';
import { JOB_EVERY, JOB_LABEL } from './cert.batch';
import { ACQ_SOURCE, acqRate } from './catalog-acq';
import { ACQ_BY_ID, baseOfVariant, CERT_FIELDS, CERT_KINDS, SERIES_LABEL } from './catalog';
import { CertDetail } from './details';
import { BRANCHES, CertStats, norm, PassStats, passShort, passText } from './qnet';
import { scoreOf } from './score';

const DAY = 86_400_000;
/** 목록 조회에서 뺄 큰 열 */
const LIST_OMIT = { detail: true, statsYears: true, passYears: true } as const;
type CertRow = Omit<Certificate, keyof typeof LIST_OMIT>;
/** 새로 찾은 자격증 '새' 표시 기간 */
const NEW_FOR_MS = 30 * DAY;
const QNET_HOME = 'https://www.q-net.or.kr';
const HRD = '한국산업인력공단';

export interface ExamView {
  id: string;
  title: string;
  phase: string | null;
  source: string;
  seriesLabel: string | null;
  certId: string | null;
  regStart: Date | null;
  regEnd: Date | null;
  examStart: Date | null;
  examEnd: Date | null;
  resultAt: Date | null;
  note: string | null;
}

/** 자격증 (참고값만. 사용자 값은 AURA가 덮어씀) */
export interface CertView {
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

export interface CertFilter {
  field?: string;
  kind?: string;
  q?: string;
  /** 이 id만 (AURA 별표 거르기) */
  ids?: string[];
}

export interface JobView {
  name: string;
  label: string;
  lastAt: Date | null;
  lastOkAt: Date | null;
  lastError: string | null;
  lastCount: number;
  /** 다음 실행 예정 (대략) */
  nextAt: Date | null;
}

export interface CertConfigView {
  key: string | null;
  envKey: boolean;
  jobs: JobView[];
  apiDayCount: number;
  apiMonthCount: number;
  apiDayLimit: number;
  apiMonthLimit: number;
  // 예전 화면 호환 (일정·새 자격증 작업 값)
  lastSyncAt: Date | null;
  lastError: string | null;
  lastCount: number;
  lastCatalogAt: Date | null;
  lastCatalogNew: number;
  lastCatalogError: string | null;
}

/** 「설명」 펼침 자료 (전부 DB 값) */
export interface AboutView {
  stats: CertStats | null;
  at: Date | null;
  note: string | null;
  totalLabel?: string;
  rate: string | null;
  pass: PassStats | null;
  detail: CertDetail | null;
  questions: { items: { id: string; title: string; date: string | null; series: string }[]; note: string | null; url: string } | null;
  registry: { items: RegistryView[]; note: string | null } | null;
}

export interface RegistryView {
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

/** 회차가 끝난 날 (가장 늦은 날짜) */
const lastDay = (e: CertExam) => [e.resultAt, e.examEnd, e.examStart, e.regEnd, e.regStart].find(Boolean) ?? null;
/** 회차 정렬 기준 날짜 (가장 이른 날짜) */
const firstDay = (e: CertExam) => [e.regStart, e.regEnd, e.examStart, e.examEnd, e.resultAt].find(Boolean) ?? null;
const mask = (k: string) => (k.length <= 8 ? '****' : `${k.slice(0, 4)}…${k.slice(-4)}`);
const pending = (job: { lastOkAt: Date | null; lastError: string | null } | undefined, what: string) =>
  job?.lastError ? job.lastError : job?.lastOkAt ? `${what} 없음` : `${what} 수집 대기 (자동 수집 후 표시)`;

/** 읽기 전용: DB만 조회. 공공데이터 호출은 CertBatch */
@Injectable()
export class CertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly api: CertApi,
  ) {}

  meta() {
    return { fields: [...CERT_FIELDS], kinds: [...CERT_KINDS], series: SERIES_LABEL };
  }

  /** 유용도 참고값 (AURA 직접 추가 자격증용) */
  score(items: { name: string; kind: string; grade: string | null; field: string }[]): number[] {
    return items.map((c) => scoreOf(c));
  }

  private examView(e: CertExam): ExamView {
    return {
      id: e.id,
      title: e.title,
      phase: e.phase,
      source: e.source,
      seriesLabel: e.series ? (SERIES_LABEL[e.series] ?? e.series) : null,
      certId: e.certId,
      regStart: e.regStart,
      regEnd: e.regEnd,
      examStart: e.examStart,
      examEnd: e.examEnd,
      resultAt: e.resultAt,
      note: e.note,
    };
  }

  private view(c: CertRow, exams: CertExam[]): CertView {
    return {
      id: c.id,
      no: c.no,
      name: c.name,
      field: c.field,
      kind: c.kind,
      grade: c.grade,
      org: c.org,
      url: c.url,
      summary: c.summary,
      series: c.series,
      seriesLabel: c.series ? (SERIES_LABEL[c.series] ?? c.series) : null,
      prep: c.prep,
      fee: c.fee,
      validity: c.validity,
      score: scoreOf(c),
      isNew: !!c.discoveredAt && Date.now() - c.discoveredAt.getTime() < NEW_FOR_MS,
      publicGrades: c.publicGrades,
      publicUntil: c.publicUntil,
      exams: exams.map((e) => this.examView(e)),
    };
  }

  /** 끝나지 않은 회차 → 자격증별로 묶기 (자기 일정 + 묶음 일정) */
  private async upcoming(certs: CertRow[]): Promise<Map<string, CertExam[]>> {
    const since = new Date(Date.now() - DAY);
    const ids = certs.map((c) => c.id);
    const series = [...new Set(certs.map((c) => c.series).filter((s): s is string => !!s))];
    const exams = await this.prisma.certExam.findMany({
      where: { OR: [{ certId: { in: ids } }, ...(series.length ? [{ series: { in: series } }] : [])] },
    });
    const live = exams
      .filter((e) => {
        const l = lastDay(e);
        return !l || l >= since;
      })
      .sort((a, b) => (firstDay(a)?.getTime() ?? Infinity) - (firstDay(b)?.getTime() ?? Infinity));
    const out = new Map<string, CertExam[]>();
    for (const c of certs) out.set(c.id, live.filter((e) => e.certId === c.id || (!!c.series && e.series === c.series)));
    return out;
  }

  private where(q: CertFilter): Prisma.CertificateWhereInput {
    const where: Prisma.CertificateWhereInput = {};
    if (q.field) where.field = q.field;
    if (q.kind) where.kind = q.kind;
    if (q.ids) where.id = { in: q.ids };
    const text = q.q?.trim();
    if (text) where.OR = (['name', 'org', 'summary', 'grade', 'field'] as const).map((k) => ({ [k]: { contains: text, mode: 'insensitive' } }));
    return where;
  }

  /** 목록 (기본 순서: position, 이름) */
  async list(q: CertFilter): Promise<CertView[]> {
    const certs = await this.prisma.certificate.findMany({ where: this.where(q), omit: LIST_OMIT, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
    const exams = await this.upcoming(certs);
    return certs.map((c) => this.view(c, exams.get(c.id) ?? []));
  }

  /** 기간과 겹치는 회차. 대상 자격증 이름 포함 */
  async calendar(q: CertFilter & { from: Date; to: Date }) {
    const certs = await this.prisma.certificate.findMany({ where: this.where(q), select: { id: true, name: true, series: true } });
    const ids = certs.map((c) => c.id);
    const series = new Map<string, string[]>();
    for (const c of certs) if (c.series) series.set(c.series, [...(series.get(c.series) ?? []), c.name]);
    const exams = await this.prisma.certExam.findMany({
      where: { OR: [{ certId: { in: ids } }, { series: { in: [...series.keys()] } }] },
      include: { cert: { select: { name: true } } },
    });
    return exams
      .filter((e) => {
        const f = firstDay(e);
        const l = lastDay(e);
        return f && l && f <= q.to && l >= q.from;
      })
      .map((e) => ({ ...this.examView(e), certs: e.cert ? [e.cert.name] : (series.get(e.series ?? '') ?? []) }));
  }

  private async get(id: string): Promise<Certificate> {
    const c = await this.prisma.certificate.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('자격증 없음');
    return c;
  }

  async one(id: string): Promise<CertView> {
    const c = await this.get(id);
    return this.view(c, (await this.upcoming([c])).get(id) ?? []);
  }

  /** 「설명」 자료: 설명 + 취득자 + 합격률 + 공개문제 + 민간 등록정보 (전부 DB) */
  async about(id: string): Promise<AboutView> {
    const c = await this.get(id);
    const jobs = await this.prisma.certJob.findMany();
    const job = (n: string) => jobs.find((j) => j.name === n);
    let detail = (c.detail as CertDetail | null) ?? null;
    const pass = (c.passYears as PassStats | null) ?? null;
    // 설명의 대략적인 합격률 문구 → 실제 숫자
    const real = passText(pass);
    if (real) {
      detail = detail ?? [];
      detail = detail.some((d) => d.label === '합격률') ? detail.map((d) => (d.label === '합격률' ? { ...d, text: real } : d)) : [...detail, { label: '합격률', text: real }];
    }
    const saved = c.statsYears ? { years: c.statsYears as CertStats['years'], total: c.statsTotal ?? 0 } : null;
    let st: Pick<AboutView, 'stats' | 'at' | 'note' | 'totalLabel' | 'rate'>;
    const acq = ACQ_BY_ID.get(c.id);
    if (!c.jmCd && acq && saved) st = { stats: saved, at: null, note: ACQ_SOURCE, totalLabel: '5년 합계', rate: acqRate(acq) };
    else if (!c.jmCd)
      st = { stats: null, at: null, rate: null, note: c.org === HRD ? '새 자격증 확인 한 번 돌면 연결됨' : '취득자 통계는 Q-net(한국산업인력공단) 시행 자격만 제공' };
    else st = { stats: saved, at: c.statsAt, rate: passShort(pass), note: c.statsError ?? (c.statsAt ? (saved ? null : '통계 없음') : '통계 수집 대기 (자동 수집 후 표시)') };

    let questions: AboutView['questions'] = null;
    if (c.jmCd) {
      const items = await this.prisma.certQuestion.findMany({ where: { jmCd: c.jmCd }, orderBy: { date: 'desc' }, take: 30 });
      questions = { items, note: items.length ? null : pending(job('questions'), '공개문제'), url: `${QNET_HOME}/cst003.do?id=cst00309&gSite=Q&gId=` };
    }
    let registry: AboutView['registry'] = null;
    if (c.kind === '등록민간' || c.kind === '국가공인민간') {
      // '네트워크관리사 2급' → '네트워크관리사'
      const k = norm(baseOfVariant(c.name).base.replace(/\s*(\d|준\d)\s*급$/, '')) || norm(c.name);
      const rows = await this.prisma.certRegistry.findMany({ where: { normName: k }, take: 5 });
      const dead = (r: { status: string }) => (/폐지|취소|말소/.test(r.status) ? 1 : 0);
      const items = rows
        .sort((a, b) => dead(a) - dead(b))
        .map((r) => ({ ...r, regNo: r.id.startsWith('n:') ? '' : r.id, grades: r.grades as RegistryView['grades'] }))
        .map(({ id: _id, normName: _n, ...v }) => v);
      registry = { items, note: items.length ? null : job('registry')?.lastOkAt ? '등록정보에서 못 찾음' : pending(job('registry'), '등록정보') };
    }
    return { ...st, pass, detail, questions, registry };
  }

  /** 지역 목록 */
  branches(): { code: string; name: string }[] {
    return Object.entries(BRANCHES).map(([code, name]) => ({ code, name }));
  }

  /** 시험장소 (지사별, DB) */
  async places(brchCd: string) {
    const branch = BRANCHES[brchCd];
    if (!branch) throw new NotFoundException('모르는 지역 코드');
    const items = await this.prisma.certPlace.findMany({ where: { brchCd }, orderBy: { name: 'asc' } });
    const job = await this.prisma.certJob.findUnique({ where: { name: 'places' } });
    return {
      branch,
      items: items.map(({ id: _i, brchCd: _b, ...a }) => a),
      note: items.length ? null : pending(job ?? undefined, '시험장소'),
    };
  }

  async getConfig(): Promise<CertConfigView> {
    const c = await this.prisma.certConfig.findUnique({ where: { id: 1 } });
    const rows = await this.prisma.certJob.findMany();
    const jobs: JobView[] = Object.keys(JOB_EVERY).map((name) => {
      const j = rows.find((r) => r.name === name);
      const ref = j?.lastError ? j.lastAt : j?.lastOkAt;
      return {
        name,
        label: JOB_LABEL[name],
        lastAt: j?.lastAt ?? null,
        lastOkAt: j?.lastOkAt ?? null,
        lastError: j?.lastError ?? null,
        lastCount: j?.lastCount ?? 0,
        nextAt: ref ? new Date(ref.getTime() + (j?.lastError ? Math.min(JOB_EVERY[name], 3 * 3_600_000) : JOB_EVERY[name])) : null,
      };
    });
    const sched = jobs.find((j) => j.name === 'schedule')!;
    const cat = jobs.find((j) => j.name === 'catalog')!;
    const usage = await this.api.usage();
    return {
      key: c?.qnetKey ? mask(c.qnetKey) : null,
      envKey: !c?.qnetKey && !!this.config.get<string>('QNET_API_KEY'),
      jobs,
      // 한도는 API별 → 가장 많이 쓴 API 기준
      apiDayCount: Math.max(0, ...usage.byApi.map((a) => a.day)),
      apiMonthCount: usage.month,
      apiDayLimit: API_DAY_LIMIT,
      apiMonthLimit: API_MONTH_LIMIT,
      lastSyncAt: sched.lastAt,
      lastError: sched.lastError,
      lastCount: sched.lastCount,
      lastCatalogAt: cat.lastAt,
      lastCatalogNew: cat.lastCount,
      lastCatalogError: cat.lastError,
    };
  }

  /** null = 화면 키 삭제. 바꾸면 작업 기록 초기화 → 다음 확인 때 다시 수집 */
  async setKey(key: string | null): Promise<CertConfigView> {
    const qnetKey = key?.trim() || null;
    await this.prisma.certConfig.upsert({ where: { id: 1 }, create: { id: 1, qnetKey }, update: { qnetKey } });
    await this.prisma.certJob.deleteMany();
    return this.getConfig();
  }
}

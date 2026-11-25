import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { CertExam, Certificate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ACQ_SOURCE, acqRate } from './catalog-acq';
import { ACQ_BY_ID, aliasOf, baseOfVariant, findGrade, CATALOG, CERT_FIELDS, CERT_KINDS, defaultsOf, fieldOfName, fieldOfPrivate, fieldOfQnet, isTechGrade, joinTags, singleGradeIsPublic, SERIES_LABEL, seriesOfGrade } from './catalog';
import { scoreOf } from './score';
import { CERT_DETAILS, CertDetail } from './details';
import { BRANCHES, ExamArea, examAreaUrl, EXAM_AREA_PAGE, KReg, kregUrl, OpenQst, openQstUrl, parseExamArea, parseKReg, parseOpenQst, parsePassYears, PassStats, passShort, passText, qnetPassUrl } from './qnet';
import { CertStats, KPrivate, KPro, kproUrl, parseKPro, kprivateUrl, norm, parseCertStats, parseJmList, parseKPrivate, parseQnet, QNET_PAGE, QnetGb, QnetJm, qnetJmUrl, QnetPhase, qnetStatUrl, qnetUrl, seriesOf } from './qnet';

const DAY = 86_400_000;
/** 자격증 번호 대역 [시작, 끝): 국가기술 100001~, 등록민간은 두 칸 400001~599999, 국제·어학 600001~ */
const NO_RANGE: Record<string, [number, number]> = {
  국가기술: [100_000, 200_000],
  국가전문: [200_000, 300_000],
  국가공인민간: [300_000, 400_000],
  등록민간: [400_000, 600_000],
  '국제·어학': [600_000, 700_000],
};
const NO_OTHER: [number, number] = [900_000, 1_000_000];
/** 목록 조회에서 뺄 큰 열 */
const LIST_OMIT = { detail: true, statsYears: true, passYears: true } as const;
type CertRow = Omit<Certificate, keyof typeof LIST_OMIT>;
const CATALOG_IDS = new Set(CATALOG.map((c) => c.id));
/** 자동 수집 주기 */
const SYNC_EVERY_MS = 24 * 3_600_000;
const FETCH_TIMEOUT_MS = 20_000;
/** 공공데이터 API 응답 캐시 기간. 같은 주소 다시 부르면 저장된 응답 사용 (호출 한도 절약) */
const API_CACHE_MS = 12 * 3_600_000;
/** 오래된 캐시 지우는 기준 */
const API_CACHE_KEEP_MS = 7 * DAY;
/** 공공데이터 API 호출 한도 (개발계정 기준 보수적으로). 넘기 전에 멈춤 */
export const API_DAY_LIMIT = 500;
export const API_MONTH_LIMIT = 10_000;
/** 수동 수집 최소 간격 (연속 클릭으로 호출 낭비 방지) */
const MANUAL_COOLDOWN_MS = 10 * 60_000;
/** KST 날짜 YYYY-MM-DD */
const kstDay = (d = new Date()) => new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
/** 새 자격증 확인 주기 (목록은 DB에 두고 가끔만) */
const CATALOG_EVERY_MS = 7 * DAY;
/** 새로 찾은 자격증 '새' 표시 기간 */
const NEW_FOR_MS = 30 * DAY;
/** 취득자 통계 다시 받는 주기 (해마다 바뀌는 값이라 한 달이면 충분) */
const STATS_EVERY_MS = 30 * DAY;
const QNET_HOME = 'https://www.q-net.or.kr';
const HRD = '한국산업인력공단';
/** 민간자격정보서비스 (공인민간 상세 확인처) */
const PQI = 'https://www.pqi.or.kr';

/** 이름 비교 키: 전체, 괄호 뺀 기본 이름, 괄호 안 이름(3자 이상). 'TESAT' ↔ '경제이해력검증시험(TESAT)' 중복 방지 */
function nameKeys(name: string): string[] {
  const { base } = baseOfVariant(name);
  // '의사 국가시험' ↔ '의사'
  const keys = [norm(name), norm(base), norm(base.replace(/\s*국가시험$/, ''))];
  const inner = /[(（]([^)）]+)[)）]/.exec(name)?.[1];
  if (inner && norm(inner).length >= 3) keys.push(norm(inner));
  return [...new Set(keys.filter(Boolean))];
}
const errOf = (e: unknown, what: string) => ((e as Error).name === 'TimeoutError' ? `${what} 응답 시간 초과` : (e as Error).message);

export interface ExamView {
  id: string;
  title: string;
  phase: string | null;
  source: string;
  /** 묶음 일정이면 묶음 이름 */
  seriesLabel: string | null;
  certId: string | null;
  regStart: Date | null;
  regEnd: Date | null;
  examStart: Date | null;
  examEnd: Date | null;
  resultAt: Date | null;
  note: string | null;
}

export interface CertView {
  id: string;
  /** 자격증 번호 (국가기술 100001~ 등) */
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
  /** 평균 준비기간 (사용자 값 우선) */
  prep: string | null;
  /** 응시료 (사용자 값 우선) */
  fee: string | null;
  /** 사용자가 고친 값인지 */
  /** 유효기간 (사용자 값 우선) */
  validity: string | null;
  prepEdited: boolean;
  feeEdited: boolean;
  validityEdited: boolean;
  /** 유용도 0~10 (사용자 값 우선) */
  score: number;
  scoreEdited: boolean;
  /** 최근 Q-net 종목 목록에서 새로 추가됨 */
  isNew: boolean;
  starred: boolean;
  custom: boolean;
  /** 국가공인 받은 등급 ('등급 없음' = 단일 등급), 공인 만료일 */
  publicGrades: string | null;
  publicUntil: string | null;
  /** 끝나지 않은 회차 (가까운 순) */
  exams: ExamView[];
}

type StatsView = { stats: CertStats | null; at: Date | null; note: string | null; totalLabel?: string; rate?: string | null; pass?: PassStats | null };
/** 시험장소 목록은 거의 안 바뀜 → 7일 캐시 */
const AREA_CACHE_MS = 7 * DAY;
/** API 오류 → 화면 문구 (활용신청 대기 등) */
const apiNote = (msg: string, api: string) => (/SERVICE_KEY|SERVICE_ACCESS|등록되지|PERMISSION|401|403|Unauthorized/i.test(msg) ? `「${api}」 API 활용신청(승인) 필요` : msg);

export interface CertConfigView {
  /** 화면에서 넣은 키 마스킹 */
  key: string | null;
  /** .env QNET_API_KEY 사용 중 */
  envKey: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
  lastCount: number;
  lastCatalogAt: Date | null;
  lastCatalogNew: number;
  lastCatalogError: string | null;
  /** 오늘·이번 달 API 호출 수와 한도 */
  apiDayCount: number;
  apiMonthCount: number;
  apiDayLimit: number;
  apiMonthLimit: number;
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

/** 회차가 끝난 날 (가장 늦은 날짜) */
const lastDay = (e: CertExam) => [e.resultAt, e.examEnd, e.examStart, e.regEnd, e.regStart].find(Boolean) ?? null;
/** 회차 정렬 기준 날짜 (가장 이른 날짜) */
const firstDay = (e: CertExam) => [e.regStart, e.regEnd, e.examStart, e.examEnd, e.resultAt].find(Boolean) ?? null;

const mask = (k: string) => (k.length <= 8 ? '****' : `${k.slice(0, 4)}…${k.slice(-4)}`);

/** 자격증 목록 검색 + 시험 일정 (Q-net API 자동 수집 · 직접 입력) */
@Injectable()
export class CertService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(CertService.name);
  private timer?: NodeJS.Timeout;
  private syncing: Promise<number> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seed();
      await this.tidyDiscovered();
      await this.number();
    } catch (e) {
      this.log.warn(`자격증 기본 목록 준비 실패: ${(e as Error).message}`);
    }
    // 시작 1분 뒤 + 1시간마다 확인 → 하루 지났으면 수집
    setTimeout(() => void this.syncIfDue(), 60_000).unref?.();
    this.timer = setInterval(() => void this.syncIfDue(), 3_600_000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** 기본 목록: 없으면 추가, 있으면 내용만 최신화 (별표 유지) */
  private async seed(): Promise<void> {
    const all = await this.prisma.certificate.findMany({ select: { id: true, name: true } });
    const have = new Set(all.map((c) => c.id));
    // 다른 id로 이미 있는 이름(새 자격증 확인·직접 추가)은 건너뜀
    const names = new Set(all.filter((c) => !CATALOG_IDS.has(c.id)).map((c) => norm(c.name)));
    const rows = CATALOG.map((c, i) => ({ ...c, position: i }));
    const fresh = rows.filter((r) => !have.has(r.id) && !names.has(norm(r.name)));
    if (fresh.length) await this.prisma.certificate.createMany({ data: fresh, skipDuplicates: true });
    const old = rows.filter((r) => have.has(r.id));
    if (old.length) {
      await this.prisma.$transaction(
        old.map(({ id, ...data }) => this.prisma.certificate.update({ where: { id }, data })),
      );
    }
    // 상세 설명: 코드 파일이 원본 → DB에 복사
    const details = Object.entries(CERT_DETAILS);
    if (details.length) {
      await this.prisma.$transaction(
        details.map(([id, detail]) => this.prisma.certificate.updateMany({ where: { id }, data: { detail: detail as Prisma.InputJsonValue } })),
      );
    }
  }

  /**
   * 번호 없는 자격증에 번호 주기. 종류별 대역(NO_RANGE) 안에서 지금 최대값 다음부터, 목록 순서대로.
   * 준 번호는 종류가 바뀌어도 그대로. 중간 번호 지워도 빈자리 안 채움 (대역 맨 끝 번호 지운 경우만 다음에 다시 쓰일 수 있음).
   */
  private async number(): Promise<void> {
    const rows = await this.prisma.certificate.findMany({
      select: { id: true, no: true, kind: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    const used = rows.map((r) => r.no).filter((n): n is number => n !== null);
    // 대역별 지금 최대값 (종류가 바뀐 행도 번호 기준)
    const next = new Map<[number, number], number>();
    for (const range of [...Object.values(NO_RANGE), NO_OTHER]) {
      next.set(range, Math.max(range[0], ...used.filter((n) => n > range[0] && n < range[1])));
    }
    const ids: string[] = [];
    const nos: number[] = [];
    for (const r of rows) {
      if (r.no !== null) continue;
      const range = NO_RANGE[r.kind] ?? NO_OTHER;
      const n = next.get(range)! + 1;
      if (n >= range[1]) {
        this.log.warn(`자격증 번호 대역 꽉 참: ${r.kind}`);
        continue;
      }
      next.set(range, n);
      ids.push(r.id);
      nos.push(n);
    }
    if (!ids.length) return;
    await this.prisma.$executeRaw`UPDATE "Certificate" c SET "no" = v.no FROM unnest(${ids}::text[], ${nos}::int[]) AS v(id, no) WHERE c.id = v.id`;
    this.log.log(`자격증 번호 ${ids.length}개 부여`);
  }

  meta() {
    return { fields: [...CERT_FIELDS], kinds: [...CERT_KINDS], series: SERIES_LABEL };
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
      prep: c.userPrep ?? c.prep,
      fee: c.userFee ?? c.fee,
      validity: c.userValidity ?? c.validity,
      prepEdited: c.userPrep !== null,
      feeEdited: c.userFee !== null,
      validityEdited: c.userValidity !== null,
      score: c.userScore ?? scoreOf(c),
      scoreEdited: c.userScore !== null,
      isNew: !!c.discoveredAt && Date.now() - c.discoveredAt.getTime() < NEW_FOR_MS,
      starred: c.starred,
      custom: c.custom,
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

  async list(q: { field?: string; kind?: string; starred?: boolean; q?: string }): Promise<CertView[]> {
    const where: Prisma.CertificateWhereInput = {};
    if (q.field) where.field = q.field;
    if (q.kind) where.kind = q.kind;
    if (q.starred) where.starred = true;
    const text = q.q?.trim();
    if (text) {
      where.OR = (['name', 'org', 'summary', 'grade', 'field'] as const).map((k) => ({ [k]: { contains: text, mode: 'insensitive' } }));
    }
    const certs = await this.prisma.certificate.findMany({ where, omit: LIST_OMIT, orderBy: [{ starred: 'desc' }, { custom: 'desc' }, { position: 'asc' }, { name: 'asc' }] });
    const exams = await this.upcoming(certs);
    return certs.map((c) => this.view(c, exams.get(c.id) ?? []));
  }

  /** 분야별 개수 (검색어·종류 반영, 분야 거르기 전) */
  async fieldCounts(q: { kind?: string; starred?: boolean; q?: string }): Promise<Record<string, number>> {
    const all = await this.list(q);
    const out: Record<string, number> = {};
    for (const c of all) out[c.field] = (out[c.field] ?? 0) + 1;
    return out;
  }

  /** 기간과 겹치는 회차. 대상 자격증 이름 포함 */
  async calendar(q: { from: Date; to: Date; field?: string; kind?: string; starred?: boolean; q?: string }) {
    const certs = await this.list(q);
    const ids = new Set(certs.map((c) => c.id));
    const series = new Map<string, string[]>();
    for (const c of certs) if (c.series) series.set(c.series, [...(series.get(c.series) ?? []), c.name]);
    const exams = await this.prisma.certExam.findMany({
      where: { OR: [{ certId: { in: [...ids] } }, { series: { in: [...series.keys()] } }] },
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

  private checkField(b: CertInput) {
    if (b.field && !(CERT_FIELDS as readonly string[]).includes(b.field)) throw new BadRequestException('분야 이름 오류');
    if (b.kind && !(CERT_KINDS as readonly string[]).includes(b.kind)) throw new BadRequestException('종류 오류');
  }

  async create(b: CertInput & { name: string }): Promise<CertView> {
    this.checkField(b);
    const max = await this.prisma.certificate.aggregate({ _max: { position: true } });
    const c = await this.prisma.certificate.create({
      data: {
        id: randomUUID(),
        name: b.name.trim(),
        field: b.field ?? '기타',
        kind: b.kind ?? '등록민간',
        grade: b.grade?.trim() || null,
        org: b.org?.trim() || '-',
        url: b.url?.trim() || null,
        summary: b.summary?.trim() || null,
        userPrep: b.prep?.trim() || null,
        userFee: b.fee?.trim() || null,
        userValidity: b.validity?.trim() || null,
        starred: b.starred ?? true,
        custom: true,
        position: (max._max.position ?? 0) + 1,
      },
    });
    await this.number();
    return this.one(c.id);
  }

  /** 기본 목록은 별표만, 직접 추가한 건 전부 수정 */
  async update(id: string, b: CertInput): Promise<CertView> {
    const c = await this.get(id);
    this.checkField(b);
    const data: Prisma.CertificateUpdateInput = {};
    if (b.starred !== undefined) data.starred = b.starred;
    // 준비기간·응시료는 모든 자격증에서 고칠 수 있음 (기본값은 그대로 보관)
    if (b.prep !== undefined) data.userPrep = b.prep?.trim() || null;
    if (b.fee !== undefined) data.userFee = b.fee?.trim() || null;
    if (b.validity !== undefined) data.userValidity = b.validity?.trim() || null;
    if (b.score !== undefined) data.userScore = b.score === null ? null : Math.round(Math.min(10, Math.max(0, b.score)) * 10) / 10;
    if (c.custom) {
      if (b.name !== undefined) data.name = b.name.trim();
      if (b.field !== undefined) data.field = b.field;
      if (b.kind !== undefined) data.kind = b.kind;
      if (b.grade !== undefined) data.grade = b.grade?.trim() || null;
      if (b.org !== undefined) data.org = b.org.trim() || '-';
      if (b.url !== undefined) data.url = b.url?.trim() || null;
      if (b.summary !== undefined) data.summary = b.summary?.trim() || null;
    }
    await this.prisma.certificate.update({ where: { id }, data });
    return this.one(id);
  }

  async remove(id: string): Promise<void> {
    const c = await this.get(id);
    if (!c.custom) throw new BadRequestException('기본 목록 자격증은 삭제 불가 (별표만 해제)');
    await this.prisma.certificate.delete({ where: { id } });
  }

  async addExam(certId: string, b: ExamInput): Promise<CertView> {
    await this.get(certId);
    if (![b.regStart, b.regEnd, b.examStart, b.examEnd, b.resultAt].some(Boolean)) throw new BadRequestException('날짜 하나 이상 필요');
    await this.prisma.certExam.create({
      data: {
        certId,
        source: 'manual',
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
    const e = await this.prisma.certExam.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('일정 없음');
    if (e.source !== 'manual') throw new BadRequestException('자동 수집 일정은 삭제 불가');
    await this.prisma.certExam.delete({ where: { id } });
  }

  // ---------- Q-net 연동 ----------

  private async cfg() {
    return this.prisma.certConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  }

  private async key(): Promise<string | null> {
    return (await this.cfg()).qnetKey ?? this.config.get<string>('QNET_API_KEY') ?? null;
  }

  async getConfig(): Promise<CertConfigView> {
    const c = await this.cfg();
    return {
      key: c.qnetKey ? mask(c.qnetKey) : null,
      envKey: !c.qnetKey && !!this.config.get<string>('QNET_API_KEY'),
      lastSyncAt: c.lastSyncAt,
      lastError: c.lastError,
      lastCount: c.lastCount,
      lastCatalogAt: c.lastCatalogAt,
      lastCatalogNew: c.lastCatalogNew,
      lastCatalogError: c.lastCatalogError,
      apiDayCount: c.apiDay === kstDay() ? c.apiDayCount : 0,
      apiMonthCount: c.apiMonth === kstDay().slice(0, 7) ? c.apiMonthCount : 0,
      apiDayLimit: API_DAY_LIMIT,
      apiMonthLimit: API_MONTH_LIMIT,
    };
  }

  /** null = 화면 키 삭제 */
  async setKey(key: string | null): Promise<CertConfigView> {
    await this.cfg();
    await this.prisma.certConfig.update({ where: { id: 1 }, data: { qnetKey: key?.trim() || null, lastError: null, lastSyncAt: null, lastCatalogAt: null, lastCatalogError: null } });
    return this.getConfig();
  }

  private async syncIfDue(): Promise<void> {
    try {
      const c = await this.cfg();
      if (!(await this.key())) return;
      // 새 자격증은 주 1회만 확인, 나머지는 DB 목록 사용
      if (!c.lastCatalogAt || Date.now() - c.lastCatalogAt.getTime() >= CATALOG_EVERY_MS) await this.discover().catch(() => undefined);
      if (c.lastSyncAt && Date.now() - c.lastSyncAt.getTime() < SYNC_EVERY_MS) return;
      await this.sync();
    } catch (e) {
      this.log.warn(`자격증 일정 자동 수집 실패: ${(e as Error).message}`);
    }
  }

  /** 지금 수집. 동시 요청은 하나로 */
  async sync(): Promise<CertConfigView> {
    const c = await this.cfg();
    // 최근 성공한 수집이 있으면 다시 부르지 않고 DB 값 사용
    if (c.lastSyncAt && !c.lastError && Date.now() - c.lastSyncAt.getTime() < MANUAL_COOLDOWN_MS) return this.getConfig();
    if (!this.syncing) this.syncing = this.doSync().finally(() => (this.syncing = null));
    try {
      await this.syncing;
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return this.getConfig();
  }

  /** 페이지 나눠 받기 (한 페이지 50개 제한). 덜 찬 페이지가 오면 끝 */
  private async pages<T>(url: (page: number) => string, parse: (text: string) => T[]): Promise<T[]> {
    const out: T[] = [];
    for (let page = 1; page <= 40; page++) {
      const items = parse(await this.fetchText(url(page)));
      out.push(...items);
      if (items.length < QNET_PAGE) break;
    }
    return out;
  }

  /** 호출 1회 기록. 한도 넘으면 호출 전에 막음 */
  private async countCall(): Promise<void> {
    const c = await this.cfg();
    const day = kstDay();
    const month = day.slice(0, 7);
    const dayCount = c.apiDay === day ? c.apiDayCount : 0;
    const monthCount = c.apiMonth === month ? c.apiMonthCount : 0;
    if (dayCount >= API_DAY_LIMIT) throw new Error(`오늘 공공데이터 API 호출 한도(${API_DAY_LIMIT}회) 도달. 내일 자동으로 다시 수집`);
    if (monthCount >= API_MONTH_LIMIT) throw new Error(`이번 달 공공데이터 API 호출 한도(${API_MONTH_LIMIT}회) 도달. 다음 달에 다시 수집`);
    await this.prisma.certConfig.update({ where: { id: 1 }, data: { apiDay: day, apiDayCount: dayCount + 1, apiMonth: month, apiMonthCount: monthCount + 1 } });
  }

  /** 공공데이터 API 호출. 12시간 안 같은 주소는 DB 캐시 사용 (키는 주소 해시라 API 키 안 남음) */
  private async fetchText(url: string, ttlMs = API_CACHE_MS): Promise<string> {
    const key = createHash('sha256').update(url).digest('hex');
    const hit = await this.prisma.certApiCache.findUnique({ where: { key } });
    if (hit && Date.now() - hit.at.getTime() < ttlMs) return hit.body;
    await this.countCall();
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { Accept: 'application/json, application/xml' } });
    const text = await res.text();
    if (!res.ok) throw new Error(`Q-net API HTTP ${res.status}: ${text.slice(0, 120)}`);
    const at = new Date();
    await this.prisma.certApiCache.upsert({ where: { key }, create: { key, body: text, at }, update: { body: text, at } });
    if (Math.random() < 0.05) await this.prisma.certApiCache.deleteMany({ where: { at: { lt: new Date(at.getTime() - API_CACHE_KEEP_MS) } } });
    return text;
  }

  /**
   * 새 자격증 확인 (주 1회 또는 버튼). 목록 전체는 DB에 두고 없는 것만 추가.
   * 1) Q-net 국가자격 종목 목록 (50개씩 페이지) 2) 공인민간자격등록현황 (1회)
   */
  async discover(): Promise<CertConfigView> {
    const last = await this.cfg();
    if (last.lastCatalogAt && !last.lastCatalogError && Date.now() - last.lastCatalogAt.getTime() < MANUAL_COOLDOWN_MS) return this.getConfig();
    const key = await this.key();
    if (!key) throw new BadRequestException('Q-net API 키 없음. 공공데이터포털에서 활용신청 후 입력');
    const errors: string[] = [];
    let list: QnetJm[] = [];
    try {
      const seenJm = new Set<string>();
      list = (await this.pages((p) => qnetJmUrl(key, p), parseJmList)).filter((j) => !seenJm.has(j.jmCd) && !!seenJm.add(j.jmCd));
      if (!list.length) throw new Error('Q-net 종목 목록이 비어 있음 (종목 목록 API 활용신청 확인)');
    } catch (e) {
      errors.push(errOf(e, 'Q-net 종목 목록'));
    }
    let priv: KPrivate[] = [];
    try {
      priv = parseKPrivate(await this.fetchText(kprivateUrl(key))).items;
    } catch (e) {
      errors.push(`공인민간: ${errOf(e, '공인민간자격 목록')} (「공인민간자격등록현황」 활용신청 확인)`);
    }
    let pro: KPro[] = [];
    try {
      pro = parseKPro(await this.fetchText(kproUrl(key)));
    } catch (e) {
      errors.push(`국가전문: ${errOf(e, '국가전문자격 목록')} (「국가전문자격정보」 활용신청 확인)`);
    }
    const now = new Date();
    if (list.length) await this.fillJmCd(list).catch((e: Error) => this.log.warn(`종목코드 채우기 실패: ${e.message}`));
    const fresh = await this.freshRows(list, priv, now, pro);
    if (priv.length) await this.markPublic(priv).catch((e: Error) => this.log.warn(`공인 등급 표시 실패: ${e.message}`));
    if (fresh.length) {
      await this.prisma.certificate.createMany({ data: fresh, skipDuplicates: true });
      await this.number();
    }
    const error = errors.join(' / ') || null;
    await this.prisma.certConfig.update({ where: { id: 1 }, data: { lastCatalogAt: now, lastCatalogNew: fresh.length, lastCatalogError: error } });
    this.log.log(`새 자격증 ${fresh.length}개 추가 (Q-net 종목 ${list.length}개, 공인민간 ${priv.length}개, 국가전문 ${pro.length}개 확인)`);
    if (!list.length && !priv.length && !pro.length && error) throw new BadRequestException(error);
    return this.getConfig();
  }

  /**
   * 공인민간자격등록현황에 있는 자격 → 공인 등급·만료일 표시, '등록민간'으로 잘못 둔 건 '국가공인민간'으로.
   * 목록에서 빠진(공인 만료) 자격은 공인 표시만 지움.
   */
  private async markPublic(priv: KPrivate[]): Promise<void> {
    const rows = await this.prisma.certificate.findMany({
      select: { id: true, name: true, kind: true, grade: true, starred: true, publicGrades: true, publicUntil: true, exams: { where: { source: 'manual' }, select: { id: true } } },
    });
    // 이름이 다른 공인 종목(SQL ↔ SQLD 등)은 별칭으로 연결, 예전에 따로 추가된 kp-* 중복은 지움
    const target = new Map<string, { grades: string | null; until: string | null }>();
    const aliasKeys = new Set<string>();
    for (const p of priv) {
      const al = aliasOf(p.name);
      if (!al) continue;
      nameKeys(p.name).forEach((k) => aliasKeys.add(k));
      for (const [id, label] of Object.entries(al.ids)) {
        // 등급 칸이 비어 있으면 종목 전체 공인으로 봄
        const hit = label === '*' || !p.grades.length ? joinTags(p.grades) ?? '등급 없음' : findGrade(p.grades, label);
        target.set(id, { grades: hit, until: p.until?.slice(0, 10) ?? null });
      }
    }
    const byKey = new Map<string, KPrivate>();
    for (const p of priv) if (!aliasOf(p.name)) for (const k of nameKeys(p.name)) if (k.length >= 3 && !byKey.has(k)) byKey.set(k, p);
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const del: string[] = [];
    let matched = 0;
    for (const r of rows) {
      if (r.id.startsWith('kp-') && nameKeys(r.name).some((k) => aliasKeys.has(k))) {
        if (!r.starred && !r.exams.length) del.push(r.id);
        continue;
      }
      let grades: string | null = null;
      let until: string | null = null;
      let isPublic = false;
      const t = target.get(r.id);
      if (t) {
        grades = t.grades;
        until = t.until;
        isPublic = !!t.grades;
      } else {
        const p = nameKeys(r.name).map((k) => byKey.get(k)).find(Boolean);
        if (p) {
          grades = joinTags(p.grades) ?? '등급 없음';
          until = p.until?.slice(0, 10) ?? null;
          // '네트워크관리사 1급'인데 2급만 공인이면 이 자격은 공인 아님 (공인 등급은 표시)
          isPublic = singleGradeIsPublic(r.grade, p.grades);
        }
      }
      if (grades) matched++;
      // 공인 목록과 이어졌는데 이 등급은 공인 아님 → 민간
      const kind = isPublic && r.kind === '등록민간' ? '국가공인민간' : grades && !isPublic && r.kind === '국가공인민간' ? '등록민간' : r.kind;
      if (grades !== r.publicGrades || until !== r.publicUntil || kind !== r.kind) {
        ops.push(this.prisma.certificate.update({ where: { id: r.id }, data: { publicGrades: grades, publicUntil: until, kind } }));
      }
    }
    if (del.length) ops.push(this.prisma.certificate.deleteMany({ where: { id: { in: del } } }));
    if (ops.length) await this.prisma.$transaction(ops);
    this.log.log(`공인민간 ${priv.length}종목 → 자격 ${matched}개 연결, 이름 다른 중복 ${del.length}개 정리`);
  }

  /** 이름이 같은 자격증에 Q-net 종목코드 저장 (취득자 통계 조회용) */
  private async fillJmCd(list: QnetJm[]): Promise<void> {
    const byName = new Map(list.map((j) => [norm(j.name), j.jmCd]));
    const rows = await this.prisma.certificate.findMany({ where: { jmCd: null }, select: { id: true, name: true } });
    const ops = rows
      .map((r) => ({ id: r.id, jm: r.id.startsWith('qnet-') ? r.id.slice(5) : byName.get(norm(r.name)) }))
      .filter((r): r is { id: string; jm: string } => !!r.jm)
      .map((r) => this.prisma.certificate.update({ where: { id: r.id }, data: { jmCd: r.jm } }));
    if (ops.length) await this.prisma.$transaction(ops);
  }

  /**
   * 취득자 통계 (「설명」 열 때). Q-net 종목만, 종목마다 1회 호출 → DB에 30일 보관.
   * 키 없거나 한도 넘으면 저장된 값(없으면 null) + 이유.
   */
  async stats(id: string): Promise<StatsView & { detail: CertDetail | null }> {
    const c = await this.get(id);
    const st = await this.statsOf(c);
    if (!c.jmCd) return { ...st, detail: (c.detail as CertDetail | null) ?? null };
    const pass = await this.passOf(c);
    let detail = (c.detail as CertDetail | null) ?? null;
    // 설명의 대략적인 합격률 문구 → 실제 숫자
    const real = passText(pass);
    if (real) {
      detail = detail ?? [];
      detail = detail.some((d) => d.label === '합격률') ? detail.map((d) => (d.label === '합격률' ? { ...d, text: real } : d)) : [...detail, { label: '합격률', text: real }];
    }
    return { ...st, pass, rate: passShort(pass) ?? st.rate ?? null, detail };
  }

  /**
   * 합격률 (필기·실기 2회 호출). 취득자 통계와 같은 30일 주기로 DB 보관.
   * 못 받으면(활용신청 대기 등) 저장값, 없으면 null.
   */
  private async passOf(c: Certificate): Promise<PassStats | null> {
    const saved = (c.passYears as PassStats | null) ?? null;
    if (!c.jmCd || (saved && c.statsAt && Date.now() - c.statsAt.getTime() < STATS_EVERY_MS)) return saved;
    const key = await this.key();
    if (!key) return saved;
    const base = new Date().getFullYear() - 1;
    const one = async (kind: 'Pi' | 'Si') => {
      try {
        return parsePassYears(await this.fetchText(qnetPassUrl(key, base, c.jmCd!, kind)), base);
      } catch (e) {
        this.log.warn(`합격률(${kind}) ${c.name}: ${errOf(e, '합격률')}`);
        return null;
      }
    };
    const [written, practical] = await Promise.all([one('Pi'), one('Si')]);
    if (!written && !practical) return saved;
    const pass: PassStats = { written: written ?? saved?.written ?? [], practical: practical ?? saved?.practical ?? [] };
    await this.prisma.certificate.update({ where: { id: c.id }, data: { passYears: pass as unknown as Prisma.InputJsonValue } }).catch(() => undefined);
    return pass;
  }

  /** 공개문제 목록 (국가기술 종목만, 「설명」에서 버튼 눌렀을 때) */
  async questions(id: string): Promise<{ items: OpenQst[]; note: string | null; url: string }> {
    const c = await this.get(id);
    const url = `${QNET_HOME}/cst003.do?id=cst00309&gSite=Q&gId=`;
    if (!c.jmCd) return { items: [], note: '공개문제는 Q-net 국가기술자격 종목만 제공', url };
    const key = await this.key();
    if (!key) return { items: [], note: 'Q-net 키 없음', url };
    try {
      const items = parseOpenQst(await this.fetchText(openQstUrl(key, c.jmCd)));
      return { items, note: items.length ? null : '공개문제 없음', url };
    } catch (e) {
      return { items: [], note: apiNote(errOf(e, '공개문제'), '국가자격 공개문제 조회 서비스'), url };
    }
  }

  /** 시험장소 (지사별). 7일 캐시 */
  async places(brch: string): Promise<{ branch: string; items: ExamArea[]; note: string | null }> {
    const branch = BRANCHES[brch];
    if (!branch) throw new BadRequestException('모르는 지역 코드');
    const key = await this.key();
    if (!key) return { branch, items: [], note: 'Q-net 키 없음' };
    try {
      const items: ExamArea[] = [];
      for (let page = 1; page <= 10; page++) {
        const got = parseExamArea(await this.fetchText(examAreaUrl(key, brch, page), AREA_CACHE_MS));
        items.push(...got);
        if (got.length < EXAM_AREA_PAGE) break;
      }
      return { branch, items, note: items.length ? null : '시험장소 없음' };
    } catch (e) {
      return { branch, items: [], note: apiNote(errOf(e, '시험장소'), '국가자격시험 시험장소 정보') };
    }
  }

  /** 지역 목록 */
  branches(): { code: string; name: string }[] {
    return Object.entries(BRANCHES).map(([code, name]) => ({ code, name }));
  }

  /** 민간자격 등록정보 (등록민간·국가공인민간, 「설명」 열 때) */
  async registry(id: string): Promise<{ items: KReg[]; note: string | null }> {
    const c = await this.get(id);
    if (c.kind !== '등록민간' && c.kind !== '국가공인민간') return { items: [], note: '민간자격만 해당' };
    const key = await this.key();
    if (!key) return { items: [], note: 'Q-net 키 없음' };
    // '네트워크관리사 2급' → '네트워크관리사'
    const q = baseOfVariant(c.name).base.replace(/\s*(\d|준\d)\s*급$/, '').trim() || c.name;
    try {
      const all = parseKReg(await this.fetchText(kregUrl(key, q)));
      const k = norm(q);
      const items = all.filter((r) => norm(r.name) === k || norm(r.name).includes(k) || k.includes(norm(r.name))).slice(0, 5);
      return { items, note: items.length ? null : '등록정보에서 못 찾음' };
    } catch (e) {
      return { items: [], note: apiNote(errOf(e, '민간자격등록정보'), '한국직업능력연구원_민간자격등록정보') };
    }
  }

  private async statsOf(c: Certificate): Promise<StatsView> {
    const id = c.id;
    const saved = c.statsYears ? { years: c.statsYears as CertStats['years'], total: c.statsTotal ?? 0 } : null;
    const acq = ACQ_BY_ID.get(c.id);
    if (!c.jmCd && acq && saved) return { stats: saved, at: null, note: ACQ_SOURCE, totalLabel: '5년 합계', rate: acqRate(acq) };
    if (!c.jmCd) return { stats: null, at: null, note: c.org === '한국산업인력공단' ? '새 자격증 확인(🔎) 한 번 돌면 연결됨' : '취득자 통계는 Q-net(한국산업인력공단) 시행 자격만 제공' };
    if (c.statsAt && Date.now() - c.statsAt.getTime() < STATS_EVERY_MS) return { stats: saved, at: c.statsAt, note: saved ? null : '통계 없음' };
    const key = await this.key();
    if (!key) return { stats: saved, at: c.statsAt, note: 'Q-net 키 없음' };
    // 지난해까지 (올해는 아직 진행 중)
    const base = new Date().getFullYear() - 1;
    try {
      const st = parseCertStats(await this.fetchText(qnetStatUrl(key, base, c.jmCd)), base);
      const now = new Date();
      await this.prisma.certificate.update({
        where: { id },
        data: { statsYears: st ? st.years : Prisma.DbNull, statsTotal: st?.total ?? null, statsAt: now },
      });
      return { stats: st, at: now, note: st ? null : '통계 없음' };
    } catch (e) {
      const msg = errOf(e, '취득자 통계');
      return { stats: saved, at: c.statsAt, note: /SERVICE_KEY|등록되지/.test(msg) ? '「산업인력 국가기술자격 통계 정보」 API 활용신청 필요' : msg };
    }
  }

  /** 받은 목록 중 DB에 없는 것만 행으로 */
  private async freshRows(list: QnetJm[], priv: KPrivate[], now: Date, kpro: KPro[] = []): Promise<Prisma.CertificateCreateManyInput[]> {
    const have = await this.prisma.certificate.findMany({ select: { id: true, name: true } });
    const ids = new Set(have.map((c) => c.id));
    const names = new Set(have.flatMap((c) => nameKeys(c.name)));
    const max = await this.prisma.certificate.aggregate({ _max: { position: true } });
    let pos = (max._max.position ?? 0) + 1;
    const out: Prisma.CertificateCreateManyInput[] = [];
    // 국가전문은 과목·급수별로 쪼개져 와서 기본 이름 하나로 묶음
    const pro = new Map<string, { id: string; base: string; tags: string[]; obligfld: string }>();
    for (const j of list) {
      if (ids.has(`qnet-${j.jmCd}`) || names.has(norm(j.name))) continue;
      if (/기능사보$/.test(j.name.trim())) continue; // 폐지 등급
      const grade = j.grade.trim();
      if (!isTechGrade(grade) || /전문/.test(j.qualgb)) {
        const { base, tag } = baseOfVariant(j.name);
        const k = norm(base);
        if (names.has(k)) continue;
        const g = pro.get(k) ?? { id: `qnet-${j.jmCd}`, base, tags: [], obligfld: j.obligfld };
        if (tag) g.tags.push(tag);
        pro.set(k, g);
        continue;
      }
      names.add(norm(j.name));
      const series = seriesOfGrade(grade);
      const d = defaultsOf('국가기술', grade, series);
      const f = fieldOfQnet(j.obligfld);
      out.push({
        id: `qnet-${j.jmCd}`,
        name: j.name,
        field: f === '기타' ? (fieldOfName(j.name) ?? f) : f,
        kind: '국가기술',
        grade,
        org: HRD,
        url: QNET_HOME,
        series,
        prep: d.prep,
        fee: d.fee,
        validity: '평생 (만료 없음)',
        position: pos++,
        discoveredAt: now,
      });
    }
    for (const [k, g] of pro) {
      if (ids.has(g.id)) continue;
      names.add(k);
      out.push({
        id: g.id,
        name: g.base,
        field: fieldOfName(g.base) ?? fieldOfQnet(g.obligfld),
        kind: '국가전문',
        grade: joinTags(g.tags),
        org: HRD,
        url: QNET_HOME,
        series: null,
        validity: '평생 (만료 없음)',
        position: pos++,
        discoveredAt: now,
      });
    }
    // 국가전문 전체 대조: 이름이 같거나, 기존 이름이 이 이름을 품으면('자가용조종사' ⊃ '조종사') 건너뜀
    const haveKeys = () => [...names];
    for (const p of kpro) {
      const keys = nameKeys(p.name);
      if (keys.some((k) => names.has(k))) continue;
      const n = norm(p.name);
      if (n.length >= 3 && haveKeys().some((k) => k.includes(n))) continue;
      const id = `kn-${createHash('sha1').update(n).digest('hex').slice(0, 10)}`;
      if (ids.has(id)) continue;
      keys.forEach((k) => names.add(k));
      out.push({
        id,
        name: p.name,
        field: fieldOfPrivate(p.name, p.ministry),
        kind: '국가전문',
        grade: joinTags(p.grades),
        org: p.org || p.ministry || '-',
        url: p.url,
        summary: [p.ministry, p.law].filter(Boolean).join(' · ') || null,
        series: null,
        position: pos++,
        discoveredAt: now,
      });
    }
    for (const p of priv) {
      if (aliasOf(p.name) || nameKeys(p.name).some((k) => names.has(k))) continue;
      const id = `kp-${createHash('sha1').update(norm(p.name)).digest('hex').slice(0, 10)}`;
      if (ids.has(id)) continue;
      nameKeys(p.name).forEach((k) => names.add(k));
      const d = defaultsOf('국가공인민간', null, null);
      const until = p.until ? ` · 공인 ~${p.until.slice(0, 10)}` : '';
      out.push({
        id,
        name: p.name,
        field: fieldOfPrivate(p.name, p.ministry),
        kind: '국가공인민간',
        grade: joinTags(p.grades),
        org: p.org || '한국직업능력연구원',
        url: PQI,
        summary: `국가공인 (${p.ministry || '소관부처 미상'})${until}`,
        series: null,
        prep: d.prep,
        fee: d.fee,
        validity: '기관별 상이 (보수교육·갱신 확인)',
        position: pos++,
        discoveredAt: now,
      });
    }
    return out;
  }

  /**
   * 예전 새 자격증 확인으로 들어온 Q-net 행 정리 (시작 때 1번, 여러 번 돌아도 같은 결과).
   * 국가전문: 종목명이 등급 칸에 들어가 기사 일정에 묶이던 것 고침 + 과목·급수 변형은 하나로.
   * 폐지된 기능사보 삭제. 별표·직접 넣은 일정 있는 건 지우지 않음.
   */
  private async tidyDiscovered(): Promise<void> {
    // 국가전문자격정보(kn-*) 분야 다시 계산 (이름 키워드 규칙이 바뀌면 따라감)
    const kn = await this.prisma.certificate.findMany({ where: { id: { startsWith: 'kn-' } }, select: { id: true, name: true, field: true, summary: true } });
    const knOps = kn
      .map((r) => ({ id: r.id, field: fieldOfPrivate(r.name, (r.summary ?? '').split(' · ')[0]), old: r.field }))
      .filter((r) => r.field !== r.old)
      .map((r) => this.prisma.certificate.update({ where: { id: r.id }, data: { field: r.field } }));
    if (knOps.length) await this.prisma.$transaction(knOps);
    const rows = await this.prisma.certificate.findMany({
      where: { id: { startsWith: 'qnet-' }, discoveredAt: { not: null } },
      include: { exams: { where: { source: 'manual' }, select: { id: true } } },
      orderBy: { position: 'asc' },
    });
    if (!rows.length) return;
    const rowIds = new Set(rows.map((r) => r.id));
    const others = await this.prisma.certificate.findMany({ where: { id: { notIn: [...rowIds] } }, select: { name: true } });
    const otherNames = new Set(others.flatMap((c) => nameKeys(c.name)));
    const keep = (r: (typeof rows)[number]) => r.starred || r.exams.length > 0;
    const del: string[] = [];
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const groups = new Map<string, { base: string; tags: string[]; rows: typeof rows }>();
    for (const r of rows) {
      if (/기능사보$/.test(r.name.trim())) {
        if (!keep(r)) del.push(r.id);
        continue;
      }
      if (r.kind === '국가기술' && isTechGrade(r.grade)) {
        if (r.field === '기타') {
          const f = fieldOfName(r.name);
          if (f) ops.push(this.prisma.certificate.update({ where: { id: r.id }, data: { field: f } }));
        }
        continue;
      }
      const { base, tag } = baseOfVariant(r.name);
      const k = norm(base);
      const g = groups.get(k) ?? { base, tags: [], rows: [] };
      // 이미 묶인 행이면 등급 칸에 변형 표시가 들어 있음
      const t = tag ?? (r.grade && !isTechGrade(r.grade) && norm(r.grade) !== norm(r.name) ? r.grade : null);
      if (t) g.tags.push(t);
      g.rows.push(r);
      groups.set(k, g);
    }
    for (const [k, g] of groups) {
      const fix = { kind: '국가전문', series: null, field: fieldOfName(g.base) ?? g.rows[0].field };
      // 같은 이름이 기본 목록 등에 이미 있으면 변형은 지움
      const main = otherNames.has(k) ? null : (g.rows.find(keep) ?? g.rows[0]);
      for (const r of g.rows) {
        if (r === main) {
          ops.push(
            this.prisma.certificate.update({
              where: { id: r.id },
              data: { ...fix, name: g.base, grade: joinTags(g.tags), prep: null, fee: null },
            }),
          );
        } else if (!keep(r)) {
          del.push(r.id);
        } else {
          ops.push(this.prisma.certificate.update({ where: { id: r.id }, data: { ...fix, grade: baseOfVariant(r.name).tag, prep: null, fee: null } }));
        }
      }
    }
    if (del.length) ops.push(this.prisma.certificate.deleteMany({ where: { id: { in: del } } }));
    if (ops.length) await this.prisma.$transaction(ops);
    if (del.length) this.log.log(`새 자격증 정리: 변형·폐지 ${del.length}개 삭제`);
  }

  private async doSync(): Promise<number> {
    const key = await this.key();
    if (!key) throw new Error('Q-net API 키 없음. 공공데이터포털에서 활용신청 후 입력');
    const year = new Date().getFullYear();
    // 국가전문은 이름으로 연결
    const pro = (await this.prisma.certificate.findMany({ where: { kind: '국가전문' }, select: { id: true, name: true } }))
      .map((c) => ({ id: c.id, n: norm(c.name) }))
      .sort((a, b) => b.n.length - a.n.length);
    let count = 0;
    try {
      for (const y of [year, year + 1]) {
        for (const gb of ['T', 'S'] as QnetGb[]) {
          const rounds = await this.pages((p) => qnetUrl(key, y, gb, p), parseQnet);
          const keys: string[] = [];
          for (const r of rounds) {
            const d = norm(r.description);
            const series = gb === 'T' ? seriesOf(r.description) : null;
            const certId = gb === 'S' ? (pro.find((p) => d.includes(p.n))?.id ?? null) : null;
            if (!series && !certId) continue;
            const phases: [string, QnetPhase | null][] = [
              [gb === 'T' ? '필기' : '1차', r.doc],
              [gb === 'T' ? '실기' : '2차', r.prac],
            ];
            for (const [phase, p] of phases) {
              if (!p) continue;
              const externalKey = `qnet:${gb}:${r.year || y}:${r.seq}:${phase}:${d}`;
              keys.push(externalKey);
              const data = { certId, series, source: 'qnet', title: r.description || `${y} ${r.seq}회`, phase, ...p };
              await this.prisma.certExam.upsert({ where: { externalKey }, create: { externalKey, ...data }, update: data });
              count++;
            }
          }
          // 이번 응답에 없는 옛 자동 일정 정리 (응답이 비면 건드리지 않음)
          if (keys.length) {
            await this.prisma.certExam.deleteMany({
              where: { source: 'qnet', externalKey: { startsWith: `qnet:${gb}:${y}:`, notIn: keys } },
            });
          }
        }
      }
      await this.prisma.certConfig.update({ where: { id: 1 }, data: { lastSyncAt: new Date(), lastError: null, lastCount: count } });
      this.log.log(`자격증 일정 ${count}건 수집`);
      return count;
    } catch (e) {
      const msg = (e as Error).name === 'TimeoutError' ? 'Q-net API 응답 시간 초과' : (e as Error).message;
      await this.prisma.certConfig.update({ where: { id: 1 }, data: { lastSyncAt: new Date(), lastError: msg } });
      throw new Error(msg);
    }
  }
}

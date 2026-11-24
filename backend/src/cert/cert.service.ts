import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { CertExam, Certificate, Prisma } from '@prisma/client';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { baseOfVariant, CATALOG, CERT_FIELDS, CERT_KINDS, defaultsOf, fieldOfName, fieldOfPrivate, fieldOfQnet, isTechGrade, joinTags, SERIES_LABEL, seriesOfGrade } from './catalog';
import { KPrivate, kprivateUrl, norm, parseJmList, parseKPrivate, parseQnet, QNET_PAGE, QnetGb, QnetJm, qnetJmUrl, QnetPhase, qnetUrl, seriesOf } from './qnet';

const DAY = 86_400_000;
const CATALOG_IDS = new Set(CATALOG.map((c) => c.id));
/** 자동 수집 주기 */
const SYNC_EVERY_MS = 24 * 3_600_000;
const FETCH_TIMEOUT_MS = 20_000;
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
const QNET_HOME = 'https://www.q-net.or.kr';
const HRD = '한국산업인력공단';
/** 민간자격정보서비스 (공인민간 상세 확인처) */
const PQI = 'https://www.pqi.or.kr';

/** 이름 비교 키: 전체, 괄호 뺀 기본 이름, 괄호 안 이름(3자 이상). 'TESAT' ↔ '경제이해력검증시험(TESAT)' 중복 방지 */
function nameKeys(name: string): string[] {
  const { base } = baseOfVariant(name);
  const keys = [norm(name), norm(base)];
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
  /** 최근 Q-net 종목 목록에서 새로 추가됨 */
  isNew: boolean;
  starred: boolean;
  custom: boolean;
  /** 끝나지 않은 회차 (가까운 순) */
  exams: ExamView[];
}

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
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seed();
      await this.tidyDiscovered();
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

  private view(c: Certificate, exams: CertExam[]): CertView {
    return {
      id: c.id,
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
      isNew: !!c.discoveredAt && Date.now() - c.discoveredAt.getTime() < NEW_FOR_MS,
      starred: c.starred,
      custom: c.custom,
      exams: exams.map((e) => this.examView(e)),
    };
  }

  /** 끝나지 않은 회차 → 자격증별로 묶기 (자기 일정 + 묶음 일정) */
  private async upcoming(certs: Certificate[]): Promise<Map<string, CertExam[]>> {
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
    const certs = await this.prisma.certificate.findMany({ where, orderBy: [{ starred: 'desc' }, { custom: 'desc' }, { position: 'asc' }, { name: 'asc' }] });
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
        kind: b.kind ?? '민간',
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
    return (await this.cfg()).qnetKey ?? this.config.get('QNET_API_KEY', { infer: true }) ?? null;
  }

  async getConfig(): Promise<CertConfigView> {
    const c = await this.cfg();
    return {
      key: c.qnetKey ? mask(c.qnetKey) : null,
      envKey: !c.qnetKey && !!this.config.get('QNET_API_KEY', { infer: true }),
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

  private async fetchText(url: string): Promise<string> {
    await this.countCall();
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { Accept: 'application/json, application/xml' } });
    const text = await res.text();
    if (!res.ok) throw new Error(`Q-net API HTTP ${res.status}: ${text.slice(0, 120)}`);
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
    const now = new Date();
    const fresh = await this.freshRows(list, priv, now);
    if (fresh.length) await this.prisma.certificate.createMany({ data: fresh, skipDuplicates: true });
    const error = errors.join(' / ') || null;
    await this.prisma.certConfig.update({ where: { id: 1 }, data: { lastCatalogAt: now, lastCatalogNew: fresh.length, lastCatalogError: error } });
    this.log.log(`새 자격증 ${fresh.length}개 추가 (Q-net 종목 ${list.length}개, 공인민간 ${priv.length}개 확인)`);
    if (!list.length && !priv.length && error) throw new BadRequestException(error);
    return this.getConfig();
  }

  /** 받은 목록 중 DB에 없는 것만 행으로 */
  private async freshRows(list: QnetJm[], priv: KPrivate[], now: Date): Promise<Prisma.CertificateCreateManyInput[]> {
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
    for (const p of priv) {
      if (nameKeys(p.name).some((k) => names.has(k))) continue;
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

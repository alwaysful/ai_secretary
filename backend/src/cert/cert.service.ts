import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { CertExam, Certificate, Prisma } from '@prisma/client';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { CATALOG, CERT_FIELDS, CERT_KINDS, defaultsOf, fieldOfQnet, SERIES_LABEL, seriesOfGrade } from './catalog';
import { norm, parseJmList, parseQnet, QnetGb, qnetJmUrl, QnetPhase, qnetUrl, seriesOf } from './qnet';

const DAY = 86_400_000;
/** 자동 수집 주기 */
const SYNC_EVERY_MS = 24 * 3_600_000;
const FETCH_TIMEOUT_MS = 20_000;
/** 새 자격증 확인 주기 (목록은 DB에 두고 가끔만) */
const CATALOG_EVERY_MS = 7 * DAY;
/** 새로 찾은 자격증 '새' 표시 기간 */
const NEW_FOR_MS = 30 * DAY;

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
  prepEdited: boolean;
  feeEdited: boolean;
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
    const have = new Set((await this.prisma.certificate.findMany({ select: { id: true } })).map((c) => c.id));
    const rows = CATALOG.map((c, i) => ({ ...c, position: i }));
    const fresh = rows.filter((r) => !have.has(r.id));
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
      prepEdited: c.userPrep !== null,
      feeEdited: c.userFee !== null,
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
    };
  }

  /** null = 화면 키 삭제 */
  async setKey(key: string | null): Promise<CertConfigView> {
    await this.cfg();
    await this.prisma.certConfig.update({ where: { id: 1 }, data: { qnetKey: key?.trim() || null, lastError: null } });
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
    if (!this.syncing) this.syncing = this.doSync().finally(() => (this.syncing = null));
    try {
      await this.syncing;
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return this.getConfig();
  }

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { Accept: 'application/json, application/xml' } });
    const text = await res.text();
    if (!res.ok) throw new Error(`Q-net API HTTP ${res.status}: ${text.slice(0, 120)}`);
    return text;
  }

  /**
   * 새 자격증 확인: Q-net 국가자격 종목 목록과 DB 비교 → 없는 종목만 추가.
   * 목록 전체는 DB에 저장해 두고 이 확인만 주 1회 (또는 버튼).
   */
  async discover(): Promise<CertConfigView> {
    const key = await this.key();
    if (!key) throw new BadRequestException('Q-net API 키 없음. 공공데이터포털에서 활용신청 후 입력');
    await this.cfg();
    try {
      const list = parseJmList(await this.fetchText(qnetJmUrl(key)));
      if (!list.length) throw new Error('Q-net 종목 목록이 비어 있음 (종목 목록 API 활용신청 확인)');
      const have = await this.prisma.certificate.findMany({ select: { id: true, name: true } });
      const ids = new Set(have.map((c) => c.id));
      const names = new Set(have.map((c) => norm(c.name)));
      const max = await this.prisma.certificate.aggregate({ _max: { position: true } });
      let pos = (max._max.position ?? 0) + 1;
      const now = new Date();
      const fresh = list
        .filter((j) => !ids.has(`qnet-${j.jmCd}`) && !names.has(norm(j.name)))
        .map((j) => {
          const grade = j.grade || null;
          const series = grade ? seriesOfGrade(grade) : null;
          const d = defaultsOf('국가기술', grade, series);
          names.add(norm(j.name));
          return {
            id: `qnet-${j.jmCd}`,
            name: j.name,
            field: fieldOfQnet(j.obligfld),
            kind: /전문/.test(j.qualgb) ? '국가전문' : '국가기술',
            grade,
            org: '한국산업인력공단',
            url: 'https://www.q-net.or.kr',
            series,
            prep: d.prep,
            fee: d.fee,
            position: pos++,
            discoveredAt: now,
          };
        });
      if (fresh.length) await this.prisma.certificate.createMany({ data: fresh, skipDuplicates: true });
      await this.prisma.certConfig.update({ where: { id: 1 }, data: { lastCatalogAt: now, lastCatalogNew: fresh.length, lastCatalogError: null } });
      this.log.log(`새 자격증 ${fresh.length}개 추가 (Q-net 종목 ${list.length}개 확인)`);
    } catch (e) {
      const msg = (e as Error).name === 'TimeoutError' ? 'Q-net 종목 목록 응답 시간 초과' : (e as Error).message;
      await this.prisma.certConfig.update({ where: { id: 1 }, data: { lastCatalogAt: new Date(), lastCatalogError: msg } });
      throw new BadRequestException(msg);
    }
    return this.getConfig();
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
          const rounds = parseQnet(await this.fetchText(qnetUrl(key, y, gb)));
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

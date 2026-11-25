import type { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Client } from 'pg';
import type { PrismaService } from '../prisma.service';

type Row = Record<string, unknown>;

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const date = (v: unknown) => (v ? new Date(String(v)) : null);
const json = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));

/**
 * 첫 실행 1번: 옛 AURA DB(자격증이 AURA 안에 있던 때)의 자격증·자동 일정·키 가져오기.
 * 번호·종목코드·통계 유지 → 다시 수집 안 해도 됨. 사용자 자료(별표·직접 추가·직접 일정)는 AURA 쪽 이전 마이그레이션이 옮김.
 */
export async function importLegacy(prisma: PrismaService, log: Logger): Promise<void> {
  if ((await prisma.certificate.count()) > 0) return;
  const url = process.env.CERT_LEGACY_DATABASE_URL;
  if (!url) return;
  const db = new Client({ connectionString: url.replace(/\?schema=\w+$/, '') });
  try {
    await db.connect();
    const has = await db.query(`SELECT to_regclass('public."Certificate"') AS t`);
    if (!has.rows[0]?.t) return;
    const certs = (await db.query<{ r: Row }>(`SELECT to_jsonb(c) AS r FROM "Certificate" c WHERE NOT c.custom`)).rows.map((x) => x.r);
    if (!certs.length) return;
    const ids = new Set(certs.map((c) => String(c.id)));
    const exams = (await db.query<{ r: Row }>(`SELECT to_jsonb(e) AS r FROM "CertExam" e WHERE e.source <> 'manual'`)).rows
      .map((x) => x.r)
      .filter((e) => !e.certId || ids.has(String(e.certId)));
    const cfg = (await db.query<{ r: Row }>(`SELECT to_jsonb(c) AS r FROM "CertConfig" c WHERE c.id = 1`)).rows[0]?.r;
    await prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < certs.length; i += 1000) {
          await tx.certificate.createMany({
            data: certs.slice(i, i + 1000).map((c) => ({
              id: String(c.id),
              no: (c.no as number | null) ?? null,
              name: String(c.name),
              field: String(c.field),
              kind: String(c.kind),
              grade: str(c.grade),
              org: String(c.org ?? '-'),
              url: str(c.url),
              summary: str(c.summary),
              series: str(c.series),
              prep: str(c.prep),
              fee: str(c.fee),
              validity: str(c.validity),
              jmCd: str(c.jmCd),
              publicGrades: str(c.publicGrades),
              publicUntil: str(c.publicUntil),
              statsYears: json(c.statsYears),
              statsTotal: (c.statsTotal as number | null) ?? null,
              statsAt: date(c.statsAt),
              passYears: json(c.passYears),
              detail: json(c.detail),
              discoveredAt: date(c.discoveredAt),
              position: Number(c.position ?? 0),
            })),
            skipDuplicates: true,
          });
        }
        if (exams.length) {
          await tx.certExam.createMany({
            data: exams.map((e) => ({
              id: String(e.id),
              certId: str(e.certId),
              series: str(e.series),
              source: String(e.source ?? 'qnet'),
              externalKey: str(e.externalKey),
              title: String(e.title),
              phase: str(e.phase),
              regStart: date(e.regStart),
              regEnd: date(e.regEnd),
              examStart: date(e.examStart),
              examEnd: date(e.examEnd),
              resultAt: date(e.resultAt),
              note: str(e.note),
            })),
            skipDuplicates: true,
          });
        }
        if (cfg?.qnetKey) await tx.certConfig.upsert({ where: { id: 1 }, create: { id: 1, qnetKey: String(cfg.qnetKey) }, update: {} });
        // 마지막 수집 시각 이어받기 → 바로 다시 부르지 않음
        const jobs: [string, unknown, unknown, unknown][] = [
          ['schedule', cfg?.lastSyncAt, cfg?.lastError, cfg?.lastCount],
          ['catalog', cfg?.lastCatalogAt, cfg?.lastCatalogError, cfg?.lastCatalogNew],
        ];
        for (const [name, at, err, count] of jobs) {
          if (!at) continue;
          const d = new Date(String(at));
          await tx.certJob.create({ data: { name, lastAt: d, lastOkAt: err ? null : d, lastError: str(err), lastCount: Number(count ?? 0) } });
        }
      },
      { timeout: 120_000 },
    );
    log.log(`옛 AURA DB에서 자격증 ${certs.length}개, 자동 일정 ${exams.length}건 가져옴`);
  } catch (e) {
    log.warn(`옛 자격증 자료 가져오기 실패 (새로 수집함): ${(e as Error).message}`);
  } finally {
    await db.end().catch(() => undefined);
  }
}

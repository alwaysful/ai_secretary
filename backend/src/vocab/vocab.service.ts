import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VocabCard, VocabDeck } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CardInput, parseDeck, toExport } from './format';
import { dayStart, Grade, preview, schedule } from './srs';

const DAY = 86_400_000;
const QUEUE_MAX = 50;
const ROUND_BATCH = 100;

export interface DeckPatch {
  name?: string;
  description?: string | null;
  language?: string | null;
  newPerDay?: number;
  reviewPerDay?: number;
  direction?: 'front' | 'back';
}

export type CardPatch = Partial<Omit<CardInput, 'tags'>> & { tags?: string[]; starred?: boolean; known?: boolean };

const nul = (v: string | undefined | null) => (v?.trim() ? v.trim() : null);

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 단어장: 업로드·SRS 복습·회독·퀴즈·통계 */
@Injectable()
export class VocabService {
  constructor(private readonly prisma: PrismaService) {}

  private async deck(id: string): Promise<VocabDeck> {
    const d = await this.prisma.vocabDeck.findUnique({ where: { id } });
    if (!d) throw new NotFoundException({ code: 'NOT_FOUND', message: '단어장 없음' });
    return d;
  }

  private async card(id: string): Promise<VocabCard> {
    const c = await this.prisma.vocabCard.findUnique({ where: { id } });
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: '카드 없음' });
    return c;
  }

  /** 오늘 남은 새 카드·복습 수 등 */
  private async summary(d: VocabDeck, now = new Date()) {
    const start = dayStart(now);
    const end = new Date(start.getTime() + DAY);
    const p = this.prisma.vocabCard;
    const [groups, newToday, reviewedToday, learnDue, reviewDue, known, seen] = await Promise.all([
      p.groupBy({ by: ['state'], where: { deckId: d.id }, _count: { _all: true } }),
      p.count({ where: { deckId: d.id, firstAt: { gte: start } } }),
      p.count({ where: { deckId: d.id, state: { in: ['review', 'relearning'] }, lastAt: { gte: start }, firstAt: { lt: start } } }),
      p.count({ where: { deckId: d.id, state: { in: ['learning', 'relearning'] }, due: { lt: end } } }),
      p.count({ where: { deckId: d.id, state: 'review', due: { lt: end } } }),
      p.count({ where: { deckId: d.id, known: true } }),
      p.count({ where: { deckId: d.id, roundSeen: { gte: d.round } } }),
    ]);
    const by = Object.fromEntries(groups.map((g) => [g.state, g._count._all])) as Record<string, number>;
    const total = groups.reduce((s, g) => s + g._count._all, 0);
    const newCount = by.new ?? 0;
    return {
      total,
      new: newCount,
      learning: (by.learning ?? 0) + (by.relearning ?? 0),
      review: by.review ?? 0,
      today: {
        new: Math.max(0, Math.min(newCount, d.newPerDay - newToday)),
        learn: learnDue,
        review: Math.max(0, Math.min(reviewDue, d.reviewPerDay - reviewedToday)),
        doneNew: newToday,
        doneReview: reviewedToday,
      },
      known,
      roundSeen: seen,
    };
  }

  async list() {
    const decks = await this.prisma.vocabDeck.findMany({ orderBy: { updatedAt: 'desc' } });
    return Promise.all(decks.map(async (d) => ({ ...d, summary: await this.summary(d) })));
  }

  async get(id: string) {
    const d = await this.deck(id);
    return { ...d, summary: await this.summary(d) };
  }

  async create(name: string) {
    return this.prisma.vocabDeck.create({ data: { name: name.trim().slice(0, 100) || '새 단어장' } });
  }

  /** JSON 업로드. deckId 있으면 그 단어장에 추가 (같은 앞·뒤면 건너뜀) */
  async import(data: unknown, opts: { deckId?: string; name?: string } = {}) {
    let parsed;
    try {
      parsed = parseDeck(data);
    } catch (e) {
      throw new BadRequestException({ code: 'BAD_FORMAT', message: `양식 오류: ${e instanceof Error ? e.message : String(e)}` });
    }
    let deck: VocabDeck;
    let existing = new Set<string>();
    let pos = 0;
    if (opts.deckId) {
      deck = await this.deck(opts.deckId);
      const rows = await this.prisma.vocabCard.findMany({ where: { deckId: deck.id }, select: { front: true, back: true, position: true } });
      existing = new Set(rows.map((r) => `${r.front}\u0000${r.back}`));
      pos = rows.reduce((m, r) => Math.max(m, r.position + 1), 0);
    } else {
      deck = await this.prisma.vocabDeck.create({
        data: {
          name: (opts.name?.trim() || parsed.name || '새 단어장').slice(0, 100),
          description: parsed.description ?? null,
          language: parsed.language ?? null,
        },
      });
    }
    const seen = new Set(existing);
    const rows: Prisma.VocabCardCreateManyInput[] = [];
    let dup = 0;
    for (const c of parsed.cards) {
      const key = `${c.front}\u0000${c.back}`;
      if (seen.has(key)) {
        dup++;
        continue;
      }
      seen.add(key);
      rows.push({
        deckId: deck.id,
        position: pos++,
        front: c.front,
        back: c.back,
        reading: c.reading ?? null,
        example: c.example ?? null,
        exampleMeaning: c.exampleMeaning ?? null,
        note: c.note ?? null,
        tags: c.tags,
      });
    }
    for (let i = 0; i < rows.length; i += 1000) await this.prisma.vocabCard.createMany({ data: rows.slice(i, i + 1000) });
    await this.prisma.vocabDeck.update({ where: { id: deck.id }, data: { updatedAt: new Date() } });
    return { deck: await this.get(deck.id), added: rows.length, duplicates: dup, skipped: parsed.skipped, errors: parsed.errors };
  }

  async export(id: string) {
    const d = await this.deck(id);
    const cards = await this.prisma.vocabCard.findMany({ where: { deckId: id }, orderBy: { position: 'asc' } });
    return toExport(
      d,
      cards.map((c) => ({
        front: c.front,
        back: c.back,
        reading: c.reading ?? undefined,
        example: c.example ?? undefined,
        exampleMeaning: c.exampleMeaning ?? undefined,
        note: c.note ?? undefined,
        tags: c.tags,
      })),
    );
  }

  async update(id: string, p: DeckPatch) {
    await this.deck(id);
    await this.prisma.vocabDeck.update({
      where: { id },
      data: {
        ...(p.name !== undefined ? { name: p.name.trim().slice(0, 100) || '단어장' } : {}),
        ...(p.description !== undefined ? { description: nul(p.description) } : {}),
        ...(p.language !== undefined ? { language: nul(p.language) } : {}),
        ...(p.newPerDay !== undefined ? { newPerDay: p.newPerDay } : {}),
        ...(p.reviewPerDay !== undefined ? { reviewPerDay: p.reviewPerDay } : {}),
        ...(p.direction !== undefined ? { direction: p.direction } : {}),
      },
    });
    return this.get(id);
  }

  async remove(id: string) {
    await this.deck(id);
    await this.prisma.vocabDeck.delete({ where: { id } });
  }

  /** 진도 초기화. srs: 복습 기록, round: 회독, all: 둘 다 + 통계 기록 */
  async reset(id: string, what: 'srs' | 'round' | 'all') {
    await this.deck(id);
    const srs = { state: 'new', due: new Date(), interval: 0, ease: 2.5, step: 0, reps: 0, lapses: 0, firstAt: null, lastAt: null };
    const round = { roundSeen: 0, known: false, wrongCount: 0 };
    await this.prisma.$transaction([
      this.prisma.vocabCard.updateMany({ where: { deckId: id }, data: what === 'srs' ? srs : what === 'round' ? round : { ...srs, ...round } }),
      ...(what !== 'srs' ? [this.prisma.vocabDeck.update({ where: { id }, data: { round: 1 } })] : []),
      ...(what === 'all' ? [this.prisma.vocabReview.deleteMany({ where: { deckId: id } })] : []),
    ]);
    return this.get(id);
  }

  // ---------- SRS ----------

  async queue(id: string, now = new Date()) {
    const d = await this.deck(id);
    const s = await this.summary(d, now);
    const end = new Date(dayStart(now).getTime() + DAY);
    const p = this.prisma.vocabCard;
    const [learn, review, fresh, nextLearn] = await Promise.all([
      p.findMany({ where: { deckId: id, state: { in: ['learning', 'relearning'] }, due: { lte: now } }, orderBy: { due: 'asc' }, take: QUEUE_MAX }),
      s.today.review > 0
        ? p.findMany({ where: { deckId: id, state: 'review', due: { lt: end } }, orderBy: { due: 'asc' }, take: Math.min(QUEUE_MAX, s.today.review) })
        : Promise.resolve([]),
      s.today.new > 0
        ? p.findMany({ where: { deckId: id, state: 'new' }, orderBy: { position: 'asc' }, take: Math.min(QUEUE_MAX, s.today.new) })
        : Promise.resolve([]),
      p.findFirst({ where: { deckId: id, state: { in: ['learning', 'relearning'] }, due: { gt: now, lt: end } }, orderBy: { due: 'asc' }, select: { due: true } }),
    ]);
    const cards = [...learn, ...review, ...fresh].slice(0, QUEUE_MAX).map((c) => ({ ...c, preview: preview(c, now) }));
    return { deck: { ...d, summary: s }, cards, nextLearnAt: nextLearn?.due ?? null };
  }

  async review(cardId: string, grade: Grade, now = new Date()) {
    const c = await this.card(cardId);
    const n = schedule(c, grade, now);
    const [card] = await this.prisma.$transaction([
      this.prisma.vocabCard.update({
        where: { id: c.id },
        data: {
          ...n,
          reps: { increment: 1 },
          ...(grade === 1 && c.state === 'review' ? { lapses: { increment: 1 } } : {}),
          ...(c.firstAt ? {} : { firstAt: now }),
          lastAt: now,
        },
      }),
      this.prisma.vocabReview.create({ data: { deckId: c.deckId, cardId: c.id, at: now, mode: 'srs', grade, correct: grade > 1 } }),
      this.prisma.vocabDeck.update({ where: { id: c.deckId }, data: { updatedAt: now } }),
    ]);
    return card;
  }

  // ---------- 회독 ----------

  async round(id: string, opts: { shuffle?: boolean } = {}) {
    const d = await this.deck(id);
    const where: Prisma.VocabCardWhereInput = { deckId: id, roundSeen: { lt: d.round } };
    const [left, total, known] = await Promise.all([
      this.prisma.vocabCard.findMany({ where, orderBy: { position: 'asc' } }),
      this.prisma.vocabCard.count({ where: { deckId: id } }),
      this.prisma.vocabCard.count({ where: { deckId: id, known: true } }),
    ]);
    const list = opts.shuffle ? shuffle(left) : left;
    return { round: d.round, total, left: left.length, known, cards: list.slice(0, ROUND_BATCH) };
  }

  async roundAnswer(cardId: string, known: boolean) {
    const c = await this.card(cardId);
    const d = await this.deck(c.deckId);
    const [card] = await this.prisma.$transaction([
      this.prisma.vocabCard.update({
        where: { id: c.id },
        data: { known, roundSeen: d.round, ...(known ? {} : { wrongCount: { increment: 1 } }) },
      }),
      this.prisma.vocabReview.create({ data: { deckId: c.deckId, cardId: c.id, mode: 'round', grade: known ? 1 : 0, correct: known } }),
      this.prisma.vocabDeck.update({ where: { id: c.deckId }, data: { updatedAt: new Date() } }),
    ]);
    return card;
  }

  /** 다음 회독 시작. unknownOnly면 외운 카드는 이번 회독에서 건너뜀 */
  async nextRound(id: string, unknownOnly: boolean) {
    const d = await this.deck(id);
    const next = d.round + 1;
    await this.prisma.$transaction([
      this.prisma.vocabDeck.update({ where: { id }, data: { round: next } }),
      ...(unknownOnly ? [this.prisma.vocabCard.updateMany({ where: { deckId: id, known: true }, data: { roundSeen: next } })] : []),
    ]);
    return this.round(id);
  }

  // ---------- 퀴즈 ----------

  async quiz(id: string, o: { n: number; dir: 'fb' | 'bf'; pool: 'all' | 'wrong' | 'starred' | 'unknown' }) {
    await this.deck(id);
    const where: Prisma.VocabCardWhereInput = {
      deckId: id,
      ...(o.pool === 'wrong' ? { wrongCount: { gt: 0 } } : o.pool === 'starred' ? { starred: true } : o.pool === 'unknown' ? { known: false } : {}),
    };
    const all = await this.prisma.vocabCard.findMany({ where: { deckId: id }, select: { id: true, front: true, back: true, reading: true } });
    const poolIds = o.pool === 'all' ? null : new Set((await this.prisma.vocabCard.findMany({ where, select: { id: true } })).map((c) => c.id));
    const pool = poolIds ? all.filter((c) => poolIds.has(c.id)) : all;
    if (all.length < 4) throw new BadRequestException({ code: 'TOO_FEW', message: '퀴즈는 카드 4개 이상 필요' });
    const answerOf = (c: (typeof all)[number]) => (o.dir === 'fb' ? c.back : c.front);
    const picked = shuffle([...pool]).slice(0, o.n);
    return picked.map((c) => {
      const right = answerOf(c);
      const wrong = new Set<string>();
      for (const x of shuffle([...all])) {
        const a = answerOf(x);
        if (a !== right) wrong.add(a);
        if (wrong.size >= 3) break;
      }
      const choices = shuffle([right, ...wrong]);
      return {
        cardId: c.id,
        prompt: o.dir === 'fb' ? c.front : c.back,
        reading: o.dir === 'fb' ? c.reading : null,
        hint: o.dir === 'bf' ? c.reading : null,
        choices,
        answer: choices.indexOf(right),
      };
    });
  }

  async quizAnswer(cardId: string, correct: boolean) {
    const c = await this.card(cardId);
    await this.prisma.$transaction([
      ...(correct ? [] : [this.prisma.vocabCard.update({ where: { id: c.id }, data: { wrongCount: { increment: 1 } } })]),
      this.prisma.vocabReview.create({ data: { deckId: c.deckId, cardId: c.id, mode: 'quiz', grade: correct ? 1 : 0, correct } }),
    ]);
    return { ok: true };
  }

  // ---------- 카드 목록·편집 ----------

  async cards(id: string, o: { q?: string; filter?: string; skip: number; take: number }) {
    await this.deck(id);
    const q = o.q?.trim();
    const where: Prisma.VocabCardWhereInput = {
      deckId: id,
      ...(q
        ? {
            OR: [
              { front: { contains: q, mode: 'insensitive' } },
              { back: { contains: q, mode: 'insensitive' } },
              { reading: { contains: q, mode: 'insensitive' } },
              { tags: { has: q } },
            ],
          }
        : {}),
      ...(o.filter === 'starred'
        ? { starred: true }
        : o.filter === 'wrong'
          ? { wrongCount: { gt: 0 } }
          : o.filter === 'known'
            ? { known: true }
            : o.filter === 'unknown'
              ? { known: false }
              : o.filter && ['new', 'learning', 'review'].includes(o.filter)
                ? { state: o.filter === 'learning' ? { in: ['learning', 'relearning'] } : o.filter }
                : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.vocabCard.findMany({
        where,
        orderBy: o.filter === 'wrong' ? [{ wrongCount: 'desc' }, { position: 'asc' }] : { position: 'asc' },
        skip: o.skip,
        take: o.take,
      }),
      this.prisma.vocabCard.count({ where }),
    ]);
    return { items, total };
  }

  async addCard(id: string, c: CardInput) {
    await this.deck(id);
    const last = await this.prisma.vocabCard.findFirst({ where: { deckId: id }, orderBy: { position: 'desc' }, select: { position: true } });
    return this.prisma.vocabCard.create({
      data: {
        deckId: id,
        position: (last?.position ?? -1) + 1,
        front: c.front.trim(),
        back: c.back.trim(),
        reading: nul(c.reading),
        example: nul(c.example),
        exampleMeaning: nul(c.exampleMeaning),
        note: nul(c.note),
        tags: c.tags ?? [],
      },
    });
  }

  async updateCard(cardId: string, p: CardPatch) {
    await this.card(cardId);
    return this.prisma.vocabCard.update({
      where: { id: cardId },
      data: {
        ...(p.front !== undefined ? { front: p.front.trim() } : {}),
        ...(p.back !== undefined ? { back: p.back.trim() } : {}),
        ...(p.reading !== undefined ? { reading: nul(p.reading) } : {}),
        ...(p.example !== undefined ? { example: nul(p.example) } : {}),
        ...(p.exampleMeaning !== undefined ? { exampleMeaning: nul(p.exampleMeaning) } : {}),
        ...(p.note !== undefined ? { note: nul(p.note) } : {}),
        ...(p.tags !== undefined ? { tags: p.tags } : {}),
        ...(p.starred !== undefined ? { starred: p.starred } : {}),
        ...(p.known !== undefined ? { known: p.known } : {}),
      },
    });
  }

  async removeCard(cardId: string) {
    await this.card(cardId);
    await this.prisma.vocabCard.delete({ where: { id: cardId } });
  }

  // ---------- 통계 ----------

  async stats(id: string, days = 30, now = new Date()) {
    const d = await this.deck(id);
    const start = dayStart(now);
    const from = new Date(start.getTime() - (days - 1) * DAY);
    const [summary, logs, mature, starred, wrong, hardest, upcoming] = await Promise.all([
      this.summary(d, now),
      this.prisma.vocabReview.findMany({ where: { deckId: id, at: { gte: from } }, select: { at: true, mode: true, correct: true } }),
      this.prisma.vocabCard.count({ where: { deckId: id, state: 'review', interval: { gte: 21 } } }),
      this.prisma.vocabCard.count({ where: { deckId: id, starred: true } }),
      this.prisma.vocabCard.count({ where: { deckId: id, wrongCount: { gt: 0 } } }),
      this.prisma.vocabCard.findMany({
        where: { deckId: id, OR: [{ wrongCount: { gt: 0 } }, { lapses: { gt: 0 } }] },
        orderBy: [{ wrongCount: 'desc' }, { lapses: 'desc' }],
        take: 10,
        select: { id: true, front: true, back: true, reading: true, wrongCount: true, lapses: true },
      }),
      this.prisma.vocabCard.findMany({
        where: { deckId: id, state: 'review', due: { lt: new Date(start.getTime() + 8 * DAY) } },
        select: { due: true },
      }),
    ]);

    const dates: string[] = [];
    const daily = Array.from({ length: days }, (_, i) => {
      const t = new Date(from.getTime() + i * DAY);
      dates.push(`${t.getMonth() + 1}/${t.getDate()}`);
      return { srs: 0, round: 0, quiz: 0, correct: 0 };
    });
    const mode = { srs: { n: 0, ok: 0 }, round: { n: 0, ok: 0 }, quiz: { n: 0, ok: 0 } };
    for (const l of logs) {
      const i = Math.floor((l.at.getTime() - from.getTime()) / DAY);
      const m = l.mode as keyof typeof mode;
      if (!(m in mode)) continue;
      mode[m].n++;
      if (l.correct) mode[m].ok++;
      if (i >= 0 && i < days) {
        daily[i][m]++;
        if (l.correct) daily[i].correct++;
      }
    }
    // 연속 학습일 (오늘 안 했으면 어제부터)
    let streak = 0;
    for (let i = days - 1; i >= 0; i--) {
      const n = daily[i].srs + daily[i].round + daily[i].quiz;
      if (n > 0) streak++;
      else if (i !== days - 1) break;
    }
    const forecast = Array.from({ length: 8 }, () => 0);
    for (const u of upcoming) {
      const i = Math.max(0, Math.floor((u.due.getTime() - start.getTime()) / DAY));
      if (i < 8) forecast[i]++;
    }
    const rate = (x: { n: number; ok: number }) => (x.n ? Math.round((x.ok / x.n) * 100) : null);
    return {
      summary,
      round: d.round,
      mature,
      young: summary.review - mature,
      starred,
      wrong,
      dates,
      daily,
      total: { srs: mode.srs.n, round: mode.round.n, quiz: mode.quiz.n },
      accuracy: { srs: rate(mode.srs), round: rate(mode.round), quiz: rate(mode.quiz) },
      streak,
      forecast,
      hardest,
    };
  }
}

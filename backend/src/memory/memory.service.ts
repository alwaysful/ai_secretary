import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Memory } from '@prisma/client';
import { ActionPlan, PendingAction } from '../actions/pending-action';
import { escapeTags } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';

/** 프롬프트에 넣을 기억 총 글자 수 상한 (작은 모델 컨텍스트 보호) */
const CONTEXT_CHARS = 2000;
const TTL_MS = 30 * 60_000;

/** "기억해: X", "X 기억해줘", "X 잊어줘", "X 기억 지워" */
const REMEMBER = /^\s*(?:(?:이거|이것)?\s*기억해\s*(?:줘|둬|두세요|주세요)?\s*[:：]\s*(.+)|(.+?)\s*(?:라고|이라고|고)?\s*기억해\s*(?:줘|둬|둬줘|두세요|주세요)?\s*[.!]?\s*)$/s;
const FORGET = /^\s*(.+?)\s*(?:(?:에\s*대한|관련)\s*)?(?:기억\s*(?:을|를)?\s*(?:지워|삭제해)|(?:을|를)?\s*잊어)\s*(?:줘|주세요|버려|버려줘)?\s*[.!]?\s*$/s;

export interface MemoryInput {
  content: string;
  category?: string | null;
  enabled?: boolean;
}

/** 장기 기억. 쓰기는 모두 사용자 조작(화면 또는 채팅 확인 카드)으로만 일어난다. */
@Injectable()
export class MemoryService {
  private readonly pending = new Map<string, PendingAction>();

  constructor(private readonly prisma: PrismaService) {}

  list(q?: string) {
    const term = q?.trim();
    return this.prisma.memory.findMany({
      where: term
        ? {
            OR: [
              { content: { contains: term, mode: 'insensitive' } },
              { category: { contains: term, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
  }

  create(input: MemoryInput, source: 'manual' | 'chat' = 'manual') {
    return this.prisma.memory.create({
      data: { content: input.content.trim(), category: input.category?.trim() || null, enabled: input.enabled ?? true, source },
    });
  }

  async update(id: string, input: Partial<MemoryInput>) {
    await this.mustExist(id);
    return this.prisma.memory.update({
      where: { id },
      data: {
        ...(input.content !== undefined ? { content: input.content.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category?.trim() || null } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.mustExist(id);
    await this.prisma.memory.delete({ where: { id } });
  }

  async removeAll(): Promise<number> {
    const r = await this.prisma.memory.deleteMany({});
    return r.count;
  }

  /** 켜진 기억을 시스템 프롬프트 블록으로. 없으면 null */
  async context(): Promise<string | null> {
    const rows = await this.prisma.memory.findMany({ where: { enabled: true }, orderBy: { updatedAt: 'desc' }, take: 200 });
    if (rows.length === 0) return null;
    const lines: string[] = [];
    let used = 0;
    for (const m of rows) {
      const line = `- ${m.category ? `[${escapeTags(m.category)}] ` : ''}${escapeTags(m.content).replace(/\s*\n\s*/g, ' ')}`;
      if (used + line.length > CONTEXT_CHARS) break;
      lines.push(line);
      used += line.length;
    }
    return [
      '[사용자 장기 기억] 사용자가 직접 저장한 정보다. 답변에 자연스럽게 반영하되, 묻지 않으면 굳이 나열하지 않는다.',
      '기억을 추가·삭제하려면 사용자가 "기억해: ...", "... 잊어줘"라고 말하거나 기억 화면을 쓰면 된다.',
      `<memory>\n${lines.join('\n')}\n</memory>`,
    ].join('\n');
  }

  /** 채팅의 "기억해"/"잊어줘" → 확인 대기 작업 */
  async plan(text: string, conversationId: string | null, now: Date = new Date()): Promise<ActionPlan | null> {
    const wrap = (b: string) => `<memory-action>\n${b}\n</memory-action>`;
    const rem = REMEMBER.exec(text);
    if (rem) {
      const content = (rem[1] ?? rem[2] ?? '').trim();
      if (!content) return null;
      const action = this.store({ kind: 'memory.create', conversationId, summary: `기억 추가: ${content}`, memory: { content } }, now);
      return { action, context: wrap(this.pendingText(action)) };
    }
    const fg = FORGET.exec(text);
    if (fg && !/(일정|회의|미팅|약속)/.test(text)) {
      const term = fg[1].replace(/^(내가|나는|내)\s*/, '').trim();
      const hits = await this.prisma.memory.findMany({
        where: { content: { contains: term, mode: 'insensitive' } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      });
      if (hits.length === 0) return { context: wrap(`"${escapeTags(term)}"에 해당하는 기억 없음. 기억 화면에서 확인하라고 안내한다.`) };
      const m = hits[0];
      const action = this.store(
        { kind: 'memory.delete', conversationId, summary: `기억 삭제: ${m.content}`, memory: { id: m.id, content: m.content } },
        now,
      );
      const more = hits.length > 1 ? `\n비슷한 기억이 ${hits.length - 1}개 더 있다. 기억 화면에서 고를 수 있다고 안내한다.` : '';
      return { action, context: wrap(this.pendingText(action) + more) };
    }
    return null;
  }

  has(id: string): boolean {
    return this.pending.has(id);
  }

  listPending(conversationId?: string): PendingAction[] {
    this.prune();
    return [...this.pending.values()].filter((a) => !conversationId || a.conversationId === conversationId);
  }

  async confirm(id: string): Promise<Memory | { deleted: string }> {
    const a = this.take(id);
    if (a.kind === 'memory.create') return this.create({ content: a.memory!.content }, 'chat');
    await this.prisma.memory.delete({ where: { id: a.memory!.id! } }).catch(() => undefined);
    return { deleted: a.memory!.id! };
  }

  cancel(id: string): void {
    this.take(id);
  }

  private pendingText(a: PendingAction): string {
    return [
      `[확인 대기] ${escapeTags(a.summary)}`,
      '아직 반영되지 않았다. 사용자가 화면의 확인 버튼을 눌러야 저장·삭제된다. 이미 기억했다고 말하지 않는다. 짧게 확인을 요청한다.',
    ].join('\n');
  }

  private store(a: Omit<PendingAction, 'id' | 'expiresAt'>, now: Date): PendingAction {
    this.prune(now);
    const dup = [...this.pending.values()].find((x) => x.conversationId === a.conversationId && x.summary === a.summary);
    if (dup) return dup;
    const action: PendingAction = { ...a, id: randomUUID(), expiresAt: new Date(now.getTime() + TTL_MS).toISOString() };
    this.pending.set(action.id, action);
    return action;
  }

  private take(id: string): PendingAction {
    this.prune();
    const a = this.pending.get(id);
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: '확인 대기 작업이 없음 (만료 또는 처리됨)' });
    this.pending.delete(id);
    return a;
  }

  private prune(now = new Date()): void {
    for (const [id, a] of this.pending) if (Date.parse(a.expiresAt) < now.getTime()) this.pending.delete(id);
  }

  private async mustExist(id: string): Promise<void> {
    const found = await this.prisma.memory.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException({ code: 'NOT_FOUND', message: '기억 없음' });
  }
}

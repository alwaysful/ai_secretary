import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageRole } from '@prisma/client';
import { BaseModel, ChatMessage, ModelError } from '../ai/models/base-model';
import { ToolContextProvider } from '../ai/tools/tool';
import { describeError } from '../common/errors';
import { Mutex } from '../common/mutex';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/** tools: 도구 조회, queued: 다른 응답 대기, loading: 모델 메모리 적재, generating: 생성 중 */
export type StreamPhase = 'tools' | 'queued' | 'loading' | 'generating';
type StatusFn = (phase: StreamPhase) => void;

@Injectable()
export class ConversationService {
  /** 한 번에 하나의 추론만 실행 (16GB RAM 제약) */
  private readonly mutex = new Mutex();

  constructor(
    private readonly prisma: PrismaService,
    private readonly model: BaseModel,
    private readonly config: ConfigService<EnvVars, true>,
    private readonly tools: ToolContextProvider,
  ) {}

  create(title?: string) {
    return this.prisma.conversation.create({ data: { title } });
  }

  /** q: 제목 또는 메시지 본문 부분 일치 (대소문자 무시) */
  list(q?: string) {
    const term = q?.trim();
    const where = term
      ? {
          OR: [
            { title: { contains: term, mode: 'insensitive' as const } },
            { messages: { some: { content: { contains: term, mode: 'insensitive' as const } } } },
          ],
        }
      : undefined;
    return this.prisma.conversation.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 });
  }

  async rename(id: string, title: string) {
    await this.assertExists(id);
    return this.prisma.conversation.update({ where: { id }, data: { title: title.trim() } });
  }

  /** 메시지는 onDelete: Cascade 로 함께 삭제 */
  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.conversation.delete({ where: { id } });
  }

  async assertExists(id: string): Promise<void> {
    const found = await this.prisma.conversation.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`conversation ${id} not found`);
  }

  async getMessages(id: string) {
    await this.assertExists(id);
    return this.prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'asc' } });
  }

  async postMessage(id: string, content: string) {
    await this.assertExists(id);
    const extra = await this.tools.contextFor(content); // 모델 슬롯을 잡기 전에 외부 I/O 수행
    const release = await this.mutex.acquire();
    try {
      const { userMessage, messages } = await this.prepare(id, content, extra);
      let result;
      try {
        result = await this.model.generate({ messages });
      } catch (e) {
        throw this.toHttpError(e);
      }
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId: id,
          role: MessageRole.ASSISTANT,
          content: result.content,
          model: result.model,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          durationMs: result.durationMs,
        },
      });
      return { userMessage, assistantMessage };
    } finally {
      release();
    }
  }

  /** 토큰 스트림. 종료(취소 포함) 시 누적된 응답을 저장한다. */
  async *stream(id: string, content: string, signal?: AbortSignal, onStatus?: StatusFn): AsyncGenerator<string> {
    await this.assertExists(id);
    yield* this.run(id, content, signal, onStatus, async () => {
      await this.prisma.message.create({ data: { conversationId: id, role: MessageRole.USER, content } });
    });
  }

  /** 마지막 사용자 메시지에 대한 응답을 다시 생성한다. 이전 응답은 삭제. */
  async *regenerate(id: string, signal?: AbortSignal, onStatus?: StatusFn): AsyncGenerator<string> {
    const last = await this.lastUserMessage(id);
    yield* this.run(id, last.content, signal, onStatus, () => this.dropAfter(id, last.createdAt));
  }

  /** 마지막 사용자 메시지를 수정하고 응답을 다시 생성한다. */
  async *editLast(id: string, content: string, signal?: AbortSignal, onStatus?: StatusFn): AsyncGenerator<string> {
    const last = await this.lastUserMessage(id);
    yield* this.run(id, content, signal, onStatus, async () => {
      await this.prisma.message.update({ where: { id: last.id }, data: { content } });
      await this.dropAfter(id, last.createdAt);
    });
  }

  private async lastUserMessage(id: string) {
    await this.assertExists(id);
    const last = await this.prisma.message.findFirst({
      where: { conversationId: id, role: MessageRole.USER },
      orderBy: { createdAt: 'desc' },
    });
    if (!last) throw new BadRequestException('no user message to regenerate');
    return last;
  }

  private async dropAfter(id: string, at: Date): Promise<void> {
    await this.prisma.message.deleteMany({ where: { conversationId: id, createdAt: { gt: at } } });
  }

  /** 공통 실행: 도구 → 대기열 → (모델 적재) → 생성. mutate는 모델 슬롯을 잡은 뒤 DB를 바꾼다. */
  private async *run(
    id: string,
    userText: string,
    signal: AbortSignal | undefined,
    onStatus: StatusFn | undefined,
    mutate: () => Promise<void>,
  ): AsyncGenerator<string> {
    onStatus?.('tools');
    const extra = await this.tools.contextFor(userText, signal);
    onStatus?.('queued');
    const release = await this.mutex.acquire();
    try {
      await mutate();
      const messages = await this.buildMessages(id, extra);
      let cold = false;
      if (onStatus) {
        cold = this.model.state !== 'ready' || (await this.model.probe()).loaded === false;
        onStatus(cold ? 'loading' : 'generating');
      }
      const started = Date.now();
      let full = '';
      try {
        for await (const token of this.model.stream({ messages, signal })) {
          if (cold) onStatus?.('generating');
          cold = false;
          full += token;
          yield token;
        }
      } catch (e) {
        throw this.toHttpError(e);
      } finally {
        if (full) {
          await this.prisma.message.create({
            data: {
              conversationId: id,
              role: MessageRole.ASSISTANT,
              content: full,
              model: this.model.name,
              durationMs: Date.now() - started,
            },
          });
        }
      }
    } finally {
      release();
    }
  }

  /** extra: 도구가 가져온 외부 데이터. system 프롬프트에만 합치고 DB에는 저장하지 않는다. */
  private async prepare(id: string, content: string, extra: string | null) {
    const userMessage = await this.prisma.message.create({
      data: { conversationId: id, role: MessageRole.USER, content },
    });
    return { userMessage, messages: await this.buildMessages(id, extra) };
  }

  private async buildMessages(id: string, extra: string | null): Promise<ChatMessage[]> {
    const recent = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: this.config.get('HISTORY_LIMIT', { infer: true }),
    });
    const history: ChatMessage[] = recent
      .reverse()
      .map((m) => ({ role: m.role.toLowerCase() as ChatMessage['role'], content: m.content }));
    const system = [this.config.get('SYSTEM_PROMPT', { infer: true }), extra].filter(Boolean).join('\n\n');
    return system ? [{ role: 'system', content: system }, ...history] : history;
  }

  private toHttpError(e: unknown): Error {
    if (!(e instanceof ModelError)) return e as Error;
    const { code } = describeError(e);
    switch (e.code) {
      case 'TIMEOUT':
        return new GatewayTimeoutException({ code, message: e.message });
      case 'BAD_RESPONSE':
        return new BadGatewayException({ code, message: e.message });
      case 'ABORTED':
        return new HttpException('client closed request', 499);
      default:
        return new ServiceUnavailableException({ code, message: e.message });
    }
  }
}

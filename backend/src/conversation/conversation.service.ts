import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageRole } from '@prisma/client';
import { BaseModel, ChatMessage, ModelError } from '../ai/models/base-model';
import { Mutex } from '../common/mutex';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationService {
  /** 한 번에 하나의 추론만 실행 (16GB RAM 제약) */
  private readonly mutex = new Mutex();

  constructor(
    private readonly prisma: PrismaService,
    private readonly model: BaseModel,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  create(title?: string) {
    return this.prisma.conversation.create({ data: { title } });
  }

  list() {
    return this.prisma.conversation.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
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
    const release = await this.mutex.acquire();
    try {
      const { userMessage, messages } = await this.prepare(id, content);
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
  async *stream(id: string, content: string, signal?: AbortSignal): AsyncGenerator<string> {
    await this.assertExists(id);
    const release = await this.mutex.acquire();
    try {
      const { messages } = await this.prepare(id, content);
      const started = Date.now();
      let full = '';
      try {
        for await (const token of this.model.stream({ messages, signal })) {
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

  private async prepare(id: string, content: string) {
    const userMessage = await this.prisma.message.create({
      data: { conversationId: id, role: MessageRole.USER, content },
    });
    const recent = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: this.config.get('HISTORY_LIMIT', { infer: true }),
    });
    const history: ChatMessage[] = recent
      .reverse()
      .map((m) => ({ role: m.role.toLowerCase() as ChatMessage['role'], content: m.content }));
    const system = this.config.get('SYSTEM_PROMPT', { infer: true });
    const messages: ChatMessage[] = system ? [{ role: 'system', content: system }, ...history] : history;
    return { userMessage, messages };
  }

  private toHttpError(e: unknown): Error {
    if (!(e instanceof ModelError)) return e as Error;
    switch (e.code) {
      case 'TIMEOUT':
        return new GatewayTimeoutException(e.message);
      case 'BAD_RESPONSE':
        return new BadGatewayException(e.message);
      case 'ABORTED':
        return new HttpException('client closed request', 499);
      default:
        return new ServiceUnavailableException(e.message);
    }
  }
}

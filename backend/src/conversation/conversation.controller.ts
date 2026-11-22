import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { describeError } from '../common/errors';
import { CreateConversationDto, CreateMessageDto, ListConversationsDto, UpdateConversationDto } from './conversation.dto';
import { ConversationService, StreamPhase } from './conversation.service';

type StreamFactory = (signal: AbortSignal, onStatus: (p: StreamPhase) => void) => AsyncIterable<string>;

@Controller('conversations')
export class ConversationController {
  private readonly log = new Logger(ConversationController.name);

  constructor(private readonly conversations: ConversationService) {}

  @Post()
  create(@Body() dto: CreateConversationDto) {
    return this.conversations.create(dto.title);
  }

  @Get()
  list(@Query() q: ListConversationsDto) {
    return this.conversations.list(q.q);
  }

  @Patch(':id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateConversationDto) {
    return this.conversations.rename(id, dto.title);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.remove(id);
  }

  @Get(':id/messages')
  messages(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.getMessages(id);
  }

  @Post(':id/messages')
  send(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMessageDto) {
    return this.conversations.postMessage(id, dto.content);
  }

  /** SSE: `event: status` {phase}, `data: {"token"}` 반복, 종료 `event: done`, 오류 `event: error` {code,message}. */
  @Post(':id/messages/stream')
  async stream(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMessageDto, @Res() res: Response) {
    await this.conversations.assertExists(id);
    await this.sse(res, (signal, onStatus) => this.conversations.stream(id, dto.content, signal, onStatus));
  }

  /** 마지막 응답 재생성 (SSE) */
  @Post(':id/regenerate/stream')
  async regenerate(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    await this.conversations.assertExists(id);
    await this.sse(res, (signal, onStatus) => this.conversations.regenerate(id, signal, onStatus));
  }

  /** 마지막 사용자 메시지 수정 후 재생성 (SSE) */
  @Post(':id/edit-last/stream')
  async editLast(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMessageDto, @Res() res: Response) {
    await this.conversations.assertExists(id);
    await this.sse(res, (signal, onStatus) => this.conversations.editLast(id, dto.content, signal, onStatus));
  }

  private async sse(res: Response, run: StreamFactory): Promise<void> {
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    const send = (event: string | null, data: unknown) =>
      res.write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`);

    try {
      for await (const token of run(abort.signal, (phase) => send('status', { phase }))) {
        send(null, { token });
      }
      send('done', {});
    } catch (e) {
      if (!abort.signal.aborted) {
        const err = describeError(e);
        if (err.code === 'INTERNAL') this.log.error(e instanceof Error ? e.message : String(e));
        send('error', { code: err.code, message: err.message });
      }
    } finally {
      res.end();
    }
  }
}

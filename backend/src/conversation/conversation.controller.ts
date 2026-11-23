import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { sse } from '../common/sse';
import { CreateConversationDto, CreateMessageDto, ListConversationsDto, UpdateConversationDto } from './conversation.dto';
import { ConversationService, StreamHooks, StreamPhase } from './conversation.service';

type StreamFactory = (h: StreamHooks) => AsyncIterable<string>;

/** 토큰 이터레이터 → SSE. status/action 이벤트도 함께 전달. */
function pipe(res: Response, run: StreamFactory): Promise<void> {
  return sse(res, async ({ send, signal }) => {
    const hooks: StreamHooks = {
      signal,
      onStatus: (phase: StreamPhase) => send('status', { phase }),
      onAction: (action: unknown) => send('action', action),
    };
    for await (const token of run(hooks)) send(null, { token });
  });
}

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversations: ConversationService) {}

  @Post()
  create(@Body() dto: CreateConversationDto) {
    return this.conversations.create(dto.title, dto.persona);
  }

  @Get()
  list(@Query() q: ListConversationsDto) {
    return this.conversations.list(q.q, q.persona);
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

  /** SSE: `event: status` {phase}, `event: action` (확인 대기 작업), `data: {"token"}` 반복, 종료 `event: done`, 오류 `event: error` {code,message}. */
  @Post(':id/messages/stream')
  async stream(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMessageDto, @Res() res: Response) {
    await this.conversations.assertExists(id);
    await pipe(res, (h) => this.conversations.stream(id, dto.content, h.signal, h));
  }

  /** 마지막 응답 재생성 (SSE) */
  @Post(':id/regenerate/stream')
  async regenerate(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    await this.conversations.assertExists(id);
    await pipe(res, (h) => this.conversations.regenerate(id, h.signal, h));
  }

  /** 마지막 사용자 메시지 수정 후 재생성 (SSE) */
  @Post(':id/edit-last/stream')
  async editLast(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMessageDto, @Res() res: Response) {
    await this.conversations.assertExists(id);
    await pipe(res, (h) => this.conversations.editLast(id, dto.content, h.signal, h));
  }
}

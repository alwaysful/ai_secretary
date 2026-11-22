import { Body, Controller, Get, HttpException, Logger, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CreateConversationDto, CreateMessageDto } from './conversation.dto';
import { ConversationService } from './conversation.service';

@Controller('conversations')
export class ConversationController {
  private readonly log = new Logger(ConversationController.name);

  constructor(private readonly conversations: ConversationService) {}

  @Post()
  create(@Body() dto: CreateConversationDto) {
    return this.conversations.create(dto.title);
  }

  @Get()
  list() {
    return this.conversations.list();
  }

  @Get(':id/messages')
  messages(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.getMessages(id);
  }

  @Post(':id/messages')
  send(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMessageDto) {
    return this.conversations.postMessage(id, dto.content);
  }

  /** SSE: `data: {"token":"..."}` 반복, 종료 시 `event: done`. */
  @Post(':id/messages/stream')
  async stream(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.conversations.assertExists(id);

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

    try {
      for await (const token of this.conversations.stream(id, dto.content, abort.signal)) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
      res.write('event: done\ndata: {}\n\n');
    } catch (e) {
      if (!abort.signal.aborted) {
        this.log.error(e instanceof Error ? e.message : String(e));
        const message = e instanceof HttpException ? e.message : 'internal error';
        res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
      }
    } finally {
      res.end();
    }
  }
}

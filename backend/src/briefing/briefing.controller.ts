import { Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { sse } from '../common/sse';
import { BriefingService } from './briefing.service';

@Controller('briefing')
export class BriefingController {
  constructor(private readonly briefing: BriefingService) {}

  /** 원자료만 (모델 호출 없음) */
  @Get()
  data() {
    return this.briefing.collect();
  }

  /** SSE: `event: data` 원자료 → `event: status` → 토큰 → done */
  @Post('stream')
  async stream(@Res() res: Response): Promise<void> {
    await sse(res, async ({ send, signal }) => {
      send('status', { phase: 'tools' });
      const data = await this.briefing.collect(signal);
      send('data', data);
      send('status', { phase: 'queued' });
      let first = true;
      for await (const token of this.briefing.summarize(data, signal, () => send('status', { phase: 'loading' }))) {
        if (first) send('status', { phase: 'generating' });
        first = false;
        send(null, { token });
      }
    });
  }
}

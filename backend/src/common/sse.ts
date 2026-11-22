import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import { describeError } from './errors';

export interface SseSink {
  send(event: string | null, data: unknown): void;
  signal: AbortSignal;
}

const log = new Logger('SSE');

/** SSE 응답 공통 처리. run이 끝나면 `event: done`, 예외면 `event: error` {code,message}. */
export async function sse(res: Response, run: (sink: SseSink) => Promise<void>): Promise<void> {
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
  const send = (event: string | null, data: unknown) => {
    if (!res.writableEnded) res.write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`);
  };
  try {
    await run({ send, signal: abort.signal });
    send('done', {});
  } catch (e) {
    if (!abort.signal.aborted) {
      const err = describeError(e);
      if (err.code === 'INTERNAL') log.error(e instanceof Error ? e.message : String(e));
      send('error', { code: err.code, message: err.message });
    }
  } finally {
    res.end();
  }
}

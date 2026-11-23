import { ConsoleLogger, LogLevel } from '@nestjs/common';

export interface LogLine {
  at: string;
  level: LogLevel;
  context: string;
  message: string;
}

const MAX = 300;
const lines: LogLine[] = [];

/** 콘솔 출력 + 최근 로그 300줄 메모리 보관 (Admin 로비 표시용) */
export class BufferedLogger extends ConsoleLogger {
  protected printMessages(messages: unknown[], context = '', logLevel: LogLevel = 'log', writeStreamType?: 'stdout' | 'stderr'): void {
    super.printMessages(messages, context, logLevel, writeStreamType);
    for (const m of messages) {
      lines.push({ at: new Date().toISOString(), level: logLevel, context, message: m instanceof Error ? m.message : typeof m === 'string' ? m : JSON.stringify(m) });
    }
    if (lines.length > MAX) lines.splice(0, lines.length - MAX);
  }
}

export function recentLogs(limit = 100, levels?: LogLevel[]): LogLine[] {
  const src = levels?.length ? lines.filter((l) => levels.includes(l.level)) : lines;
  return src.slice(-limit).reverse();
}

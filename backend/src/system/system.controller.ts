import { Controller, ForbiddenException, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { execFile } from 'node:child_process';
import type { Request } from 'express';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** 소켓 주소와 X-Forwarded-For(vite 프록시) 모두 루프백이어야 PC 본인 */
export function isLocalRequest(remote: string | undefined, forwarded: string | string[] | undefined): boolean {
  if (!remote || !LOOPBACK.has(remote)) return false;
  const chain = (Array.isArray(forwarded) ? forwarded.join(',') : (forwarded ?? ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return chain.every((ip) => LOOPBACK.has(ip));
}

/**
 * npm run dev(scripts/dev.mjs)로 실행 중이면 AURA_DEV_PID 트리 전체(백엔드·nest watch·vite) 종료.
 * 아니면 백엔드만 정상 종료.
 */
export function stopAll(log: Logger): void {
  const root = Number(process.env.AURA_DEV_PID);
  if (root > 1 && root !== process.pid) {
    if (process.platform === 'win32') {
      execFile('taskkill', ['/PID', String(root), '/T', '/F'], (e) => e && log.error(`taskkill: ${e.message}`));
      return;
    }
    try {
      process.kill(root, 'SIGTERM');
      return;
    } catch (e) {
      log.error(`kill ${root}: ${e instanceof Error ? e.message : e}`);
    }
  }
  // Nest 종료 훅(enableShutdownHooks) 실행
  process.emit('SIGTERM', 'SIGTERM');
  setTimeout(() => process.exit(0), 3000).unref();
}

@Controller('system')
export class SystemController {
  private readonly log = new Logger(SystemController.name);

  /**
   * 서버 종료. PC(localhost)에서만, X-Aura-Shutdown 헤더 필수(다른 사이트 CSRF 차단).
   */
  @Post('shutdown')
  @HttpCode(202)
  shutdown(@Req() req: Request, @Headers('x-aura-shutdown') confirm?: string) {
    if (confirm !== '1') throw new ForbiddenException({ code: 'CONFIRM_REQUIRED', message: '확인 헤더 없음' });
    if (!isLocalRequest(req.socket.remoteAddress, req.headers['x-forwarded-for'])) {
      throw new ForbiddenException({ code: 'LOCAL_ONLY', message: 'PC에서만 끌 수 있음' });
    }
    this.log.warn('shutdown requested from lobby');
    setTimeout(() => stopAll(this.log), 300);
    return { status: 'stopping' };
  }
}

import { BadRequestException, Controller, Delete, Get, Header, HttpCode, Injectable, Param, PipeTransform, Post, Query, UseFilters } from '@nestjs/common';
import { MailError, MailErrorFilter } from '../mail/mail.errors';
import { GoogleAuthService } from './google-auth.service';
import { GoogleTasksService } from './google-tasks.service';

@Injectable()
class TaskIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[A-Za-z0-9_-]{4,256}$/.test(value)) throw new BadRequestException('invalid task id');
    return value;
  }
}

const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><title>AURA</title><body style="font-family:sans-serif;padding:2rem"><h2>${title}</h2><p>${body}</p><script>setTimeout(()=>window.close(),1500)</script></body>`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Google 캘린더·Tasks 연동. 인증 없음: HOST=127.0.0.1 유지. */
@Controller('google')
@UseFilters(MailErrorFilter)
export class GoogleController {
  constructor(
    private readonly auth: GoogleAuthService,
    private readonly tasks: GoogleTasksService,
  ) {}

  @Get('auth/status')
  status() {
    return this.auth.status();
  }

  @Post('auth/start')
  start() {
    return this.auth.start();
  }

  /** Google 동의 화면이 돌려보내는 주소. 결과를 HTML로 보여주고 창을 닫는다. */
  @Get('auth/callback')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async callback(@Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string): Promise<string> {
    try {
      const email = await this.auth.finish(code, state, error);
      return page('Google 연결 완료', `${email ? esc(email) + ' · ' : ''}이 창은 닫아도 됩니다.`);
    } catch (e) {
      const msg = e instanceof MailError ? e.message : 'unknown error';
      return page('Google 연결 실패', `${esc(msg)}<br>AURA에서 다시 시도하세요.`);
    }
  }

  @Delete('auth')
  @HttpCode(204)
  async disconnect(): Promise<void> {
    await this.auth.disconnect();
  }

  @Get('tasks')
  list() {
    return this.tasks.list();
  }

  /** 사용자가 화면에서 직접 누른 완료 처리 */
  @Post('tasks/:id/complete')
  complete(@Param('id', TaskIdPipe) id: string) {
    return this.tasks.complete(id);
  }
}

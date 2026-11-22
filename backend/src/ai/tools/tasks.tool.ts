import { Injectable } from '@nestjs/common';
import { isTaskWriteIntent } from '../../calendar/task-parser';
import { shortLabel } from '../../calendar/tz';
import { escapeTags } from '../../common/text';
import { GoogleAuthService } from '../../google/google-auth.service';
import { GoogleTasksService, TaskItem } from '../../google/google-tasks.service';
import { MailError } from '../../mail/mail.errors';
import { ContextTool, ToolError } from './tool';

const TASK_INTENT = /(할\s*일|투두|to-?do|리마인더|reminder|태스크|체크\s*리스트|해야\s*할)/i;
const MAX_IN_CONTEXT = 30;

/** 할 일 질문이 오면 Google Tasks 미완료 목록을 주입한다. 읽기 전용. */
@Injectable()
export class TasksTool implements ContextTool {
  readonly name = 'google-tasks';
  readonly readOnly = true as const;

  constructor(
    private readonly tasks: GoogleTasksService,
    private readonly auth: GoogleAuthService,
  ) {}

  /** 등록 요청은 CalendarActionService가 처리 */
  matches(text: string): boolean {
    return TASK_INTENT.test(text) && !isTaskWriteIntent(text);
  }

  async run(_text: string, signal?: AbortSignal): Promise<string> {
    if (!this.auth.configured) {
      throw new ToolError('Google 설정 없음 (GOOGLE_CLIENT_ID). 사용자에게 backend/README.md "Google 연동"을 안내한다.');
    }
    try {
      return format(await this.tasks.list(signal));
    } catch (e) {
      if (e instanceof MailError) {
        if (e.code === 'NOT_CONNECTED') throw new ToolError('Google 미연결. 사용자에게 사이드바의 "Google 연결"을 안내한다.', e);
        throw new ToolError(`할 일 조회 실패: ${e.message}`, e);
      }
      throw e;
    }
  }
}

export function format(list: TaskItem[]): string {
  const head = `Google Tasks 미완료 할 일 ${list.length}건.`;
  if (list.length === 0) return `${head}\n할 일 없음.`;
  const flat = (s: string) => escapeTags(s).replace(/\s*\n\s*/g, ' ');
  const rows = list.slice(0, MAX_IN_CONTEXT).map((t, i) => {
    const due = t.due ? ` | 마감 ${shortLabel(`${t.due}T00:00`, false)}` : '';
    const notes = t.notes ? ` | 메모: ${flat(t.notes.slice(0, 120))}` : '';
    return `${i + 1}. ${flat(t.title)}${due}${notes}`;
  });
  if (list.length > MAX_IN_CONTEXT) rows.push(`… 외 ${list.length - MAX_IN_CONTEXT}건 생략`);
  return [head, ...rows].join('\n');
}

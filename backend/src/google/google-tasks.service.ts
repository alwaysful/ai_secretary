import { Injectable } from '@nestjs/common';
import { cleanText } from '../common/text';
import { GoogleApi } from './google-api.service';

const BASE = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';

export interface TaskItem {
  id: string;
  title: string;
  notes: string;
  /** 마감일 `YYYY-MM-DD` (Google Tasks는 시간 미지원) */
  due: string | null;
  completed: boolean;
}

export interface TaskDraft {
  title: string;
  due: string | null;
  notes?: string;
}

interface GTask {
  id: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
}

const toTask = (t: GTask): TaskItem => ({
  id: t.id,
  title: t.title || '(제목 없음)',
  notes: cleanText(t.notes ?? ''),
  due: t.due ? t.due.slice(0, 10) : null,
  completed: t.status === 'completed',
});

/** Google Tasks (기본 목록). Google 리마인더는 공개 API가 없어 Tasks로 대신한다. */
@Injectable()
export class GoogleTasksService {
  constructor(private readonly api: GoogleApi) {}

  /** 미완료 할 일. 마감일 순, 마감 없는 항목은 뒤로 */
  async list(signal?: AbortSignal, max = 50): Promise<TaskItem[]> {
    const qs = new URLSearchParams({ showCompleted: 'false', showHidden: 'false', maxResults: String(max) });
    const data = await this.api.call<{ items?: GTask[] }>(`${BASE}?${qs.toString()}`, signal);
    return (data.items ?? [])
      .map(toTask)
      .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  }

  async create(d: TaskDraft, signal?: AbortSignal): Promise<TaskItem> {
    const body = {
      title: d.title,
      ...(d.notes ? { notes: d.notes } : {}),
      ...(d.due ? { due: `${d.due}T00:00:00.000Z` } : {}),
    };
    return toTask(await this.api.call<GTask>(BASE, signal, { method: 'POST', body }));
  }

  async complete(id: string, signal?: AbortSignal): Promise<TaskItem> {
    const url = `${BASE}/${encodeURIComponent(id)}`;
    return toTask(await this.api.call<GTask>(url, signal, { method: 'PATCH', body: { status: 'completed' } }));
  }
}

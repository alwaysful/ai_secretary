import type { CalendarEvent } from '../calendar/calendar.types';
import type { EventDraft } from '../calendar/event-parser';

/** 사용자 확인을 기다리는 쓰기 작업. 확인 버튼(POST /actions/:id/confirm)으로만 실행된다. */
export interface PendingAction {
  id: string;
  kind: 'calendar.create' | 'calendar.update' | 'memory.create' | 'memory.delete';
  conversationId: string | null;
  /** 화면 표시용 한 줄 요약 */
  summary: string;
  /** 일정 (calendar.*) */
  draft?: EventDraft;
  eventId?: string;
  before?: CalendarEvent;
  /** 기억 (memory.*) */
  memory?: { id?: string; content: string; category?: string | null };
  expiresAt: string;
}

export interface ActionPlan {
  /** 모델 프롬프트에 넣을 설명 */
  context: string;
  action?: PendingAction;
}

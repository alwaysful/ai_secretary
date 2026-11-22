export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: 'SYSTEM' | 'USER' | 'ASSISTANT';
  content: string;
  model?: string | null;
  durationMs?: number | null;
  /** 사용자가 중단한 응답 */
  stopped?: boolean;
  createdAt: string;
}

export interface EventDraft {
  subject: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location: string;
}

/** 사용자 확인을 기다리는 작업 (일정 등록·변경) */
export interface PendingAction {
  id: string;
  kind: 'calendar.create' | 'calendar.update' | 'tasks.create' | 'memory.create' | 'memory.delete';
  conversationId: string | null;
  summary: string;
  draft?: EventDraft;
  target?: 'outlook' | 'google';
  task?: { title: string; due: string | null };
  memory?: { id?: string; content: string; category?: string | null };
  eventId?: string;
  before?: CalendarEvent;
  expiresAt: string;
}

export interface Memory {
  id: string;
  content: string;
  category: string | null;
  enabled: boolean;
  source: 'manual' | 'chat';
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  model: string;
  systemPrompt: string;
  defaults: { model: string; systemPrompt: string };
}

export interface BriefingData {
  date: string;
  events: CalendarEvent[];
  mails: MailSummary[];
  tasks?: TaskItem[];
  errors: { calendar?: string; mail?: string; tasks?: string };
}

export interface Health {
  status: string;
  db: 'ok' | 'down';
  model: {
    name: string;
    state: 'unloaded' | 'loading' | 'ready' | 'error';
    /** Ollama 접속 가능 */
    reachable: boolean;
    /** 모델 pull 여부 (null: 모름) */
    installed: boolean | null;
    /** 메모리 적재 여부 (null: 모름) */
    loaded: boolean | null;
  };
}

/** 백엔드 오류 코드 + 프론트 전용 BACKEND_DOWN */
export type ErrorCode =
  | 'BACKEND_DOWN'
  | 'DB_DOWN'
  | 'OLLAMA_DOWN'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_TIMEOUT'
  | 'MODEL_ERROR'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'INTERNAL';

export type StreamPhase = 'tools' | 'queued' | 'loading' | 'generating';

export interface MailStatus {
  configured: boolean;
  connected: boolean;
  pending: boolean;
  email: string | null;
}

export interface DeviceLogin {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  /** 로컬 시각 `YYYY-MM-DDTHH:mm:ss` */
  start: string;
  end: string;
  isAllDay: boolean;
  location: string;
  source?: 'outlook' | 'google';
}

/** Google Tasks 할 일 */
export interface TaskItem {
  id: string;
  title: string;
  notes: string;
  /** `YYYY-MM-DD` */
  due: string | null;
  completed: boolean;
}

export interface MailSummary {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  isRead: boolean;
  preview: string;
  important?: boolean;
}

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: ErrorCode = 'INTERNAL',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const backendDown = () => new ApiError(0, '백엔드 서버에 연결할 수 없음', 'BACKEND_DOWN');

async function failure(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as {
    message?: string | string[];
    code?: ErrorCode;
    /** 메일·일정 오류 코드 (NOT_CONNECTED 등) */
    error?: string;
  } | null;
  // Vite 프록시가 백엔드에 못 붙으면 JSON 없는 5xx를 돌려준다
  if (!body && res.status >= 500) return backendDown();
  const m = body?.message;
  const code = body?.code ?? (res.status === 404 ? 'NOT_FOUND' : res.status < 500 ? 'BAD_REQUEST' : 'INTERNAL');
  const text = Array.isArray(m) ? m.join(', ') : (m ?? `HTTP ${res.status}`);
  if (body?.error === 'NOT_CONNECTED') return new ApiError(res.status, 'Outlook 재로그인 필요 (일정 쓰기 권한 추가됨)', code);
  if (body?.error === 'NOT_CONFIGURED') return new ApiError(res.status, 'Outlook 설정 없음 (backend/.env)', code);
  return new ApiError(res.status, text, code);
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(BASE + path, init);
  } catch (e) {
    if (init?.signal?.aborted) throw e;
    throw backendDown();
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await call(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!res.ok) throw await failure(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  health: () => req<Health>('/health'),
  warmup: () => req<{ state: string }>('/health/warmup', { method: 'POST' }),
  conversations: (q?: string) =>
    req<Conversation[]>(q ? `/conversations?q=${encodeURIComponent(q)}` : '/conversations'),
  renameConversation: (id: string, title: string) =>
    req<Conversation>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => req<void>(`/conversations/${id}`, { method: 'DELETE' }),
  createConversation: (title?: string) =>
    req<Conversation>('/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
  messages: (id: string) => req<Message[]>(`/conversations/${id}/messages`),
  mailStatus: () => req<MailStatus>('/mail/auth/status'),
  mailStart: () => req<DeviceLogin>('/mail/auth/start', { method: 'POST' }),
  mailDisconnect: () => req<void>('/mail/auth', { method: 'DELETE' }),
  mailList: (unreadOnly: boolean) => req<MailSummary[]>(`/mail/messages?top=15&unreadOnly=${unreadOnly}`),
  settings: () => req<Settings>('/settings'),
  saveSettings: (s: { model?: string; systemPrompt?: string }) =>
    req<Settings>('/settings', { method: 'PUT', body: JSON.stringify(s) }),
  models: () => req<string[]>('/settings/models'),
  actions: (conversationId: string) => req<PendingAction[]>(`/actions?conversationId=${conversationId}`),
  memories: (q?: string) => req<Memory[]>(q ? `/memories?q=${encodeURIComponent(q)}` : '/memories'),
  createMemory: (m: { content: string; category?: string }) =>
    req<Memory>('/memories', { method: 'POST', body: JSON.stringify(m) }),
  updateMemory: (id: string, m: { content?: string; category?: string; enabled?: boolean }) =>
    req<Memory>(`/memories/${id}`, { method: 'PATCH', body: JSON.stringify(m) }),
  deleteMemory: (id: string) => req<void>(`/memories/${id}`, { method: 'DELETE' }),
  deleteAllMemories: () => req<{ deleted: number }>('/memories?confirm=all', { method: 'DELETE' }),
  confirmAction: (id: string) => req<{ subject?: string; content?: string; deleted?: string }>(`/actions/${id}/confirm`, { method: 'POST' }),
  cancelAction: (id: string) => req<void>(`/actions/${id}`, { method: 'DELETE' }),
  today: () => req<CalendarEvent[]>('/calendar/today'),
  unreadCount: () => req<{ count: number }>('/mail/unread-count'),
  events: (days: number) => req<CalendarEvent[]>(`/calendar/events?days=${days}`),
  googleStatus: () => req<MailStatus>('/google/auth/status'),
  googleStart: () => req<{ url: string }>('/google/auth/start', { method: 'POST' }),
  googleDisconnect: () => req<void>('/google/auth', { method: 'DELETE' }),
  tasks: () => req<TaskItem[]>('/google/tasks'),
  completeTask: (id: string) => req<TaskItem>(`/google/tasks/${encodeURIComponent(id)}/complete`, { method: 'POST' }),
};

export interface StreamHandlers {
  onToken: (t: string) => void;
  onStatus?: (p: StreamPhase) => void;
  onAction?: (a: PendingAction) => void;
  /** 브리핑 원자료 */
  onData?: (d: BriefingData) => void;
}

/** 아침 브리핑 (원자료 → 요약 토큰) */
export const streamBriefing = (h: StreamHandlers, signal: AbortSignal) => streamSse('/briefing/stream', undefined, h, signal);

/** 새 메시지 전송 */
export const streamMessage = (id: string, content: string, h: StreamHandlers, signal: AbortSignal) =>
  streamSse(`/conversations/${id}/messages/stream`, { content }, h, signal);

/** 마지막 응답 재생성 */
export const streamRegenerate = (id: string, h: StreamHandlers, signal: AbortSignal) =>
  streamSse(`/conversations/${id}/regenerate/stream`, undefined, h, signal);

/** 마지막 질문 수정 후 재생성 */
export const streamEditLast = (id: string, content: string, h: StreamHandlers, signal: AbortSignal) =>
  streamSse(`/conversations/${id}/edit-last/stream`, { content }, h, signal);

/** SSE(POST)를 fetch로 읽는다. data:{"token"} → onToken, event:status → onStatus, event:error → throw. */
async function streamSse(path: string, body: unknown, h: StreamHandlers, signal: AbortSignal): Promise<void> {
  const res = await call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw await failure(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (e) {
      if (signal.aborted) throw e;
      throw backendDown();
    }
    if (chunk.done) break;
    buf += decoder.decode(chunk.value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      const parsed = JSON.parse(data) as {
        token?: string;
        message?: string;
        code?: ErrorCode;
        phase?: StreamPhase;
      } & Record<string, unknown>;
      if (event === 'error') throw new ApiError(500, parsed.message ?? 'stream error', parsed.code ?? 'INTERNAL');
      if (event === 'done') return;
      if (event === 'action') {
        h.onAction?.(parsed as unknown as PendingAction);
        continue;
      }
      if (event === 'data') {
        h.onData?.(parsed as unknown as BriefingData);
        continue;
      }
      if (event === 'status') {
        if (parsed.phase) h.onStatus?.(parsed.phase);
        continue;
      }
      if (parsed.token) h.onToken(parsed.token);
    }
  }
  // done 없이 끊김 = 백엔드 중단
  if (!signal.aborted) throw backendDown();
}

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
  createdAt: string;
}

export interface Health {
  status: string;
  db: string;
  model: { name: string; state: string };
}

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

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function failure(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const m = body?.message;
  return new ApiError(res.status, Array.isArray(m) ? m.join(', ') : (m ?? `HTTP ${res.status}`));
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!res.ok) throw await failure(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  health: () => req<Health>('/health'),
  conversations: () => req<Conversation[]>('/conversations'),
  createConversation: (title?: string) =>
    req<Conversation>('/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
  messages: (id: string) => req<Message[]>(`/conversations/${id}/messages`),
  mailStatus: () => req<MailStatus>('/mail/auth/status'),
  mailStart: () => req<DeviceLogin>('/mail/auth/start', { method: 'POST' }),
  mailDisconnect: () => req<void>('/mail/auth', { method: 'DELETE' }),
};

/** SSE(POST)를 fetch로 읽는다. data:{"token"} → onToken, event:error → throw. */
export async function streamMessage(
  id: string,
  content: string,
  onToken: (t: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/conversations/${id}/messages/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
    signal,
  });
  if (!res.ok || !res.body) throw await failure(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
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
      const parsed = JSON.parse(data) as { token?: string; message?: string };
      if (event === 'error') throw new Error(parsed.message ?? 'stream error');
      if (event === 'done') return;
      if (parsed.token) onToken(parsed.token);
    }
  }
}

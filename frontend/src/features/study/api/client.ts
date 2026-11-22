/** AURA 백엔드 호출. vite 프록시 /api → 백엔드. 인증 없음(로컬 전용). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

function toMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message: unknown }).message;
    if (Array.isArray(m)) return m.join('\n');
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

export async function request<T>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없습니다.');
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) throw new ApiError(res.status, toMessage(data, `요청 실패 (${res.status})`));
  return data as T;
}

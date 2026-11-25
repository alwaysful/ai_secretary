/** 자격증 서비스 화면 API (/app/certs). 오류면 서버 메시지로 throw */
export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/app${path}`, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    let msg = `오류 ${res.status}`;
    try {
      const j = (await res.json()) as { message?: unknown };
      if (j.message) msg = Array.isArray(j.message) ? j.message.join(', ') : String(j.message);
    } catch {
      /* 본문 없음 */
    }
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

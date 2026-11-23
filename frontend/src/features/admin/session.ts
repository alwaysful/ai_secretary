import { api } from '../../shared/api';

const KEY = 'aura.adminToken';

export function adminToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(t: string | null): void {
  try {
    if (t) sessionStorage.setItem(KEY, t);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* 저장 불가: 메모리 세션만 */
  }
  mem = t;
}

let mem: string | null = null;
export const currentToken = () => adminToken() ?? mem;

/** 코드는 서버에서 검증. 프런트에 코드 없음 */
export async function adminLogin(code: string): Promise<void> {
  const r = await api.adminLogin(code);
  setAdminToken(r.token);
}

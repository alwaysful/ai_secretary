const KEY = 'aura.adminToken';
let mem: string | null = null;

/** 관리자 세션 토큰 (서버 발급). 코드 자체는 저장 안 함 */
export function currentToken(): string | null {
  try {
    return sessionStorage.getItem(KEY) ?? mem;
  } catch {
    return mem;
  }
}

export function setAdminToken(t: string | null): void {
  mem = t;
  try {
    if (t) sessionStorage.setItem(KEY, t);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* 저장 불가: 메모리만 */
  }
}

/** 관리자 모드 여부 (토큰 존재). 만료는 로비가 서버로 확인 */
export const isAdmin = () => !!currentToken();

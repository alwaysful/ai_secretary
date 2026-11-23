const SEEN_KEY = 'aura.landingSeen';

/** 첫 방문 여부 (웹에서 첫 접속 시 랜딩 표시) */
export function landingSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* 저장 불가: 무시 */
  }
}

const KEY = 'aura.guideDone';

/** 첫 실행 가이드 완료 여부 */
export function guideDone(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

export function markGuideDone() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* 저장 불가: 무시 */
  }
}

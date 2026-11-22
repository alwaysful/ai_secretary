import { FilesetResolver } from '@mediapipe/tasks-vision';

// node_modules의 wasm을 vite가 /mediapipe-wasm 으로 제공 (CDN 불필요)
const WASM_URL = '/mediapipe-wasm';

let fileset: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;

export function getVision() {
  fileset ??= FilesetResolver.forVisionTasks(WASM_URL);
  // 실패한 Promise 를 캐시하지 않는다 (네트워크 오류 후 재시도 가능)
  fileset.catch(() => {
    fileset = null;
  });
  return fileset;
}

// GPU delegate 미지원 환경에서는 CPU 로 재시도
export async function withDelegateFallback<T>(
  create: (delegate: 'GPU' | 'CPU') => Promise<T>,
): Promise<T> {
  try {
    return await create('GPU');
  } catch {
    return create('CPU');
  }
}

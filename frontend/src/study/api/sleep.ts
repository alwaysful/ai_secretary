/** 수면 기록: 브라우저 localStorage 저장(백엔드 없음). */
export interface SleepLog {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
}

const KEY = 'aura.sleepLogs';

function load(): SleepLog[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SleepLog[];
  } catch {
    return [];
  }
}

export const sleepApi = {
  create: async (body: { startedAt: string; endedAt: string }): Promise<SleepLog> => {
    const log: SleepLog = {
      id: crypto.randomUUID(),
      ...body,
      durationSec: Math.round((Date.parse(body.endedAt) - Date.parse(body.startedAt)) / 1000),
    };
    const logs = [log, ...load()].slice(0, 200);
    try {
      localStorage.setItem(KEY, JSON.stringify(logs));
    } catch {
      /* 저장 실패 무시 */
    }
    return log;
  },
  list: async (): Promise<SleepLog[]> => load(),
};

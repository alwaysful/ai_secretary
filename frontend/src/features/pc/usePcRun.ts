import { useCallback, useEffect, useState } from 'react';
import { api, PcRun } from '../../shared/api';
import { isNative } from '../../shared/backend';

export const isLive = (r: PcRun | null | undefined) => !!r && (r.status === 'starting' || r.status === 'running');

/** 현재 실행 폴링. 실행 중 0.8초, 아니면 4초 */
export function usePcRun() {
  const [run, setRun] = useState<PcRun | null>(null);
  const live = isLive(run);
  const refresh = useCallback(
    () =>
      api
        .pcCurrent()
        .then((r) => setRun(r.run))
        .catch(() => undefined),
    [],
  );
  useEffect(() => {
    if (isNative()) return;
    void refresh();
    const t = setInterval(refresh, live ? 800 : 4000);
    return () => clearInterval(t);
  }, [live, refresh]);
  const cancel = useCallback(async () => {
    const r = await api.pcCancel().catch(() => null);
    if (r) setRun(r.run);
  }, []);
  return { run, setRun, live, refresh, cancel };
}

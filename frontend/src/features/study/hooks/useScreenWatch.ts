import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../shared/api';
import { studyApi, type ScreenCheck } from '../api/study';
import { errorText } from '../format';
import { pickSlackMessage } from '../lib/hints';
import { notifyDesktop } from '../lib/notify';
import { isRobot } from '../lib/tone';
import { openScreen, type ScreenSession } from '../services/screenCaptureService';

const CAPTURE_MS = 30_000; // 캡처 간격
const TOAST_COOLDOWN_MS = 60_000;

export function useScreenWatch(paused = false) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [last, setLast] = useState<ScreenCheck | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const tickRef = useRef<(() => Promise<void>) | null>(null);
  const aliveRef = useRef(true);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setActive(false);
    setLast(null);
  }, []);

  const start = useCallback(async () => {
    if (stopRef.current) return;
    setError(null);
    const allowed = await api.settings().then(
      (s) => s.screenRead,
      () => true,
    );
    if (!allowed) {
      setError('화면 읽기 꺼짐. 설정 → 권한에서 켜기.');
      return;
    }

    let session: ScreenSession;
    try {
      session = await openScreen();
    } catch (e) {
      setError(errorText(e));
      return;
    }
    if (!aliveRef.current) {
      session.close();
      return;
    }

    let busy = false;
    let closed = false;
    let lastToast = 0;

    const tick = async () => {
      if (busy || closed || pausedRef.current) return;
      busy = true;
      try {
        const image = session.capture();
        if (!image) return;
        const res = await studyApi.screenCheck(image);
        if (closed || pausedRef.current) return;
        setLast(res);
        const now = Date.now();
        if (res.distracted && res.message && now - lastToast >= TOAST_COOLDOWN_MS) {
          lastToast = now;
          const msg = isRobot() ? pickSlackMessage() : res.message;
          setToast(msg);
          notifyDesktop('딴짓 감지', msg);
        }
      } catch (e) {
        if (!closed) setError(errorText(e));
      } finally {
        busy = false;
      }
    };

    const timer = setInterval(() => void tick(), CAPTURE_MS);
    tickRef.current = tick;
    stopRef.current = () => {
      closed = true;
      tickRef.current = null;
      clearInterval(timer);
      session.close();
    };
    // 브라우저의 "공유 중지" 버튼
    session.onEnded(stop);
    setActive(true);
    void tick();
  }, [stop]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, []);

  const dismiss = useCallback(() => setToast(null), []);
  const checkNow = useCallback(() => void tickRef.current?.(), []);

  return { active, error, toast, last, start, stop, dismiss, checkNow };
}

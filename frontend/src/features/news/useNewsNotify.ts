import { useEffect } from 'react';
import { api, NewsUnread } from '../../shared/api';

const KEY = 'aura.news.notifiedAt';
const POLL_MS = 5 * 60_000;

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* 무시 */
  }
};

export const newsNotifySupported = () => typeof Notification !== 'undefined';

/** 새 학사공지·공모전 → OS 알림 (권한 있을 때만). 앱 전역에서 5분마다 확인 */
export function useNewsNotify(onOpen: () => void) {
  useEffect(() => {
    const check = () =>
      api.newsUnread().then((u: NewsUnread) => {
        if (!u.latest) return;
        const last = read();
        write(u.latest);
        // 처음 실행: 기준점만 저장
        if (!last || u.latest <= last || u.total === 0) return;
        if (!newsNotifySupported() || Notification.permission !== 'granted') return;
        const parts = [u.notice && `학사공지 ${u.notice}`, u.contest && `공모전 ${u.contest}`].filter(Boolean);
        try {
          const n = new Notification('AURA 새 소식', { body: `안 읽은 글: ${parts.join(', ')}`, tag: 'aura-news' });
          n.onclick = () => {
            window.focus();
            onOpen();
          };
        } catch {
          /* 무시 */
        }
      }, () => undefined);
    void check();
    const t = setInterval(() => void check(), POLL_MS);
    return () => clearInterval(t);
  }, [onOpen]);
}

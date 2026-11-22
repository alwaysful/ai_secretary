import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const KEY = 'aura.theme';
const EVENT = 'aura-theme';
const ORDER: Theme[] = ['system', 'light', 'dark'];

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(t: Theme = getTheme()): void {
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme;
  else root.dataset.theme = t;
}

export function setTheme(t: Theme): void {
  try {
    if (t === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* 저장 불가 환경: 이번 세션만 적용 */
  }
  applyTheme(t);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: t }));
}

export function cycleTheme(): Theme {
  const next = ORDER[(ORDER.indexOf(getCurrent()) + 1) % ORDER.length];
  setTheme(next);
  return next;
}

let current: Theme = getTheme();
const getCurrent = () => current;
window.addEventListener(EVENT, (e) => {
  current = (e as CustomEvent<Theme>).detail;
});

export const THEME_LABEL: Record<Theme, string> = { system: '🖥 시스템', light: '☀ 라이트', dark: '🌙 다크' };

export function useTheme(): Theme {
  const [t, setT] = useState<Theme>(getCurrent());
  useEffect(() => {
    const on = (e: Event) => setT((e as CustomEvent<Theme>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return t;
}

export function ThemeButton() {
  const t = useTheme();
  return (
    <button className="theme-btn" onClick={() => cycleTheme()} title="테마 전환 (Ctrl+Shift+L)" aria-label={`테마: ${THEME_LABEL[t]}`}>
      {THEME_LABEL[t]}
    </button>
  );
}

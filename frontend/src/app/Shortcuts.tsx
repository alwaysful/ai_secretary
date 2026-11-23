import { useEffect, useState } from 'react';
import type { PageId } from './App';
import { cycleTheme } from '../shared/theme';

export const PAGE_KEYS: [string, PageId, string][] = [
  ['1', 'lobby', '로비'],
  ['2', 'chat', 'AI 채팅'],
  ['3', 'briefing', '아침 브리핑'],
  ['4', 'schedule', '일정'],
  ['5', 'mail', '메일'],
  ['6', 'memory', '기억 관리'],
  ['7', 'settings', '설정'],
  ['8', 'study', '공부 집중'],
  ['9', 'info', '정보'],
];

/** 입력 중인지 (단일 키 단축키는 입력 중에 무시) */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

/** 앱 전역 단축키: Alt+숫자 이동, Ctrl+Shift+L 테마, ? 도움말 */
export function useGlobalShortcuts(navigate: (p: PageId) => void) {
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const hit = PAGE_KEYS.find(([k]) => e.code === `Digit${k}`);
        if (hit) {
          e.preventDefault();
          navigate(hit[1]);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyL') {
        e.preventDefault();
        cycleTheme();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setHelp((v) => !v);
        return;
      }
      if (e.key === '?' && !isTyping(e)) {
        e.preventDefault();
        setHelp(true);
      }
      if (e.key === 'Escape') setHelp(false);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [navigate]);
  return { help, closeHelp: () => setHelp(false) };
}

const CHAT_KEYS: [string, string][] = [
  ['Enter', '보내기'],
  ['Shift+Enter', '줄바꿈'],
  ['Esc', '응답 생성 중단'],
  ['Ctrl+K', '대화 검색'],
  ['Ctrl+Shift+O', '새 대화'],
  ['Alt+R', '마지막 응답 재생성'],
  ['↑ (빈 입력창)', '마지막 메시지 편집'],
  ['/', '입력창으로 이동'],
];

export function ShortcutHelp(props: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={props.onClose} role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="단축키" onClick={(e) => e.stopPropagation()}>
        <h2>
          단축키
          <button className="ghost" onClick={props.onClose} aria-label="닫기">
            ✕
          </button>
        </h2>
        <table className="keys">
          <tbody>
            <tr className="group">
              <td colSpan={2}>전체</td>
            </tr>
            {PAGE_KEYS.map(([k, , label]) => (
              <tr key={k}>
                <td>
                  <kbd>Alt+{k}</kbd>
                </td>
                <td>{label}</td>
              </tr>
            ))}
            <tr>
              <td>
                <kbd>Ctrl+Shift+L</kbd>
              </td>
              <td>테마 전환 (시스템 → 라이트 → 다크)</td>
            </tr>
            <tr>
              <td>
                <kbd>?</kbd> / <kbd>Ctrl+/</kbd>
              </td>
              <td>이 도움말</td>
            </tr>
            <tr className="group">
              <td colSpan={2}>채팅</td>
            </tr>
            {CHAT_KEYS.map(([k, label]) => (
              <tr key={k}>
                <td>
                  <kbd>{k}</kbd>
                </td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

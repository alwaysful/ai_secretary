import { Capacitor } from '@capacitor/core';

const KEY = 'aura.backendUrl';

/** Android 앱(Capacitor) 여부 */
export const isNative = (): boolean => Capacitor.isNativePlatform();

export function getBackendUrl(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function setBackendUrl(url: string): void {
  try {
    localStorage.setItem(KEY, url.trim().replace(/\/+$/, ''));
  } catch {
    /* 무시 */
  }
}

/**
 * API 기준 주소.
 * 웹: vite 프록시 /api. Android 앱: 저장한 백엔드 주소 (예: http://100.x.y.z:3000, Tailscale).
 */
export function apiBase(): string {
  if (!isNative()) return '/api';
  return getBackendUrl() || '/api';
}

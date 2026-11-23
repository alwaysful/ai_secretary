import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface PhoneWatchStatus {
  usageGranted: boolean;
  notificationsGranted: boolean;
  running: boolean;
  /** PC 공부 세션 진행 중 (마지막 확인) */
  live: boolean;
  /** 배터리 최적화 제외 (삼성: 제한 없음) */
  batteryUnrestricted: boolean;
  samsung: boolean;
  foreground: string | null;
  foregroundLabel: string | null;
}

export interface PhoneWatchConfig {
  backendUrl: string;
  packages: string[];
  /** PC 공부 세션 중에만 감시 */
  pcOnly: boolean;
  enabled: boolean;
}

export interface InstalledApp {
  package: string;
  label: string;
}

/** Android 네이티브 플러그인 (android/app/.../phonewatch) */
export interface PhoneWatchPlugin {
  status(): Promise<PhoneWatchStatus>;
  openUsageSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  openAppDetails(): Promise<void>;
  requestBatteryUnrestricted(): Promise<void>;
  requestNotifications(): Promise<{ granted: boolean }>;
  getConfig(): Promise<PhoneWatchConfig>;
  setConfig(c: Partial<Omit<PhoneWatchConfig, 'enabled'>>): Promise<PhoneWatchConfig>;
  start(): Promise<void>;
  stop(): Promise<void>;
  listApps(): Promise<{ apps: InstalledApp[] }>;
  /** PC 화면 QR(aura://setup?api=...)로 앱이 열림 */
  addListener(event: 'setup', cb: (e: { backendUrl: string }) => void): Promise<PluginListenerHandle>;
}

/** QR 내용 → 백엔드 주소 (aura://setup?api=... 또는 http 주소) */
export function parseSetupQr(text: string): string | null {
  const t = text.trim();
  try {
    if (t.startsWith('aura://')) {
      const api = new URL(t.replace(/^aura:/, 'http:')).searchParams.get('api');
      return api && /^https?:\/\//.test(api) ? api.replace(/\/+$/, '') : null;
    }
    if (/^https?:\/\/[^\s]+$/.test(t)) return t.replace(/\/+$/, '');
  } catch {
    return null;
  }
  return null;
}

export const setupQrText = (url: string) => `aura://setup?api=${encodeURIComponent(url)}`;

export const PhoneWatch = registerPlugin<PhoneWatchPlugin>('PhoneWatch');

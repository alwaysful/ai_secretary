import { registerPlugin } from '@capacitor/core';

export interface PhoneWatchStatus {
  usageGranted: boolean;
  notificationsGranted: boolean;
  running: boolean;
  /** PC 공부 세션 진행 중 (마지막 확인) */
  live: boolean;
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
  openBatterySettings(): Promise<void>;
  requestNotifications(): Promise<{ granted: boolean }>;
  getConfig(): Promise<PhoneWatchConfig>;
  setConfig(c: Partial<Omit<PhoneWatchConfig, 'enabled'>>): Promise<PhoneWatchConfig>;
  start(): Promise<void>;
  stop(): Promise<void>;
  listApps(): Promise<{ apps: InstalledApp[] }>;
}

export const PhoneWatch = registerPlugin<PhoneWatchPlugin>('PhoneWatch');

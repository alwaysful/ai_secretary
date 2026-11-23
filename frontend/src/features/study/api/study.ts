import { request } from './client';

export interface ScreenCheck {
  distracted: boolean;
  activity: string;
  distractPct: number;
  summary: string;
  message: string | null;
}

export interface StudySession {
  id: string;
  startedAt: string;
  endedAt: string;
  focusSec: number;
  pomodoros: number;
  posture: number;
  phone: number;
  slack: number;
  sleep: number;
}

export interface StatsBucket extends Omit<StudySession, 'id' | 'startedAt' | 'endedAt'> {
  /** 버킷 시작 날짜 YYYY-MM-DD (주 단위는 월요일) */
  date: string;
  /** 폰 딴짓 앱 사용 (Android 앱) */
  phoneApp: number;
}

export interface PhoneEvent {
  id: string;
  at: string;
  package: string;
  label: string;
}

export const studyApi = {
  saveSession: (s: StudySession) =>
    request<unknown>('/study/sessions', { method: 'PUT', body: s }),

  stats: (unit: 'day' | 'week') =>
    request<StatsBucket[]>(`/study/stats?unit=${unit}`),

  /** PC 세션 진행 중 알림 (폰 앱이 확인) */
  live: (active: boolean) =>
    request<{ active: boolean }>('/study/live', { method: 'POST', body: { active } }),

  phoneEvents: (since: string) =>
    request<PhoneEvent[]>(`/study/phone-events?since=${encodeURIComponent(since)}`),

  screenCheck: (image: string) =>
    request<ScreenCheck>('/study/screen-check', {
      method: 'POST',
      body: { image },
    }),
};

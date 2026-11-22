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
}

export const studyApi = {
  saveSession: (s: StudySession) =>
    request<unknown>('/study/sessions', { method: 'PUT', body: s }),

  stats: (unit: 'day' | 'week') =>
    request<StatsBucket[]>(`/study/stats?unit=${unit}`),

  screenCheck: (image: string) =>
    request<ScreenCheck>('/study/screen-check', {
      method: 'POST',
      body: { image },
    }),
};

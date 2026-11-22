export interface CalendarEvent {
  id: string;
  subject: string;
  /** 로컬 시각 문자열 `YYYY-MM-DDTHH:mm:ss` (TIMEZONE 기준) */
  start: string;
  end: string;
  isAllDay: boolean;
  location: string;
  /** 출처. 수정 시 해당 서비스로 보낸다 */
  source?: CalendarSource;
}

export type CalendarSource = 'outlook' | 'google';

export interface CalendarEvent {
  id: string;
  subject: string;
  /** 로컬 시각 문자열 `YYYY-MM-DDTHH:mm:ss` (TIMEZONE 기준) */
  start: string;
  end: string;
  isAllDay: boolean;
  location: string;
}

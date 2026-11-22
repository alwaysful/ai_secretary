/** 폰 알림: AURA에는 기기 연동 없음. 호출만 받고 미발송 처리. */
export type AlertKind = 'phone' | 'sleep-start' | 'sleep-end';

export const notificationApi = {
  phoneAlert: async (
    _deviceId: string,
    _kind: AlertKind = 'phone',
    _durationSec?: number,
  ): Promise<{ sent: boolean }> => ({ sent: false }),
};

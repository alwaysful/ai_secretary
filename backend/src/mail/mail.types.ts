export interface MailSummary {
  id: string;
  subject: string;
  from: string;
  /** ISO 8601 (UTC) */
  receivedAt: string;
  isRead: boolean;
  preview: string;
}

export interface MailDetail extends MailSummary {
  /** 일반 텍스트 본문. MAIL_BODY_MAX_CHARS에서 잘림 */
  body: string;
  truncated: boolean;
}

export interface MailAuthStatus {
  configured: boolean;
  connected: boolean;
  /** device code 로그인 진행 중 */
  pending: boolean;
  email: string | null;
}

export interface DeviceLogin {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

export type MailErrorCode =
  | 'NOT_CONFIGURED'
  | 'NOT_CONNECTED'
  | 'AUTH_FAILED'
  | 'NOT_FOUND'
  | 'UPSTREAM'
  | 'TIMEOUT';

/** 메시지에 토큰·메일 내용을 넣지 않는다. */
export class MailError extends Error {
  constructor(
    public readonly code: MailErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'MailError';
  }
}

const STATUS: Record<MailErrorCode, number> = {
  NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  NOT_CONNECTED: HttpStatus.UNAUTHORIZED,
  AUTH_FAILED: HttpStatus.BAD_GATEWAY,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  UPSTREAM: HttpStatus.BAD_GATEWAY,
  TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
};

@Catch(MailError)
export class MailErrorFilter implements ExceptionFilter<MailError> {
  catch(e: MailError, host: ArgumentsHost): void {
    const status = STATUS[e.code];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, error: e.code, message: e.message });
  }
}

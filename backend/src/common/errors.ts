import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { ModelError } from '../ai/models/base-model';

/** 프론트가 원인을 구분해 안내하기 위한 오류 코드 */
export type AppErrorCode =
  | 'DB_DOWN'
  | 'OLLAMA_DOWN'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_TIMEOUT'
  | 'MODEL_ERROR'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'INTERNAL';

export function isDbDown(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  if (e instanceof Prisma.PrismaClientRustPanicError) return true;
  return e instanceof Prisma.PrismaClientKnownRequestError && /^P10\d\d$/.test(e.code);
}

const MODEL_CODE: Record<ModelError['code'], AppErrorCode> = {
  UNAVAILABLE: 'OLLAMA_DOWN',
  NOT_FOUND: 'MODEL_NOT_FOUND',
  TIMEOUT: 'MODEL_TIMEOUT',
  BAD_RESPONSE: 'MODEL_ERROR',
  ABORTED: 'MODEL_ERROR',
};

/** 예외 → { code, message, status } */
export function describeError(e: unknown): { code: AppErrorCode; message: string; status: number } {
  if (isDbDown(e)) return { code: 'DB_DOWN', message: 'database unavailable', status: 503 };
  if (e instanceof ModelError) return { code: MODEL_CODE[e.code], message: e.message, status: 503 };
  if (e instanceof HttpException) {
    const body = e.getResponse() as { code?: AppErrorCode; message?: string | string[] } | string;
    const status = e.getStatus();
    const code =
      typeof body === 'object' && body.code
        ? body.code
        : status === 404
          ? 'NOT_FOUND'
          : status < 500
            ? 'BAD_REQUEST'
            : 'INTERNAL';
    const m = typeof body === 'string' ? body : body.message;
    return { code, message: Array.isArray(m) ? m.join(', ') : (m ?? e.message), status };
  }
  return { code: 'INTERNAL', message: 'internal error', status: 500 };
}

/** Prisma 연결 오류를 503 DB_DOWN 으로 변환 */
@Catch(Prisma.PrismaClientInitializationError, Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientRustPanicError)
export class PrismaErrorFilter implements ExceptionFilter {
  private readonly log = new Logger(PrismaErrorFilter.name);

  catch(e: Error, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (isDbDown(e)) {
      this.log.error(`db: ${e.message.split('\n')[0]}`);
      res.status(503).json({ statusCode: 503, code: 'DB_DOWN', message: 'database unavailable' });
      return;
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      res.status(404).json({ statusCode: 404, code: 'NOT_FOUND', message: 'not found' });
      return;
    }
    this.log.error(e.message);
    res.status(500).json({ statusCode: 500, code: 'INTERNAL', message: 'internal error' });
  }
}

/** REST 경로에서 새어 나온 ModelError → 503 + 코드 */
@Catch(ModelError)
export class ModelErrorFilter implements ExceptionFilter {
  catch(e: ModelError, host: ArgumentsHost): void {
    const { code, message, status } = describeError(e);
    host.switchToHttp().getResponse<Response>().status(status).json({ statusCode: status, code, message });
  }
}

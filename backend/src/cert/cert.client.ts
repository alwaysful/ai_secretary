import { BadGatewayException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** 자격증 서비스(별도 앱 cert-search) 호출 */
@Injectable()
export class CertClient {
  private readonly base: string;

  constructor(config: ConfigService) {
    this.base = (config.get<string>('CERT_API_URL') ?? 'http://127.0.0.1:3100').replace(/\/$/, '');
  }

  async req<T>(path: string, init?: { method?: string; body?: unknown; timeoutMs?: number }): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method: init?.method ?? 'GET',
        headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(init?.timeoutMs ?? 15_000),
      });
    } catch {
      throw new BadGatewayException('자격증 서비스 연결 안 됨 (cert-search 의 start-cert.bat 실행 확인)');
    }
    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) {
      const msg = (data as { message?: unknown } | undefined)?.message;
      throw new HttpException(Array.isArray(msg) ? msg.join(', ') : String(msg ?? `자격증 서비스 오류 ${res.status}`), res.status);
    }
    return data as T;
  }

  get = <T>(path: string) => this.req<T>(path);
  post = <T>(path: string, body: unknown, timeoutMs?: number) => this.req<T>(path, { method: 'POST', body, timeoutMs });
  put = <T>(path: string, body: unknown) => this.req<T>(path, { method: 'PUT', body });
}

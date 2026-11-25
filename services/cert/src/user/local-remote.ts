import { Injectable, NotFoundException } from '@nestjs/common';
import { CertBatch } from '../cert/cert.batch';
import { CertService } from '../cert/cert.service';

/**
 * 단독 실행용: AURA가 HTTP로 부르던 자격증 API를 같은 프로세스에서 바로 호출.
 * AURA 쪽 CertClient 와 같은 모양 (get/post/put + 경로).
 */
@Injectable()
export class LocalRemote {
  constructor(
    private readonly certs: CertService,
    private readonly batch: CertBatch,
  ) {}

  async get<T>(path: string): Promise<T> {
    const u = new URL(path, 'http://local');
    const p = u.pathname;
    let m: RegExpExecArray | null;
    if (p === '/certs/meta') return this.certs.meta() as T;
    if (p === '/certs/config') return (await this.certs.getConfig()) as T;
    if (p === '/certs/places/branches') return this.certs.branches() as T;
    if (p === '/certs/places') return (await this.certs.places(u.searchParams.get('brch') ?? '')) as T;
    if ((m = /^\/certs\/([^/]+)\/about$/.exec(p))) return (await this.certs.about(decodeURIComponent(m[1]))) as T;
    if ((m = /^\/certs\/([^/]+)$/.exec(p))) return (await this.certs.one(decodeURIComponent(m[1]))) as T;
    throw new NotFoundException(path);
  }

  async post<T>(path: string, body: unknown, _timeoutMs?: number): Promise<T> {
    const b = body as Record<string, unknown>;
    if (path === '/certs/query') return (await this.certs.list(b)) as T;
    if (path === '/certs/calendar') return (await this.certs.calendar({ ...b, from: new Date(b.from as string), to: new Date(b.to as string) })) as T;
    if (path === '/certs/score') return this.certs.score(b.items as { name: string; kind: string; grade: string | null; field: string }[]) as T;
    if (path === '/certs/run') {
      await this.batch.runNow(b.jobs as string[]);
      return (await this.certs.getConfig()) as T;
    }
    throw new NotFoundException(path);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    if (path === '/certs/config/key') {
      const v = await this.certs.setKey(((body as { key?: string | null }).key ?? null) as string | null);
      void this.batch.tick();
      return v as T;
    }
    throw new NotFoundException(path);
  }
}

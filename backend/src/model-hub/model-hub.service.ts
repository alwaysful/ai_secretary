import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseModel } from '../ai/models/base-model';
import { EnvVars } from '../config/env';
import { CATALOG, CatalogModel, MODEL_NAME_RE } from './catalog';

export type PullStatus = 'pulling' | 'done' | 'error' | 'canceled';

export interface PullJob {
  name: string;
  status: PullStatus;
  /** Ollama status 문구 (pulling manifest, verifying ...) */
  phase: string;
  completed: number;
  total: number;
  error?: string;
}

export interface HubItem extends CatalogModel {
  installed: boolean;
  /** 설치된 실제 크기 (bytes) */
  bytes?: number;
}

export interface HubView {
  reachable: boolean;
  current: string;
  items: HubItem[];
  /** 목록에 없는 설치 모델 */
  others: { name: string; bytes: number }[];
  jobs: PullJob[];
}

interface Tag {
  name: string;
  size?: number;
}

interface PullChunk {
  status?: string;
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
}

const same = (a: string, b: string) => a === b || a === `${b}:latest` || b === `${a}:latest`;
/** 끝난 작업을 목록에 남겨두는 시간 */
const KEEP_MS = 60_000;

/** Ollama 모델 목록·다운로드(/api/pull)·삭제. 다운로드는 백그라운드, 진행률은 jobs로 조회. */
@Injectable()
export class ModelHubService implements OnModuleDestroy {
  private readonly log = new Logger(ModelHubService.name);
  private readonly baseUrl: string;
  private readonly jobs = new Map<string, { job: PullJob; ctrl: AbortController; layers: Map<string, [number, number]> }>();
  private readonly timers = new Set<NodeJS.Timeout>();
  fetchFn: typeof fetch = (...a) => fetch(...a);

  constructor(
    config: ConfigService<EnvVars, true>,
    private readonly model: BaseModel,
  ) {
    this.baseUrl = config.get('OLLAMA_BASE_URL', { infer: true }).replace(/\/+$/, '');
  }

  onModuleDestroy(): void {
    for (const j of this.jobs.values()) j.ctrl.abort();
    for (const t of this.timers) clearTimeout(t);
  }

  async view(): Promise<HubView> {
    const tags = await this.tags();
    const installed = tags ?? [];
    const find = (n: string) => installed.find((t) => same(t.name, n));
    const items = CATALOG.map((c) => {
      const t = find(c.name);
      return { ...c, installed: !!t, ...(t?.size ? { bytes: t.size } : {}) };
    });
    const others = installed
      .filter((t) => !CATALOG.some((c) => same(c.name, t.name)))
      .map((t) => ({ name: t.name, bytes: t.size ?? 0 }));
    return { reachable: tags !== null, current: this.model.name, items, others, jobs: this.listJobs() };
  }

  listJobs(): PullJob[] {
    return [...this.jobs.values()].map((j) => ({ ...j.job }));
  }

  /** 다운로드 시작. 즉시 반환. */
  pull(name: string): PullJob {
    name = name.trim();
    if (!MODEL_NAME_RE.test(name)) throw new BadRequestException({ code: 'BAD_REQUEST', message: `잘못된 모델명: ${name}` });
    const prev = this.jobs.get(name);
    if (prev?.job.status === 'pulling') return { ...prev.job };
    const entry = {
      job: { name, status: 'pulling' as PullStatus, phase: '시작', completed: 0, total: 0 },
      ctrl: new AbortController(),
      layers: new Map<string, [number, number]>(),
    };
    this.jobs.set(name, entry);
    void this.run(entry);
    return { ...entry.job };
  }

  cancel(name: string): void {
    const e = this.jobs.get(name);
    if (!e || e.job.status !== 'pulling') throw new NotFoundException({ code: 'NOT_FOUND', message: '진행 중인 다운로드 없음' });
    e.ctrl.abort();
  }

  async remove(name: string): Promise<void> {
    if (!MODEL_NAME_RE.test(name)) throw new BadRequestException({ code: 'BAD_REQUEST', message: `잘못된 모델명: ${name}` });
    if (same(name, this.model.name)) {
      throw new ConflictException({ code: 'BAD_REQUEST', message: '사용 중인 모델은 삭제 불가. 설정에서 다른 모델로 바꾼 뒤 삭제.' });
    }
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name, name }),
      });
    } catch {
      throw this.down();
    }
    if (res.status === 404) throw new NotFoundException({ code: 'NOT_FOUND', message: `설치되지 않은 모델: ${name}` });
    if (!res.ok) throw new BadRequestException({ code: 'MODEL_ERROR', message: `삭제 실패 (${res.status})` });
  }

  /** null = Ollama 접속 불가 */
  private async tags(): Promise<Tag[] | null> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) return null;
      const body = (await res.json()) as { models?: Tag[] };
      return body.models ?? [];
    } catch {
      return null;
    }
  }

  private down() {
    return new BadRequestException({ code: 'OLLAMA_DOWN', message: `Ollama 연결 안 됨 (${this.baseUrl})` });
  }

  private async run(e: { job: PullJob; ctrl: AbortController; layers: Map<string, [number, number]> }): Promise<void> {
    const { job } = e;
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: job.name, name: job.name, stream: true }),
        signal: e.ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(this.errText(text) || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) this.apply(e, JSON.parse(line) as PullChunk);
        }
      }
      if (buf.trim()) this.apply(e, JSON.parse(buf) as PullChunk);
      if (job.status === 'pulling') {
        if (job.phase !== 'success') throw new Error('다운로드가 중간에 끊김');
        job.status = 'done';
        job.completed = job.total;
        this.log.log(`pulled ${job.name}`);
      }
    } catch (err) {
      if (e.ctrl.signal.aborted) {
        job.status = 'canceled';
      } else {
        job.status = 'error';
        const msg = err instanceof Error ? err.message : String(err);
        job.error = /fetch failed|ECONNREFUSED/i.test(msg) ? 'Ollama 연결 안 됨' : msg;
        this.log.warn(`pull ${job.name} failed: ${job.error}`);
      }
    } finally {
      const t = setTimeout(() => {
        this.timers.delete(t);
        if (this.jobs.get(job.name)?.job === job) this.jobs.delete(job.name);
      }, KEEP_MS);
      t.unref?.();
      this.timers.add(t);
    }
  }

  private apply(e: { job: PullJob; layers: Map<string, [number, number]> }, c: PullChunk): void {
    if (c.error) throw new Error(this.errText(c.error));
    if (c.status) e.job.phase = c.status;
    if (c.digest && c.total) {
      e.layers.set(c.digest, [c.completed ?? 0, c.total]);
      let done = 0;
      let total = 0;
      for (const [d, t] of e.layers.values()) {
        done += d;
        total += t;
      }
      e.job.completed = done;
      e.job.total = total;
    }
  }

  private errText(raw: string): string {
    try {
      const j = JSON.parse(raw) as { error?: string };
      raw = j.error ?? raw;
    } catch {
      /* plain text */
    }
    if (/file does not exist|not found|repository not found|401|403/i.test(raw)) return '없는 모델명 또는 비공개 저장소';
    return raw.slice(0, 200);
  }
}

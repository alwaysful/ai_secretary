import { Logger, OnModuleDestroy } from '@nestjs/common';
import { filterThinkStream, stripThinkText as stripThink } from './think-filter';
import {
  BaseModel,
  GenerateRequest,
  GenerateResponse,
  ModelError,
  ModelErrorCode,
  ModelProbe,
  ModelState,
} from './base-model';

export interface OllamaOptions {
  baseUrl: string;
  model: string;
  keepAlive: string;
  timeoutMs: number;
  /** 테스트용 주입 */
  fetchImpl?: typeof fetch;
}

interface OllamaChunk {
  message?: { content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };


export class OllamaModel extends BaseModel implements OnModuleDestroy {
  private _name: string;
  private readonly log = new Logger(OllamaModel.name);
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private _state: ModelState = 'unloaded';

  constructor(private readonly opts: OllamaOptions) {
    super();
    this._name = opts.model;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.fetchFn = opts.fetchImpl ?? fetch;
  }

  get name(): string {
    return this._name;
  }

  get state(): ModelState {
    return this._state;
  }

  /** 모델 존재 확인 후 빈 요청으로 메모리에 적재한다. */
  async load(force = false): Promise<void> {
    if (this._state === 'ready' && !force) return;
    this._state = 'loading';
    try {
      const tags = await this.request('/api/tags', { method: 'GET' }, undefined, 10_000);
      const body = (await this.readJson(tags)) as { models?: { name: string }[] };
      const found = (body.models ?? []).some(
        (m) => m.name === this.name || m.name === `${this.name}:latest`,
      );
      if (!found) throw new ModelError('NOT_FOUND', `model not pulled: ${this.name}`);

      await this.request('/api/generate', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ model: this.name, keep_alive: this.opts.keepAlive }),
      });
      this._state = 'ready';
    } catch (e) {
      this._state = 'error';
      throw e;
    }
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    await this.ensureReady();
    const started = Date.now();
    const res = await this.request(
      '/api/chat',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(this.chatBody(req, false)) },
      req.signal,
      req.timeoutMs,
    );
    const data = (await this.readJson(res, req.signal)) as OllamaChunk;
    if (data.error) throw new ModelError('BAD_RESPONSE', data.error);
    return {
      content: stripThink(data.message?.content ?? ''),
      model: this.name,
      promptTokens: data.prompt_eval_count,
      completionTokens: data.eval_count,
      durationMs: Date.now() - started,
    };
  }

  stream(req: GenerateRequest): AsyncIterable<string> {
    return filterThinkStream(this.rawStream(req));
  }

  private async *rawStream(req: GenerateRequest): AsyncIterable<string> {
    await this.ensureReady();
    const res = await this.request(
      '/api/chat',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(this.chatBody(req, true)) },
      req.signal,
      req.timeoutMs,
    );
    if (!res.body) throw new ModelError('BAD_RESPONSE', 'empty response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        let chunk: Awaited<ReturnType<typeof reader.read>>;
        try {
          chunk = await reader.read();
        } catch (e) {
          throw this.toModelError(e, req.signal, 'BAD_RESPONSE');
        }
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const token = this.parseLine(line);
          if (token) yield token;
        }
      }
      const rest = buf.trim();
      if (rest) {
        const token = this.parseLine(rest);
        if (token) yield token;
      }
    } finally {
      reader.cancel().catch(() => undefined);
    }
  }

  async listModels(): Promise<string[]> {
    const res = await this.request('/api/tags', { method: 'GET' }, undefined, 5_000);
    const body = (await this.readJson(res)) as { models?: { name: string }[] };
    return (body.models ?? []).map((m) => m.name).sort();
  }

  async switchTo(name: string): Promise<void> {
    if (name === this._name || name === `${this._name}:latest`) return;
    const installed = await this.listModels();
    if (!installed.some((n) => n === name || n === `${name}:latest`)) {
      throw new ModelError('NOT_FOUND', `model not pulled: ${name}`);
    }
    await this.unload().catch((e: Error) => this.log.warn(`unload failed: ${e.message}`));
    this._name = name;
    this._state = 'unloaded';
  }

  /** /api/tags(설치), /api/ps(메모리 적재)로 상태 점검. 실패해도 throw 하지 않는다. */
  async probe(): Promise<ModelProbe> {
    const names = async (path: string) => {
      const res = await this.request(path, { method: 'GET' }, undefined, 3_000);
      const body = (await this.readJson(res)) as { models?: { name?: string; model?: string }[] };
      return (body.models ?? []).flatMap((m) => [m.name, m.model]).filter((n): n is string => !!n);
    };
    const has = (list: string[]) => list.some((n) => n === this.name || n === `${this.name}:latest`);
    try {
      const tags = await names('/api/tags');
      const ps = await names('/api/ps').catch(() => null);
      return { reachable: true, installed: has(tags), loaded: ps ? has(ps) : null };
    } catch {
      return { reachable: false, installed: null, loaded: null };
    }
  }

  /** keep_alive=0 요청으로 Ollama가 모델을 즉시 메모리에서 내리게 한다. */
  async unload(): Promise<void> {
    if (this._state === 'unloaded') return;
    await this.request('/api/generate', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ model: this.name, keep_alive: 0 }),
    });
    this._state = 'unloaded';
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.unload();
    } catch (e) {
      this.log.warn(`unload failed: ${(e as Error).message}`);
    }
  }

  private async ensureReady(): Promise<void> {
    if (this._state !== 'ready') await this.load();
  }

  private chatBody(req: GenerateRequest, stream: boolean): Record<string, unknown> {
    const options: Record<string, number> = {};
    if (req.temperature !== undefined) options.temperature = req.temperature;
    if (req.maxTokens !== undefined) options.num_predict = req.maxTokens;
    return {
      model: this.name,
      messages: req.messages,
      stream,
      think: false,
      keep_alive: this.opts.keepAlive,
      options,
    };
  }

  private parseLine(line: string): string {
    let data: OllamaChunk;
    try {
      data = JSON.parse(line) as OllamaChunk;
    } catch (e) {
      throw new ModelError('BAD_RESPONSE', 'invalid stream line', e);
    }
    if (data.error) throw new ModelError('BAD_RESPONSE', data.error);
    return data.message?.content ?? '';
  }

  private async readJson(res: Response, signal?: AbortSignal): Promise<unknown> {
    try {
      return await res.json();
    } catch (e) {
      throw this.toModelError(e, signal, 'BAD_RESPONSE');
    }
  }

  private async request(
    path: string,
    init: RequestInit,
    signal?: AbortSignal,
    timeoutMs: number = this.opts.timeoutMs,
  ): Promise<Response> {
    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await this.fetchFn(this.baseUrl + path, { ...init, signal: combined });
    } catch (e) {
      throw this.toModelError(e, signal, 'UNAVAILABLE');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ModelError(
        res.status === 404 ? 'NOT_FOUND' : 'BAD_RESPONSE',
        `ollama ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    return res;
  }

  private toModelError(e: unknown, signal: AbortSignal | undefined, fallback: ModelErrorCode): ModelError {
    if (e instanceof ModelError) return e;
    if (signal?.aborted) return new ModelError('ABORTED', 'request aborted', e);
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      return new ModelError('TIMEOUT', 'model request timed out', e);
    }
    const msg = fallback === 'UNAVAILABLE' ? `ollama unreachable at ${this.baseUrl}` : 'bad ollama response';
    return new ModelError(fallback, msg, e);
  }
}

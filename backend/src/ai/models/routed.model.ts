import { OnModuleDestroy } from '@nestjs/common';
import { apiGenerate, apiStream } from '../providers/api-providers';
import { AiRouteService } from '../providers/ai-route.service';
import { BaseModel, GenerateRequest, GenerateResponse, ModelError, ModelProbe, ModelState } from './base-model';
import { OllamaModel } from './ollama.model';

/** 채팅 모델: 설정(로컬/API)에 따라 Ollama 또는 외부 API로 보냄 */
export class RoutedModel extends BaseModel implements OnModuleDestroy {
  constructor(
    readonly local: OllamaModel,
    private readonly routes: AiRouteService,
    private readonly timeoutMs: number,
  ) {
    super();
  }

  private api() {
    const a = this.routes.api('chat');
    if (a && !a.key) throw new ModelError('UNAVAILABLE', `${a.provider} API 키 없음 (설정 → 모델에서 입력)`);
    return a;
  }

  get name(): string {
    const a = this.routes.api('chat');
    return a ? `${a.provider}:${a.model}` : this.local.name;
  }

  get localName(): string {
    return this.local.name;
  }

  get state(): ModelState {
    return this.routes.api('chat') ? 'ready' : this.local.state;
  }

  load(force?: boolean): Promise<void> {
    return this.routes.api('chat') ? Promise.resolve() : this.local.load(force);
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const a = this.api();
    if (!a) return this.local.generate(req);
    const started = Date.now();
    const content = await apiGenerate(a.provider, a.key, a.model, req.messages, {
      maxTokens: req.maxTokens,
      temperature: req.temperature,
      signal: req.signal,
      timeoutMs: req.timeoutMs ?? this.timeoutMs,
      feature: 'chat',
    });
    return { content, model: `${a.provider}:${a.model}`, durationMs: Date.now() - started };
  }

  stream(req: GenerateRequest): AsyncIterable<string> {
    if (!this.routes.api('chat')) return this.local.stream(req);
    return this.apiStream(req);
  }

  private async *apiStream(req: GenerateRequest): AsyncIterable<string> {
    const a = this.api()!;
    yield* apiStream(a.provider, a.key, a.model, req.messages, {
      maxTokens: req.maxTokens,
      temperature: req.temperature,
      signal: req.signal,
      timeoutMs: req.timeoutMs ?? this.timeoutMs,
      feature: 'chat',
    });
  }

  unload(): Promise<void> {
    return this.local.unload();
  }

  listModels(): Promise<string[]> {
    return this.local.listModels();
  }

  switchTo(name: string): Promise<void> {
    return this.local.switchTo(name);
  }

  probe(): Promise<ModelProbe> {
    if (this.routes.api('chat')) return Promise.resolve({ reachable: true, installed: true, loaded: true });
    return this.local.probe();
  }

  onModuleDestroy(): Promise<void> {
    return this.local.onModuleDestroy();
  }
}

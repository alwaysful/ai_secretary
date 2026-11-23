import { ConfigService } from '@nestjs/config';
import { BaseModel } from '../../src/ai/models/base-model';
import { ModelHubService } from '../../src/model-hub/model-hub.service';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ndjson = (lines: unknown[]) => new Response(lines.map((l) => JSON.stringify(l)).join('\n') + '\n');

function make(fetchImpl: jest.Mock) {
  const config = { get: () => 'http://ollama.test/' } as unknown as ConfigService;
  const svc = new ModelHubService(config as never, { name: 'qwen3:4b' } as BaseModel);
  svc.fetchFn = fetchImpl as unknown as typeof fetch;
  return svc;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('ModelHubService', () => {
  afterEach(() => jest.useRealTimers());

  it('view: 설치 여부 표시, 목록 외 모델은 others', async () => {
    const f = jest.fn().mockResolvedValue(json({ models: [{ name: 'qwen3:4b', size: 10 }, { name: 'foo:latest', size: 5 }] }));
    const v = await make(f).view();
    expect(v.reachable).toBe(true);
    expect(v.items.find((i) => i.name === 'qwen3:4b')).toMatchObject({ installed: true, bytes: 10 });
    expect(v.items.find((i) => i.name === 'qwen3:8b')?.installed).toBe(false);
    expect(v.others).toEqual([{ name: 'foo:latest', bytes: 5 }]);
  });

  it('view: Ollama 꺼짐이면 reachable=false', async () => {
    const v = await make(jest.fn().mockRejectedValue(new TypeError('fetch failed'))).view();
    expect(v.reachable).toBe(false);
  });

  it('pull: 레이어 합산 진행률 후 done', async () => {
    const f = jest.fn().mockResolvedValue(
      ndjson([
        { status: 'pulling manifest' },
        { status: 'pulling a', digest: 'a', total: 100, completed: 50 },
        { status: 'pulling b', digest: 'b', total: 100, completed: 100 },
        { status: 'success' },
      ]),
    );
    const svc = make(f);
    svc.pull('qwen3:8b');
    await tick();
    await tick();
    const j = svc.listJobs()[0];
    expect(j).toMatchObject({ name: 'qwen3:8b', status: 'done', total: 200, completed: 200 });
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ model: 'qwen3:8b', stream: true });
    svc.onModuleDestroy();
  });

  it('pull: 오류 줄이면 error', async () => {
    const svc = make(jest.fn().mockResolvedValue(ndjson([{ error: 'pull model manifest: file does not exist' }])));
    svc.pull('nope:1b');
    await tick();
    await tick();
    expect(svc.listJobs()[0]).toMatchObject({ status: 'error', error: 'Ollama에 없는 모델명' });
    svc.onModuleDestroy();
  });

  it('pull: 잘못된 이름 거부', () => {
    expect(() => make(jest.fn()).pull('rm -rf /')).toThrow();
  });

  it('remove: 사용 중 모델은 거부', async () => {
    await expect(make(jest.fn()).remove('qwen3:4b')).rejects.toThrow();
  });
});

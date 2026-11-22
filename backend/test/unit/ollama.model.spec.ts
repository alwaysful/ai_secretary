import { ModelError } from '../../src/ai/models/base-model';
import { OllamaModel } from '../../src/ai/models/ollama.model';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function make(fetchImpl: jest.Mock) {
  return new OllamaModel({
    baseUrl: 'http://ollama.test/',
    model: 'qwen3:4b',
    keepAlive: '5m',
    timeoutMs: 5000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

const ready = () =>
  jest.fn().mockResolvedValueOnce(json({ models: [{ name: 'qwen3:4b' }] })).mockResolvedValueOnce(json({}));

describe('OllamaModel', () => {
  it('load: 모델 확인 후 ready', async () => {
    const f = ready();
    const m = make(f);
    await m.load();
    expect(m.state).toBe('ready');
    expect(f.mock.calls[0][0]).toBe('http://ollama.test/api/tags');
  });

  it('load: 모델 없으면 NOT_FOUND', async () => {
    const f = jest.fn().mockResolvedValue(json({ models: [{ name: 'other:1b' }] }));
    const m = make(f);
    await expect(m.load()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.state).toBe('error');
  });

  it('load: 연결 실패면 UNAVAILABLE', async () => {
    const f = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(make(f).load()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('generate: 응답 파싱 및 <think> 제거', async () => {
    const f = ready().mockResolvedValueOnce(
      json({ message: { content: '<think>x</think>안녕' }, prompt_eval_count: 3, eval_count: 2 }),
    );
    const res = await make(f).generate({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res).toMatchObject({ content: '안녕', model: 'qwen3:4b', promptTokens: 3, completionTokens: 2 });
    const body = JSON.parse(f.mock.calls[2][1].body as string);
    expect(body).toMatchObject({ stream: false, think: false, keep_alive: '5m' });
  });

  it('generate: 타임아웃이면 TIMEOUT', async () => {
    const f = ready().mockRejectedValueOnce(Object.assign(new Error('t'), { name: 'TimeoutError' }));
    await expect(make(f).generate({ messages: [] })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('generate: 호출자 취소면 ABORTED', async () => {
    const ac = new AbortController();
    ac.abort();
    const f = ready().mockRejectedValueOnce(Object.assign(new Error('a'), { name: 'AbortError' }));
    await expect(make(f).generate({ messages: [], signal: ac.signal })).rejects.toMatchObject({
      code: 'ABORTED',
    });
  });

  it('generate: HTTP 오류면 BAD_RESPONSE', async () => {
    const f = ready().mockResolvedValueOnce(new Response('boom', { status: 500 }));
    const err = await make(f).generate({ messages: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(ModelError);
    expect(err.code).toBe('BAD_RESPONSE');
  });

  it('stream: NDJSON 토큰 순서대로 yield', async () => {
    const lines =
      JSON.stringify({ message: { content: '가' } }) +
      '\n' +
      JSON.stringify({ message: { content: '나' } }) +
      '\n' +
      JSON.stringify({ done: true, message: { content: '' } });
    const f = ready().mockResolvedValueOnce(new Response(lines));
    const out: string[] = [];
    for await (const t of make(f).stream({ messages: [] })) out.push(t);
    expect(out).toEqual(['가', '나']);
  });

  it('unload: keep_alive=0 전송 후 unloaded', async () => {
    const f = ready().mockResolvedValueOnce(json({}));
    const m = make(f);
    await m.load();
    await m.unload();
    expect(m.state).toBe('unloaded');
    expect(JSON.parse(f.mock.calls[2][1].body as string)).toEqual({ model: 'qwen3:4b', keep_alive: 0 });
  });
});

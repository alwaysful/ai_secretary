import { GatewayTimeoutException, NotFoundException } from '@nestjs/common';
import { BaseModel, GenerateResponse, ModelError } from '../../src/ai/models/base-model';
import { ConversationService } from '../../src/conversation/conversation.service';

class FakeModel extends BaseModel {
  readonly name = 'fake';
  readonly state = 'ready' as const;
  generate = jest.fn<Promise<GenerateResponse>, [any]>();
  stream = jest.fn();
  async load() {}
  async unload() {}
}

function setup() {
  const stored: any[] = [];
  const prisma: any = {
    conversation: { findUnique: jest.fn().mockResolvedValue({ id: 'c1' }) },
    message: {
      create: jest.fn(async ({ data }) => {
        const row = { id: String(stored.length + 1), createdAt: new Date(), ...data };
        stored.push(row);
        return row;
      }),
      findMany: jest.fn(async () => [...stored].reverse()), // createdAt desc
    },
  };
  const model = new FakeModel();
  const config: any = {
    get: (k: string) => ({ HISTORY_LIMIT: 20, SYSTEM_PROMPT: 'sys' })[k as 'HISTORY_LIMIT'],
  };
  const tools = { contextFor: jest.fn().mockResolvedValue(null) };
  return { prisma, model, stored, tools, service: new ConversationService(prisma, model, config, tools) };
}

describe('ConversationService', () => {
  it('postMessage: user/assistant 저장, 프롬프트는 system + 시간순 기록', async () => {
    const { service, model, stored } = setup();
    model.generate.mockResolvedValue({ content: 'ok', model: 'fake', durationMs: 5 });

    const res = await service.postMessage('c1', 'hello');

    expect(model.generate.mock.calls[0][0].messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
    ]);
    expect(stored.map((m) => m.role)).toEqual(['USER', 'ASSISTANT']);
    expect(res.assistantMessage.content).toBe('ok');
  });

  it('postMessage: 대화 없으면 404, 모델 호출 안 함', async () => {
    const { service, model, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue(null);
    await expect(service.postMessage('x', 'hi')).rejects.toBeInstanceOf(NotFoundException);
    expect(model.generate).not.toHaveBeenCalled();
  });

  it('postMessage: 모델 TIMEOUT → 504, 사용자 메시지는 유지', async () => {
    const { service, model, stored } = setup();
    model.generate.mockRejectedValue(new ModelError('TIMEOUT', 'slow'));
    await expect(service.postMessage('c1', 'hi')).rejects.toBeInstanceOf(GatewayTimeoutException);
    expect(stored.map((m) => m.role)).toEqual(['USER']);
  });

  it('postMessage: 동시 요청은 직렬 실행', async () => {
    const { service, model } = setup();
    let running = 0;
    let maxRunning = 0;
    model.generate.mockImplementation(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return { content: 'ok', model: 'fake', durationMs: 10 };
    });
    await Promise.all([service.postMessage('c1', 'a'), service.postMessage('c1', 'b')]);
    expect(maxRunning).toBe(1);
  });

  it('stream: 토큰 yield 후 누적 응답 저장', async () => {
    const { service, model, stored } = setup();
    model.stream.mockImplementation(async function* () {
      yield 'a';
      yield 'b';
    });
    const out: string[] = [];
    for await (const t of service.stream('c1', 'hi')) out.push(t);
    expect(out).toEqual(['a', 'b']);
    expect(stored[1]).toMatchObject({ role: 'ASSISTANT', content: 'ab' });
  });

  it('postMessage: 도구 컨텍스트는 system에 병합, DB에는 저장 안 함', async () => {
    const { service, model, tools, stored } = setup();
    tools.contextFor.mockResolvedValue('CTX');
    model.generate.mockResolvedValue({ content: 'ok', model: 'fake', durationMs: 1 });

    await service.postMessage('c1', '메일 보여줘');

    expect(tools.contextFor).toHaveBeenCalledWith('메일 보여줘');
    expect(model.generate.mock.calls[0][0].messages[0]).toEqual({ role: 'system', content: 'sys\n\nCTX' });
    expect(stored.some((m) => String(m.content).includes('CTX'))).toBe(false);
  });

  it('stream: 도구 컨텍스트에 취소 신호 전달', async () => {
    const { service, model, tools } = setup();
    tools.contextFor.mockResolvedValue('CTX');
    model.stream.mockImplementation(async function* () {
      yield 'a';
    });
    const ac = new AbortController();
    for await (const _ of service.stream('c1', 'hi', ac.signal)) void _;
    expect(tools.contextFor).toHaveBeenCalledWith('hi', ac.signal);
    expect(model.stream.mock.calls[0][0].messages[0].content).toBe('sys\n\nCTX');
  });
});

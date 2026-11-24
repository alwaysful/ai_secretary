import { GatewayTimeoutException, NotFoundException } from '@nestjs/common';
import { BaseModel, GenerateResponse, ModelError } from '../../src/ai/models/base-model';
import { CAPABILITIES, ConversationService } from '../../src/conversation/conversation.service';

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
        const row = { id: String(stored.length + 1), createdAt: new Date(Date.now() + stored.length), ...data };
        stored.push(row);
        return row;
      }),
      findMany: jest.fn(async () => [...stored].reverse()), // createdAt desc
      findFirst: jest.fn(async () => [...stored].reverse().find((m) => m.role === 'USER') ?? null),
      update: jest.fn(async ({ where, data }) => Object.assign(stored.find((m) => m.id === where.id), data)),
      deleteMany: jest.fn(async ({ where }) => {
        const keep = stored.filter((m) => !(m.createdAt > where.createdAt.gt));
        stored.splice(0, stored.length, ...keep);
      }),
    },
  };
  const model = new FakeModel();
  const config: any = {
    get: (k: string) => ({ HISTORY_LIMIT: 20, SYSTEM_PROMPT: 'sys' })[k as 'HISTORY_LIMIT'],
  };
  const tools = { contextFor: jest.fn().mockResolvedValue(null) };
  const settings: any = { systemPrompt: () => 'sys', pcControl: () => true };
  const actions: any = { plan: jest.fn().mockResolvedValue(null) };
  const memory: any = { plan: jest.fn().mockResolvedValue(null), context: jest.fn().mockResolvedValue(null) };
  const pc: any = { plan: jest.fn().mockReturnValue(null) };
  const companion: any = { promptContext: jest.fn().mockResolvedValue('BOND'), afterReply: jest.fn() };
  return {
    prisma,
    model,
    stored,
    tools,
    actions,
    memory,
    service: new ConversationService(prisma, model, config, tools, settings, actions, memory, pc, companion),
  };
}

describe('ConversationService', () => {
  it('postMessage: user/assistant 저장, 프롬프트는 system + 시간순 기록', async () => {
    const { service, model, stored } = setup();
    model.generate.mockResolvedValue({ content: 'ok', model: 'fake', durationMs: 5 });

    const res = await service.postMessage('c1', 'hello');

    expect(model.generate.mock.calls[0][0].messages).toEqual([
      { role: 'system', content: `sys\n\n${CAPABILITIES}` },
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
    expect(model.generate.mock.calls[0][0].messages[0]).toEqual({ role: 'system', content: `sys\n\n${CAPABILITIES}\n\nCTX` });
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
    expect(model.stream.mock.calls[0][0].messages[0].content).toBe(`sys\n\n${CAPABILITIES}\n\nCTX`);
  });

  it('stream: 상태 이벤트 순서', async () => {
    const { service, model } = setup();
    model.stream.mockImplementation(async function* () {
      yield 'a';
    });
    const phases: string[] = [];
    for await (const _ of service.stream('c1', 'hi', undefined, { onStatus: (p) => phases.push(p) })) void _;
    expect(phases).toEqual(['tools', 'queued', 'generating']);
  });

  it('regenerate: 마지막 응답 삭제 후 같은 질문으로 재생성', async () => {
    const { service, model, stored } = setup();
    const replies = ['first', 'second'];
    model.stream.mockImplementation(async function* () {
      yield replies.shift()!;
    });
    for await (const _ of service.stream('c1', 'q')) void _;
    for await (const _ of service.regenerate('c1')) void _;
    expect(stored.map((m) => [m.role, m.content])).toEqual([
      ['USER', 'q'],
      ['ASSISTANT', 'second'],
    ]);
    expect(model.stream.mock.calls[1][0].messages.at(-1)).toEqual({ role: 'user', content: 'q' });
  });

  it('editLast: 마지막 질문 수정 후 재생성', async () => {
    const { service, model, stored } = setup();
    model.stream.mockImplementation(async function* () {
      yield 'r';
    });
    for await (const _ of service.stream('c1', 'old')) void _;
    for await (const _ of service.editLast('c1', 'new')) void _;
    expect(stored.map((m) => m.content)).toEqual(['new', 'r']);
  });

  it('regenerate: 사용자 메시지 없으면 400', async () => {
    const { service } = setup();
    await expect(service.regenerate('c1').next()).rejects.toThrow('no user message');
  });

  it('stream: 일정 쓰기 요청은 확인 대기 작업으로 전달, 컨텍스트 병합', async () => {
    const { service, model, actions } = setup();
    const action = { id: 'a1', summary: '등록: 회의' };
    actions.plan.mockResolvedValue({ context: 'PLAN', action });
    model.stream.mockImplementation(async function* () {
      yield 'ok';
    });
    const got: unknown[] = [];
    for await (const _ of service.stream('c1', '내일 3시 회의 잡아', undefined, { onAction: (a) => got.push(a) })) void _;
    expect(got).toEqual([action]);
    expect(model.stream.mock.calls[0][0].messages[0].content).toBe(`sys\n\n${CAPABILITIES}\n\nPLAN`);
  });

  it('stream: 중단 시 부분 응답을 stopped=true 로 저장', async () => {
    const { service, model, stored } = setup();
    const ac = new AbortController();
    model.stream.mockImplementation(async function* () {
      yield 'part';
      ac.abort();
      throw new ModelError('ABORTED', 'aborted');
    });
    await expect(
      (async () => {
        for await (const _ of service.stream('c1', 'hi', ac.signal)) void _;
      })(),
    ).rejects.toBeTruthy();
    expect(stored[1]).toMatchObject({ role: 'ASSISTANT', content: 'part', stopped: true });
  });

  it('켜진 기억은 system 프롬프트에 포함', async () => {
    const { service, model, memory } = setup();
    memory.context.mockResolvedValue('MEM');
    model.generate.mockResolvedValue({ content: 'ok', model: 'fake', durationMs: 1 });
    await service.postMessage('c1', 'hi');
    expect(model.generate.mock.calls[0][0].messages[0].content).toBe(`sys\n\n${CAPABILITIES}\n\nMEM`);
  });
});

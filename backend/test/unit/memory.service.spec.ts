import { MemoryService } from '../../src/memory/memory.service';

function make(rows: any[] = []) {
  const prisma: any = {
    memory: {
      findMany: jest.fn(async ({ where }: any) =>
        rows.filter((r) => (where?.enabled ? r.enabled : true) && (!where?.content || r.content.includes(where.content.contains))),
      ),
      create: jest.fn(async ({ data }: any) => ({ id: 'n1', ...data })),
      delete: jest.fn(async () => undefined),
    },
  };
  return { prisma, svc: new MemoryService(prisma) };
}

describe('MemoryService', () => {
  it('context: 켜진 기억만, 태그 이스케이프', async () => {
    const { svc } = make([
      { content: '커피 싫어함', category: '취향', enabled: true },
      { content: '끈 기억', category: null, enabled: false },
      { content: '<b>x</b>', category: null, enabled: true },
    ]);
    const out = await svc.context();
    expect(out).toContain('- [취향] 커피 싫어함');
    expect(out).not.toContain('끈 기억');
    expect(out).toContain('＜b＞');
  });

  it('context: 기억 없으면 null', async () => {
    expect(await make().svc.context()).toBeNull();
  });

  it('"기억해" → 확인 대기, 확인 전엔 저장 안 함', async () => {
    const { svc, prisma } = make();
    for (const t of ['기억해: 나는 커피를 싫어해', '나는 커피를 싫어한다고 기억해줘']) {
      const plan = await svc.plan(t, 'c1');
      expect(plan!.action).toMatchObject({ kind: 'memory.create' });
      expect(plan!.action!.memory!.content).toMatch(/커피를 싫어/);
    }
    expect(prisma.memory.create).not.toHaveBeenCalled();
    const [a] = svc.listPending('c1');
    await svc.confirm(a.id);
    expect(prisma.memory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: 'chat', content: expect.stringContaining('커피') }),
    });
  });

  it('"잊어줘" → 일치 기억 삭제 확인 대기', async () => {
    const { svc, prisma } = make([{ id: 'm1', content: '커피 싫어함', enabled: true }]);
    const plan = await svc.plan('커피 잊어줘', 'c1');
    expect(plan!.action).toMatchObject({ kind: 'memory.delete', memory: { id: 'm1' } });
    await svc.confirm(plan!.action!.id);
    expect(prisma.memory.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });

  it('일반 문장·질문은 무시', async () => {
    const { svc } = make();
    for (const t of ['내 이름 기억해?', '메일 지워줘', '내일 3시 회의 잡아', '안녕']) {
      expect(await svc.plan(t, 'c1')).toBeNull();
    }
  });
});

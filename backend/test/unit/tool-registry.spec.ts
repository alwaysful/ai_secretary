import { ToolError } from '../../src/ai/tools/tool';
import { TOOL_PREAMBLE, ToolRegistry } from '../../src/ai/tools/tool-registry.service';

function make(tool: Partial<{ matches: (t: string) => boolean; run: jest.Mock }>) {
  const fake: any = { name: 'fake', readOnly: true, matches: () => true, run: jest.fn(), ...tool };
  return { fake, registry: new ToolRegistry(fake, { name: "outlook-calendar", matches: () => false } as any, { name: "web-scrape", matches: () => false } as any) };
}

describe('ToolRegistry', () => {
  it('매칭 없으면 null, 도구 실행 안 함', async () => {
    const { registry, fake } = make({ matches: () => false });
    expect(await registry.contextFor('안녕')).toBeNull();
    expect(fake.run).not.toHaveBeenCalled();
  });

  it('매칭 시 안내문 + 태그 블록', async () => {
    const { registry, fake } = make({ run: jest.fn().mockResolvedValue('DATA') });
    const out = await registry.contextFor('메일', undefined);
    expect(out).toBe(`${TOOL_PREAMBLE}\n<fake>\nDATA\n</fake>`);
    expect(fake.run).toHaveBeenCalledWith('메일', undefined);
  });

  it('ToolError는 사유를 전달', async () => {
    const { registry } = make({ run: jest.fn().mockRejectedValue(new ToolError('미연결')) });
    expect(await registry.contextFor('x')).toContain('(실패: 미연결)');
  });

  it('일반 오류는 내부 메시지를 숨김', async () => {
    const { registry } = make({ run: jest.fn().mockRejectedValue(new Error('token=SECRET')) });
    const out = await registry.contextFor('x');
    expect(out).toContain('(도구 실행 실패)');
    expect(out).not.toContain('SECRET');
  });
});

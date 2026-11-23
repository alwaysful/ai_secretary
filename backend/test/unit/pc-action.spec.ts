import { parseDecision } from '../../src/pc-control/pc-action';
import { PcControlService } from '../../src/pc-control/pc-control.service';

describe('parseDecision', () => {
  it('click 좌표 검증', () => {
    expect(parseDecision('{"thought":"t","action":"click","x":10.4,"y":20}', 100, 100).act).toEqual({ action: 'click', x: 10, y: 20 });
    expect(() => parseDecision('{"action":"click","x":500,"y":20}', 100, 100)).toThrow('좌표');
  });
  it('type·key·done', () => {
    expect(parseDecision('x {"action":"type","text":"안녕"} y', 10, 10).act).toEqual({ action: 'type', text: '안녕' });
    expect(parseDecision('{"action":"key","keys":"Ctrl+L"}', 10, 10).act).toEqual({ action: 'key', keys: 'ctrl+l' });
    expect(() => parseDecision('{"action":"key","keys":"rm -rf; $(x)"}', 10, 10)).toThrow();
    expect(parseDecision('{"action":"done","message":"ok"}', 10, 10).act).toEqual({ action: 'done', message: 'ok' });
  });
  it('모르는 동작 거부', () => {
    expect(() => parseDecision('{"action":"shell"}', 10, 10)).toThrow('모르는');
    expect(() => parseDecision('nope', 10, 10)).toThrow('JSON');
  });
});

describe('PcControlService.plan', () => {
  const config: any = { get: (k: string) => ({ OLLAMA_BASE_URL: 'http://x', STUDY_VISION_MODEL: 'v', PC_MAX_STEPS: 5 })[k] };
  const svc = new PcControlService(config);
  it('명령어만 매칭', () => {
    expect(svc.plan('PC: 메모장 열어', 'c1')?.action?.pc?.goal).toBe('메모장 열어');
    expect(svc.plan('/pc 크롬 켜', 'c1')?.action?.kind).toBe('pc.run');
    expect(svc.plan('pc 사양 알려줘', 'c1')).toBeNull();
  });
  it('정지: 실행 중 아니면 그대로', () => {
    expect(svc.cancel()).toBeNull();
  });
});

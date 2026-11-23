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

import { pcGoal } from '../../src/pc-control/pc-control.service';
import { filterThinkStream, stripThinkText } from '../../src/ai/models/think-filter';

describe('pcGoal 자연어', () => {
  it.each(['메모장 켜고 안녕 적어', '크롬 열어서 네이버 들어가', '계산기 실행해줘', '마우스로 휴지통 클릭해'])('조작: %s', (t) => {
    expect(pcGoal(t)).toBe(t);
  });
  it.each(['메모장 어떻게 켜?', '크롬이 뭐야', '내일 일정 알려줘', '안녕', '메모장 켜는 방법'])('아님: %s', (t) => {
    expect(pcGoal(t)).toBeNull();
  });
});

describe('think 제거', () => {
  const leak = 'Okay, the user wants me to open a note.\n\nHmm, but I cannot.\n\n메모장을 열어 "안녕"을 적을게요.';
  it('태그·영어 추론', () => {
    expect(stripThinkText('<think>a</think>답')).toBe('답');
    expect(stripThinkText('reasoning...</think>\n답')).toBe('답');
    expect(stripThinkText(leak)).toBe('메모장을 열어 "안녕"을 적을게요.');
    expect(stripThinkText('안녕하세요')).toBe('안녕하세요');
  });
  const collect = async (toks: string[]) => {
    async function* g() {
      for (const t of toks) yield t;
    }
    let s = '';
    for await (const t of filterThinkStream(g())) s += t;
    return s;
  };
  it('스트림', async () => {
    expect(await collect(['안녕', '하세요'])).toBe('안녕하세요');
    expect(await collect(['<th', 'ink>생각', '</think>', '답', '변'])).toBe('답변');
    expect(await collect(leak.match(/.{1,5}/gs)!)).toBe('메모장을 열어 "안녕"을 적을게요.');
    expect(await collect(['Hello ', 'world'])).toBe('Hello world');
  });
});

describe('닫는 태그 없는 영어 추론', () => {
  it('한글 인용문만 남김', () => {
    const t = 'Okay, let me try.\n\nSo the answer is "확인 버튼을 눌러 주세요." (Please press)\n\nWait, maybe';
    expect(stripThinkText(t)).toBe('확인 버튼을 눌러 주세요.');
    expect(stripThinkText('Okay, I think so.\n\nWait, no.')).toBe('답을 만들지 못했어요. 다시 말해 주세요.');
  });
  it('PC 명령은 고정 답변', () => {
    const cfg: any = { get: (k: string) => ({ OLLAMA_BASE_URL: 'http://x', STUDY_VISION_MODEL: 'v' })[k] };
    expect(new PcControlService(cfg).plan('PC: 메모장 켜', null)?.reply).toContain('시작');
  });
});

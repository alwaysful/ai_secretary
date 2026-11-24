import { bondLevel, parseReply } from '../../src/admin/companion.service';

describe('companion bond', () => {
  it('태그 파싱', () => {
    expect(parseReply('[emo:happy love:+2] 안녕')).toEqual({ emotion: 'happy', love: 2, body: '안녕' });
    expect(parseReply(' [emo:SAD] 흠')).toEqual({ emotion: 'sad', love: 0, body: '흠' });
    expect(parseReply('[emo:weird love:-9] x')).toEqual({ emotion: null, love: -3, body: 'x' });
    expect(parseReply('그냥 답')).toEqual({ emotion: null, love: 0, body: '그냥 답' });
  });

  it('단계', () => {
    expect(bondLevel(0).name).toBe('어색함');
    expect(bondLevel(45).name).toBe('썸');
    expect(bondLevel(100).next).toBeNull();
    expect(bondLevel(30).next).toEqual({ name: '썸', at: 45 });
  });
});

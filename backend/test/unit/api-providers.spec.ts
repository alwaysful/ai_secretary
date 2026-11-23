import { RoutedModel } from '../../src/ai/models/routed.model';
import { CATALOG, imageMime, maskKey, supports } from '../../src/ai/providers/api-providers';

describe('api providers', () => {
  it('maskKey', () => {
    expect(maskKey('sk-abcdefgh1234')).toBe('sk-a••••1234');
    expect(maskKey('short')).toBe('••••');
  });
  it('imageMime', () => {
    expect(imageMime('/9j/AAA')).toBe('image/jpeg');
    expect(imageMime('iVBORw0')).toBe('image/png');
  });
  it('Anthropic STT 미지원', () => {
    expect(supports('anthropic', 'stt')).toBe(false);
    expect(supports('openai', 'stt')).toBe(true);
    expect(CATALOG.anthropic.chat[0]).toMatch(/^claude-/);
  });
});

describe('RoutedModel', () => {
  const local = { name: 'qwen3:4b', state: 'unloaded', probe: async () => ({ reachable: false, installed: null, loaded: null }) };
  it('로컬이면 Ollama 사용', async () => {
    const m = new RoutedModel(local as never, { api: () => null } as never, 1000);
    expect(m.name).toBe('qwen3:4b');
    expect(m.state).toBe('unloaded');
  });
  it('API면 이름·상태 API 기준, 키 없으면 오류', async () => {
    const m = new RoutedModel(local as never, { api: () => ({ provider: 'openai', model: 'gpt-x', key: '' }) } as never, 1000);
    expect(m.name).toBe('openai:gpt-x');
    expect(m.localName).toBe('qwen3:4b');
    expect(m.state).toBe('ready');
    await expect(m.generate({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/API 키 없음/);
  });
});

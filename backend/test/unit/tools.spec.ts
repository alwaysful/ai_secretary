import { ForbiddenException } from '@nestjs/common';
import { cleanOcr, stripDataUrl, ToolsService } from '../../src/tools/tools.service';

describe('tools helpers', () => {
  it('stripDataUrl', () => {
    expect(stripDataUrl('data:image/png;base64,AAA\nB')).toBe('AAAB');
    expect(stripDataUrl('QUJD')).toBe('QUJD');
  });
  it('cleanOcr', () => {
    expect(cleanOcr('```text\n안녕\n세계\n```')).toBe('안녕\n세계');
    expect(cleanOcr('<think>x</think> 글자 ')).toBe('글자');
  });
});

describe('ToolsService permissions/models', () => {
  const config = { get: (k: string) => (k === 'OLLAMA_BASE_URL' ? 'http://x' : undefined) };
  const mk = (mic: boolean) =>
    new ToolsService(config as never, { mic: () => mic, sttModel: () => 'base', ocrModel: () => 'v:1' } as never);

  it('마이크 꺼지면 mic STT 거부', async () => {
    await expect(mk(false).transcribe('AAAA', 'audio/webm', 'ko', 'mic')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('status 는 설정 모델 사용', async () => {
    const t = mk(true);
    (t as unknown as { checkStt: () => Promise<unknown> }).checkStt = async () => ({ ok: true, detail: '' });
    await expect(t.status()).resolves.toMatchObject({ ocr: { model: 'v:1' }, stt: { model: 'base' }, mic: true });
  });
});

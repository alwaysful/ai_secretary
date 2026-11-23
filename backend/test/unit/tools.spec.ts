import { cleanOcr, stripDataUrl } from '../../src/tools/tools.service';

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

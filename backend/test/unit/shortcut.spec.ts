import { BadRequestException } from '@nestjs/common';
import { normalizeUrl } from '../../src/shortcut/shortcut.service';

describe('normalizeUrl', () => {
  it('adds https', () => expect(normalizeUrl('naver.com')).toBe('https://naver.com/'));
  it('keeps http', () => expect(normalizeUrl(' http://a.com/x ')).toBe('http://a.com/x'));
  it('rejects javascript:', () => expect(() => normalizeUrl('javascript:alert(1)')).toThrow(BadRequestException));
  it('rejects garbage', () => expect(() => normalizeUrl('http://')).toThrow(BadRequestException));
});

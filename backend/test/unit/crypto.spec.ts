import { decrypt, encrypt } from '../../src/common/crypto';

const KEY = 'a'.repeat(64);

describe('crypto', () => {
  it('암호화 후 복호화', () => {
    expect(decrypt(encrypt('refresh-token', KEY), KEY)).toBe('refresh-token');
  });

  it('같은 평문도 매번 다른 암호문', () => {
    expect(encrypt('x', KEY)).not.toBe(encrypt('x', KEY));
  });

  it('다른 키면 실패', () => {
    expect(() => decrypt(encrypt('x', KEY), 'b'.repeat(64))).toThrow();
  });

  it('변조되면 실패', () => {
    const buf = Buffer.from(encrypt('secret', KEY), 'base64');
    buf[buf.length - 1] ^= 1;
    expect(() => decrypt(buf.toString('base64'), KEY)).toThrow();
  });

  it('키 길이가 32바이트가 아니면 실패', () => {
    expect(() => encrypt('x', 'abcd')).toThrow(/32 bytes/);
  });
});

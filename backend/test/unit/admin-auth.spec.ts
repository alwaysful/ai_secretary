import { ConfigService } from '@nestjs/config';
import { AdminAuthService } from '../../src/admin/admin-auth.service';

const svc = (code?: string) => new AdminAuthService({ get: () => code } as unknown as ConfigService<never, true>);

describe('AdminAuthService', () => {
  it('기본 코드: 틀린 코드 거부', () => {
    expect(() => svc().login('000000', 'ip')).toThrow('코드 틀림');
  });

  it('ADMIN_CODE 검증', () => {
    const a = svc('abc');
    expect(() => a.login('abd', 'ip')).toThrow();
    expect(a.verify(a.login('abc', 'ip').token)).toBe(true);
  });

  it('5회 실패 시 잠김', () => {
    const a = svc('abc');
    for (let i = 0; i < 5; i++) expect(() => a.login('x', 'ip2')).toThrow('코드 틀림');
    expect(() => a.login('abc', 'ip2')).toThrow(/잠김/);
    expect(a.verify(a.login('abc', 'other').token)).toBe(true);
  });

  it('로그아웃 후 토큰 무효', () => {
    const a = svc('abc');
    const { token } = a.login('abc', 'ip');
    a.logout(token);
    expect(a.verify(token)).toBe(false);
    expect(a.verify(undefined)).toBe(false);
  });
});

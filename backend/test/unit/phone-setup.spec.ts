import { isTailscale, setupAddresses } from '../../src/study/phone-setup';

const v4 = (address: string, internal = false) =>
  ({ address, family: 'IPv4', internal, netmask: '', mac: '', cidr: null }) as const;

describe('phone setup', () => {
  it('Tailscale 대역 판별', () => {
    expect(isTailscale('100.64.0.5')).toBe(true);
    expect(isTailscale('100.127.1.1')).toBe(true);
    expect(isTailscale('100.128.0.1')).toBe(false);
    expect(isTailscale('192.168.0.2')).toBe(false);
  });

  it('Tailscale 먼저, 루프백·공인 IP 제외', () => {
    const out = setupAddresses(3000, {
      lo: [v4('127.0.0.1', true)],
      Wi: [v4('192.168.0.10')],
      Tailscale: [v4('100.101.2.3')],
      pub: [v4('8.8.8.8')],
    });
    expect(out.map((a) => a.url)).toEqual(['http://100.101.2.3:3000', 'http://192.168.0.10:3000']);
    expect(out[0].kind).toBe('tailscale');
  });
});

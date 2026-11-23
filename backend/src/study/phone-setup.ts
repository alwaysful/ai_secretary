import { networkInterfaces } from 'node:os';

export interface SetupAddress {
  url: string;
  kind: 'tailscale' | 'lan';
  iface: string;
}

/** Tailscale CGNAT 대역 100.64.0.0/10 */
export function isTailscale(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return a === 100 && b >= 64 && b <= 127;
}

function isLan(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** 폰이 접속할 수 있는 PC 주소 후보 (Tailscale 먼저) */
export function setupAddresses(
  port: number,
  ifaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): SetupAddress[] {
  const out: SetupAddress[] = [];
  for (const [iface, list] of Object.entries(ifaces)) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const kind = isTailscale(a.address) ? 'tailscale' : isLan(a.address) ? 'lan' : null;
      if (kind) out.push({ url: `http://${a.address}:${port}`, kind, iface });
    }
  }
  return out.sort((x, y) => Number(y.kind === 'tailscale') - Number(x.kind === 'tailscale'));
}

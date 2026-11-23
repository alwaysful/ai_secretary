import { isLocalRequest } from '../../src/system/system.controller';

describe('isLocalRequest', () => {
  it('loopback ok', () => expect(isLocalRequest('127.0.0.1', undefined)).toBe(true));
  it('ipv6 loopback ok', () => expect(isLocalRequest('::ffff:127.0.0.1', '127.0.0.1')).toBe(true));
  it('tailscale rejected', () => expect(isLocalRequest('100.64.0.5', undefined)).toBe(false));
  it('proxied remote rejected', () => expect(isLocalRequest('127.0.0.1', '100.64.0.5')).toBe(false));
  it('no address rejected', () => expect(isLocalRequest(undefined, undefined)).toBe(false));
});

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { upsertEnv } from '../../src/common/env-file';

describe('upsertEnv', () => {
  it('기존 키 교체, 새 키 추가, 주석 유지', () => {
    const d = mkdtempSync(join(tmpdir(), 'env-'));
    const f = join(d, '.env');
    writeFileSync(f, '# c\nA=1\nADMIN_CODE=old\n');
    upsertEnv({ ADMIN_CODE: 'new', MS_CLIENT_ID: 'x' }, f);
    expect(readFileSync(f, 'utf8')).toBe('# c\nA=1\nADMIN_CODE=new\nMS_CLIENT_ID=x\n');
    expect(() => upsertEnv({ A: 'a\nB=2' }, f)).toThrow();
    rmSync(d, { recursive: true, force: true });
    delete process.env.MS_CLIENT_ID;
    delete process.env.ADMIN_CODE;
  });
});

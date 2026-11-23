import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SetupService, repoRoot, SETUP_TASKS } from '../../src/setup/setup.service';

const config = { get: () => undefined } as never;

describe('SetupService', () => {
  it('rejects unknown task', () => {
    expect(() => new SetupService(config).run('rm -rf /')).toThrow();
  });

  it('every task has fixed commands', () => {
    const s = new SetupService(config);
    for (const t of SETUP_TASKS) expect(s.plan(t).length).toBeGreaterThan(0);
  });

  it('repoRoot finds parent of backend', () => {
    const root = mkdtempSync(join(tmpdir(), 'aura-'));
    mkdirSync(join(root, 'pc-agent'));
    mkdirSync(join(root, 'backend'));
    expect(repoRoot(join(root, 'backend'))).toBe(root);
    expect(repoRoot(root)).toBe(root);
  });
});

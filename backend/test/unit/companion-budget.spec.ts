import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { CompanionService } from '../../src/admin/companion.service';
import { BudgetService } from '../../src/stats/budget.service';
import { apiGenerate } from '../../src/ai/providers/api-providers';

describe('CompanionService Live2D', () => {
  let dir: string;
  let svc: CompanionService;
  const row = { companionVoice: null, companionPresets: null, companionModel: null as string | null };
  const prisma = {
    appSettings: {
      findUnique: jest.fn(async () => row),
      upsert: jest.fn(async (a: { update: { companionModel?: string | null } }) => {
        if ('companionModel' in a.update) row.companionModel = a.update.companionModel ?? null;
        return row;
      }),
    },
  };
  const settings = { companionPrompt: () => 'p' };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'l2d-'));
    process.env.LIVE2D_DIR = dir;
    row.companionModel = null;
    svc = new CompanionService(prisma as never, settings as never);
  });
  afterEach(() => {
    delete process.env.LIVE2D_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('zip 업로드 → 목록·파일 제공, 첫 모델 자동 선택', async () => {
    const zip = zipSync({ 'hiyori/hiyori.model3.json': strToU8('{}'), 'hiyori/tex/a.png': new Uint8Array([1, 2]) });
    const m = await svc.upload('', Buffer.from(zip).toString('base64'));
    expect(m.entry).toBe('hiyori/hiyori.model3.json');
    expect(m.name).toBe('hiyori');
    expect((await svc.models()).map((x) => x.id)).toEqual([m.id]);
    expect(row.companionModel).toBe(m.id);
    expect(svc.file(m.id, 'hiyori/tex/a.png')?.type).toBe('image/png');
    expect(svc.file(m.id, '../../etc/passwd')).toBeNull();
    expect(svc.file(m.id, 'aura-meta.json')).toBeNull();
  });

  it('model3.json 없으면 거부, 경로 탈출 거부', async () => {
    await expect(svc.upload('x', Buffer.from(zipSync({ 'a.model.json': strToU8('{}') })).toString('base64'))).rejects.toThrow(/Cubism 2/);
    await expect(svc.upload('x', Buffer.from(zipSync({ '../evil.model3.json': strToU8('{}') })).toString('base64'))).rejects.toThrow();
  });
});

describe('BudgetService', () => {
  const config = { get: () => 'Asia/Seoul' };
  const mk = (cost: number, cfg: { budgetUsd: number | null; budgetWarnPct: number; budgetBlock: boolean }) => {
    const prisma = { appSettings: { findUnique: jest.fn(async () => cfg), upsert: jest.fn() } };
    const now = new Date();
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(now).slice(0, 7);
    const stats = { apiUsage: jest.fn(async () => ({ month, total: { cost } })) };
    return new BudgetService(prisma as never, stats as never, config as never);
  };

  it('경고·초과 단계', async () => {
    const b = mk(8.5, { budgetUsd: 10, budgetWarnPct: 80, budgetBlock: false });
    await b.onModuleInit();
    expect(b.status()).toMatchObject({ level: 'warn', pct: 85 });
    b.onModuleDestroy();
  });

  it('차단 켜면 한도 넘을 때 API 호출 거부', async () => {
    const b = mk(12, { budgetUsd: 10, budgetWarnPct: 80, budgetBlock: true });
    await b.onModuleInit();
    expect(b.status().level).toBe('over');
    await expect(apiGenerate('openai', 'k', 'gpt-x', [{ role: 'user', content: 'hi' }], { timeoutMs: 1000 })).rejects.toThrow(/한도/);
    b.onModuleDestroy();
  });
});

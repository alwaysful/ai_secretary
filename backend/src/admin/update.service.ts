import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import { existsSync, openSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WIN = process.platform === 'win32';

/** 레포 루트 (백엔드 cwd = backend/) */
export function repoRoot(): string {
  const cwd = process.cwd();
  return existsSync(resolve(cwd, 'start-aura.bat')) ? cwd : resolve(cwd, '..');
}

interface RunResult {
  code: number;
  out: string;
}

function run(cmd: string, args: string[], cwd: string, timeoutMs = 60_000): Promise<RunResult> {
  return new Promise((done) => {
    execFile(cmd, args, { cwd, timeout: timeoutMs, shell: WIN, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (e, stdout, stderr) => {
      const code = e ? (typeof (e as { code?: unknown }).code === 'number' ? ((e as { code: number }).code) : 1) : 0;
      done({ code, out: `${stdout}${stderr}`.trim() });
    });
  });
}

export interface UpdateStatus {
  branch: string;
  commit: string;
  subject: string;
  behind: number;
  ahead: number;
  dirty: string[];
  incoming: string[];
  error?: string;
}

/** 관리자 전용: git pull + 의존성 설치 + 재시작 */
@Injectable()
export class UpdateService {
  private readonly log = new Logger(UpdateService.name);
  private busy = false;

  private git(args: string[], timeoutMs?: number) {
    return run('git', args, repoRoot(), timeoutMs);
  }

  /** 원격 확인 (git fetch) */
  async status(): Promise<UpdateStatus> {
    const f = await this.git(['fetch', '--quiet'], 60_000);
    const [br, head, dirty] = await Promise.all([
      this.git(['rev-parse', '--abbrev-ref', 'HEAD']),
      this.git(['log', '-1', '--format=%h%x09%s']),
      this.git(['status', '--porcelain', '--untracked-files=no']),
    ]);
    const counts = await this.git(['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
    const [ahead, behind] = counts.code === 0 ? counts.out.split(/\s+/).map(Number) : [0, 0];
    const inc = behind ? await this.git(['log', '--format=%h %s', '-20', 'HEAD..@{u}']) : { code: 0, out: '' };
    const [commit, subject] = head.out.split('\t');
    return {
      branch: br.out,
      commit: commit ?? '',
      subject: subject ?? '',
      behind: behind || 0,
      ahead: ahead || 0,
      dirty: dirty.out ? dirty.out.split('\n').map((l) => l.trim()) : [],
      incoming: inc.out ? inc.out.split('\n') : [],
      ...(f.code !== 0 ? { error: `git fetch 실패: ${f.out.split('\n')[0]}` } : counts.code !== 0 ? { error: '추적 브랜치 없음' } : {}),
    };
  }

  /** git pull --ff-only. package.json 바뀌면 npm install */
  async pull(): Promise<{ ok: boolean; log: string; changed: string[]; installed: string[]; restartNeeded: boolean }> {
    if (this.busy) throw new ConflictException({ code: 'BUSY', message: '업데이트 진행 중' });
    this.busy = true;
    const lines: string[] = [];
    try {
      const before = (await this.git(['rev-parse', 'HEAD'])).out;
      const p = await this.git(['pull', '--ff-only'], 180_000);
      lines.push(`$ git pull --ff-only\n${p.out}`);
      if (p.code !== 0) return { ok: false, log: lines.join('\n\n'), changed: [], installed: [], restartNeeded: false };
      const after = (await this.git(['rev-parse', 'HEAD'])).out;
      if (before === after) return { ok: true, log: lines.join('\n\n'), changed: [], installed: [], restartNeeded: false };
      const diff = await this.git(['diff', '--name-only', before, after]);
      const changed = diff.out ? diff.out.split('\n') : [];
      const installed: string[] = [];
      for (const dir of ['', 'backend', 'frontend']) {
        const pre = dir ? `${dir}/` : '';
        if (!changed.some((f) => f === `${pre}package.json` || f === `${pre}package-lock.json`)) continue;
        const r = await run(WIN ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], resolve(repoRoot(), dir), 600_000);
        lines.push(`$ npm install (${dir || '루트'})\n${r.out.split('\n').slice(-8).join('\n')}`);
        installed.push(dir || '.');
        if (r.code !== 0) return { ok: false, log: lines.join('\n\n'), changed, installed, restartNeeded: true };
      }
      this.log.log(`업데이트 ${before.slice(0, 7)} → ${after.slice(0, 7)} (${changed.length}개 파일)`);
      // nest watch가 백엔드 자동 재시작하지만 의존성·마이그레이션·프런트 설정은 재시작 필요
      const restartNeeded = installed.length > 0 || changed.some((f) => /prisma\/|vite\.config|scripts\/|start-aura|\.env\.example/.test(f));
      return { ok: true, log: lines.join('\n\n'), changed, installed, restartNeeded };
    } finally {
      this.busy = false;
    }
  }

  /**
   * 재시작: 새 창에서 start-aura 다시 실행 예약 → 현재 서버 트리 종료.
   * Windows: scripts/restart-aura.bat (5초 대기 후 새 창). 그 외: npm start 백그라운드.
   */
  restart(stop: () => void): { ok: true; platform: string } {
    const root = repoRoot();
    // 기존 start-aura.bat 창이 pause 없이 닫히도록 표시
    writeFileSync(resolve(root, '.aura-restart'), String(Date.now()));
    if (WIN) {
      // start 로 띄워야 taskkill /T 트리에서 빠짐
      const c = spawn('cmd.exe', ['/c', 'start', '""', '/min', 'cmd', '/c', 'scripts\\restart-aura.bat'], {
        cwd: root,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        windowsVerbatimArguments: true,
      });
      c.unref();
    } else {
      const out = openSync(resolve(root, 'aura-restart.log'), 'a');
      const c = spawn('sh', ['-c', 'sleep 5; rm -f .aura-restart; npm start'], { cwd: root, detached: true, stdio: ['ignore', out, out] });
      c.unref();
    }
    this.log.warn('관리자 요청: 재시작');
    setTimeout(stop, 1200);
    return { ok: true, platform: process.platform };
  }
}

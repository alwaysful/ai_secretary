import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EnvVars } from '../config/env';
import { upsertEnv } from '../common/env-file';

/** 시작 가이드 「진행」으로 실행 가능한 작업. 고정 명령만 (사용자 입력 없음) */
export const SETUP_TASKS = ['db', 'ollama', 'pip', 'mediapipe'] as const;
export type SetupTask = (typeof SETUP_TASKS)[number];

export interface SetupJob {
  task: SetupTask;
  status: 'running' | 'done' | 'error';
  log: string;
  startedAt: string;
  endedAt: string | null;
}

interface Cmd {
  cmd: string;
  cwd: string;
  /** 끝을 기다리지 않음 (상주 프로세스) */
  detach?: boolean;
}

const LOG_MAX = 6000;

/** 저장소 루트: backend 폴더에서 실행되므로 상위. 못 찾으면 cwd */
export function repoRoot(cwd = process.cwd()): string {
  for (const dir of [cwd, resolve(cwd, '..')]) {
    if (existsSync(join(dir, 'pc-agent')) && existsSync(join(dir, 'backend'))) return dir;
  }
  return cwd;
}

@Injectable()
export class SetupService {
  private readonly log = new Logger(SetupService.name);
  private readonly jobs = new Map<SetupTask, SetupJob>();
  private readonly root = repoRoot();

  constructor(private readonly config: ConfigService<EnvVars, true>) {}

  private get python(): string {
    return this.config.get('PC_PYTHON', { infer: true }) || (process.platform === 'win32' ? 'python' : 'python3');
  }

  /** 작업별 명령. 경로·명령 모두 고정 */
  plan(task: SetupTask): Cmd[] {
    const backend = join(this.root, 'backend');
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    switch (task) {
      case 'db':
        return [
          { cmd: 'docker compose -f backend/docker-compose.yml up -d', cwd: this.root },
          { cmd: `${npx} prisma migrate deploy`, cwd: backend },
        ];
      case 'ollama':
        return [{ cmd: 'ollama serve', cwd: this.root, detach: true }];
      case 'pip': {
        // Python 없으면 Windows는 winget으로 설치 후 설치 경로 python 직접 사용 (PATH 갱신 전)
        let py = this.python;
        const pre: Cmd[] = [];
        if (!this.hasPython(py)) {
          if (process.platform !== 'win32') throw new BadRequestException({ code: 'NO_PYTHON', message: 'Python 없음. python3 먼저 설치' });
          pre.push({ cmd: 'winget install -e --id Python.Python.3.12 --scope user --silent --accept-package-agreements --accept-source-agreements', cwd: this.root });
          py = '"%LOCALAPPDATA%\\Programs\\Python\\Python312\\python.exe"';
        }
        return [
          ...pre,
          { cmd: `${py} -m pip install -r pc-agent/requirements-stt.txt`, cwd: this.root },
          { cmd: `${py} -m pip install -r pc-agent/requirements.txt`, cwd: this.root },
          { cmd: `${py} -m pip install -r pc-agent/requirements-tts.txt`, cwd: this.root },
        ];
      }
      case 'mediapipe':
        return [{ cmd: 'node scripts/download-models.mjs', cwd: this.root }];
    }
  }

  private hasPython(py: string): boolean {
    try {
      return spawnSync(py, ['--version'], { shell: true, windowsHide: true, timeout: 10_000 }).status === 0;
    } catch {
      return false;
    }
  }

  /**
   * Outlook 연동 설정: MS_CLIENT_ID 저장 + TOKEN_ENC_KEY 없으면 생성.
   * 기존 .aura-secret 있으면 그 값 재사용 (저장된 API 키 복호화 유지)
   */
  saveOutlook(clientId: string): { ok: true } {
    const id = clientId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException({ code: 'BAD_CLIENT_ID', message: '클라이언트 ID 형식 아님 (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)' });
    }
    const vals: Record<string, string> = { MS_CLIENT_ID: id };
    if (!this.config.get('TOKEN_ENC_KEY', { infer: true })) {
      const f = join(this.root, 'backend', '.aura-secret');
      const old = existsSync(f) ? readFileSync(f, 'utf8').trim() : '';
      vals.TOKEN_ENC_KEY = /^[0-9a-fA-F]{64}$/.test(old) ? old : randomBytes(32).toString('hex');
    }
    upsertEnv(vals, join(this.root, 'backend', '.env'));
    this.log.log('Outlook 설정 저장 (.env)');
    return { ok: true };
  }

  list(): SetupJob[] {
    return [...this.jobs.values()];
  }

  run(task: string): SetupJob {
    if (!(SETUP_TASKS as readonly string[]).includes(task)) {
      throw new BadRequestException({ code: 'UNKNOWN_TASK', message: `알 수 없는 작업: ${task}` });
    }
    const t = task as SetupTask;
    if (this.jobs.get(t)?.status === 'running') throw new ConflictException({ code: 'RUNNING', message: '이미 실행 중' });
    const cmds = this.plan(t);
    const job: SetupJob = { task: t, status: 'running', log: '', startedAt: new Date().toISOString(), endedAt: null };
    this.jobs.set(t, job);
    void this.exec(job, cmds);
    return job;
  }

  private append(job: SetupJob, text: string) {
    job.log = (job.log + text).slice(-LOG_MAX);
  }

  private async exec(job: SetupJob, cmds: Cmd[]) {
    try {
      for (const c of cmds) {
        this.append(job, `> ${c.cmd}\n`);
        await this.spawnOne(job, c);
      }
      job.status = 'done';
      this.append(job, '완료\n');
    } catch (e) {
      job.status = 'error';
      this.append(job, `실패: ${e instanceof Error ? e.message : String(e)}\n`);
      this.log.warn(`setup ${job.task} failed`);
    } finally {
      job.endedAt = new Date().toISOString();
    }
  }

  private spawnOne(job: SetupJob, c: Cmd): Promise<void> {
    return new Promise((ok, fail) => {
      // 고정 문자열만 전달하므로 shell 사용 (Windows .cmd 실행용)
      const p = spawn(c.cmd, {
        cwd: c.cwd,
        shell: true,
        windowsHide: true,
        detached: !!c.detach,
        stdio: c.detach ? 'ignore' : 'pipe',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      p.on('error', (e) => fail(e));
      if (c.detach) {
        p.unref();
        this.append(job, '백그라운드로 시작함\n');
        setTimeout(ok, 3000);
        return;
      }
      p.stdout?.on('data', (d: Buffer) => this.append(job, d.toString()));
      p.stderr?.on('data', (d: Buffer) => this.append(job, d.toString()));
      p.on('close', (code) => (code === 0 ? ok() : fail(new Error(`종료 코드 ${code}`))));
    });
  }
}

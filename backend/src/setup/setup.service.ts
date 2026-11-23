import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EnvVars } from '../config/env';

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
      case 'pip':
        return [
          { cmd: `${this.python} -m pip install -r pc-agent/requirements-stt.txt`, cwd: this.root },
          { cmd: `${this.python} -m pip install -r pc-agent/requirements.txt`, cwd: this.root },
        ];
      case 'mediapipe':
        return [{ cmd: 'node scripts/download-models.mjs', cwd: this.root }];
    }
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
    const job: SetupJob = { task: t, status: 'running', log: '', startedAt: new Date().toISOString(), endedAt: null };
    this.jobs.set(t, job);
    void this.exec(job, this.plan(t));
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

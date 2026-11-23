import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface Shot {
  image: string;
  width: number;
  height: number;
  scale: number;
}

type Pending = { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

/** Python 사이드카(pc-agent/agent.py). stdin/stdout JSON 줄 통신. */
export class PcAgentProcess {
  private proc?: ChildProcessWithoutNullStreams;
  private seq = 0;
  private readonly pending = new Map<number, Pending>();
  private stderr = '';

  constructor(
    private readonly python: string,
    private readonly script: string,
    private readonly onEvent: (ev: { event: string; reason?: string }) => void,
  ) {}

  async start(timeoutMs = 15_000): Promise<void> {
    const proc = spawn(this.python, ['-u', this.script], { stdio: 'pipe', windowsHide: true });
    this.proc = proc;
    proc.stderr.on('data', (d: Buffer) => (this.stderr = (this.stderr + d.toString()).slice(-2000)));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`사이드카 시작 시간 초과. ${this.stderr}`)), timeoutMs);
      proc.once('error', (e) => {
        clearTimeout(timer);
        reject(new Error(`Python 실행 실패 (${this.python}): ${e.message}`));
      });
      proc.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`사이드카 종료 (${code}). ${this.stderr.trim().slice(-500)}`));
      });
      createInterface({ input: proc.stdout }).on('line', (line) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(line) as Record<string, unknown>;
        } catch {
          return;
        }
        if (msg.event === 'ready') {
          clearTimeout(timer);
          resolve();
        } else if (typeof msg.event === 'string') {
          this.onEvent(msg as { event: string; reason?: string });
        } else if (typeof msg.id === 'number') {
          const p = this.pending.get(msg.id);
          if (!p) return;
          this.pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.ok) p.resolve(msg);
          else p.reject(new Error(String(msg.error ?? 'error')));
        }
      });
    });
    proc.on('exit', () => {
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('사이드카 종료됨'));
      }
      this.pending.clear();
      this.proc = undefined;
    });
  }

  send(cmd: string, extra: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<Record<string, unknown>> {
    const proc = this.proc;
    if (!proc) return Promise.reject(new Error('사이드카 꺼짐'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${cmd} 시간 초과`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      proc.stdin.write(JSON.stringify({ id, cmd, ...extra }) + '\n');
    });
  }

  async screenshot(): Promise<Shot> {
    return (await this.send('screenshot')) as unknown as Shot;
  }

  stop(): void {
    const proc = this.proc;
    if (!proc) return;
    this.send('quit', {}, 2000).catch(() => undefined);
    setTimeout(() => proc.kill(), 1500).unref();
  }
}

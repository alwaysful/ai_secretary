import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** backend/.env (백엔드 cwd = backend/) */
export function envFilePath(): string {
  const cwd = process.cwd();
  return existsSync(resolve(cwd, 'prisma')) ? resolve(cwd, '.env') : resolve(cwd, 'backend', '.env');
}

/** .env 키 추가·교체. 다른 줄·주석 유지 */
export function upsertEnv(values: Record<string, string>, file = envFilePath()): void {
  for (const [k, v] of Object.entries(values)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(k) || /[\r\n]/.test(v)) throw new Error(`잘못된 env 값: ${k}`);
  }
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const left = new Map(Object.entries(values));
  const out = lines.map((l) => {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=/.exec(l);
    if (m && left.has(m[1])) {
      const v = left.get(m[1])!;
      left.delete(m[1]);
      return `${m[1]}=${v}`;
    }
    return l;
  });
  while (out.length && out[out.length - 1] === '') out.pop();
  for (const [k, v] of left) out.push(`${k}=${v}`);
  writeFileSync(file, `${out.join('\n')}\n`);
  for (const [k, v] of Object.entries(values)) process.env[k] = v;
}

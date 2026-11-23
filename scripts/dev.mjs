// npm run dev 래퍼. 자기 PID를 AURA_DEV_PID로 넘김 → 로비 "서버 끄기"가 백엔드·프론트 전체 트리 종료.
import { spawn } from 'node:child_process';

const cmd =
  'concurrently -k -n api,web -c cyan,magenta "npm run start:dev --prefix backend" "npm run dev --prefix frontend"';
const child = spawn(cmd, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, AURA_DEV_PID: String(process.pid) },
  // Unix: 별도 프로세스 그룹 → 그룹 전체 종료. Windows는 백엔드가 taskkill /T 사용
  detached: process.platform !== 'win32',
});
const stop = (sig) => {
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, sig);
    else child.kill(sig);
  } catch {
    /* 이미 종료 */
  }
};
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stop(sig);
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
child.on('exit', (code) => process.exit(code ?? 0));

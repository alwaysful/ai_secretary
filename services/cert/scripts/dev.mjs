// 자격증 서비스 실행: 설치·.env·DB 준비 → 마이그레이션 → 개발 서버 (start-cert.bat 이 부름)
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const step = (cmd, args, what) => {
  console.log(`> ${cmd} ${args.join(' ')}  (${what})`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\n[자격증] ${what} 실패. DB(Docker) 실행 여부와 위 오류 확인.`);
    process.exit(1);
  }
};

// 이미 떠 있으면 (start-aura.bat 가 먼저 켬 등) 다시 안 켬 → Prisma 엔진 파일 잠김(EPERM) 방지
const port = process.env.CERT_PORT ?? 3100;
try {
  const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
  if (r.ok) {
    console.log(`[자격증] 이미 실행 중: http://127.0.0.1:${port}`);
    process.exit(0);
  }
} catch {
  /* 안 떠 있음 */
}

if (!existsSync(`${root}/node_modules`)) step('npm', ['install'], '설치');
if (!existsSync(`${root}/web/node_modules`)) step('npm', ['install', '--prefix', 'web'], '화면 설치');
if (!existsSync(`${root}/.env`)) copyFileSync(`${root}/.env.example`, `${root}/.env`);
step('node', ['scripts/ensure-db.mjs'], 'DB 준비');
step('npx', ['prisma', 'migrate', 'deploy'], '마이그레이션');
// 엔진 파일을 다른 프로세스가 잡고 있으면 실패 → 이미 만든 클라이언트 있으면 그대로 진행
{
  const r = spawnSync('npx', ['prisma', 'generate'], { cwd: root, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    if (!existsSync(`${root}/node_modules/.prisma/client/index.js`)) {
      console.error('\n[자격증] Prisma 클라이언트 생성 실패.');
      process.exit(1);
    }
    console.warn('[자격증] Prisma 클라이언트 재생성 건너뜀 (파일 사용 중). 기존 클라이언트로 실행');
  }
}

const prod = process.argv.includes('--prod');
// 화면은 항상 빌드본 사용 (개발 중 화면 수정은 web 폴더에서 npm run dev)
step('npm', ['run', 'build', '--prefix', 'web'], '화면 빌드');
if (prod) step('npx', ['nest', 'build'], '서버 빌드');
const child = spawn('npm', ['run', prod ? 'start:prod' : 'start:dev'], { cwd: root, stdio: 'inherit', shell: true });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));

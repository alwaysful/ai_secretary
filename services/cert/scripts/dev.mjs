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

if (!existsSync(`${root}/node_modules`)) step('npm', ['install'], '설치');
if (!existsSync(`${root}/.env`)) copyFileSync(`${root}/.env.example`, `${root}/.env`);
step('node', ['scripts/ensure-db.mjs'], 'DB 준비');
step('npx', ['prisma', 'migrate', 'deploy'], '마이그레이션');
step('npx', ['prisma', 'generate'], 'Prisma 클라이언트');

const prod = process.argv.includes('--prod');
if (prod) step('npm', ['run', 'build'], '빌드');
const child = spawn('npm', ['run', prod ? 'start:prod' : 'start:dev'], { cwd: root, stdio: 'inherit', shell: true });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));

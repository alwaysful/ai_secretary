// CERT_DATABASE_URL 의 데이터베이스가 없으면 만듦 (prisma migrate deploy 전에 실행)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (!process.env.CERT_DATABASE_URL && existsSync(envPath)) {
  const m = /^CERT_DATABASE_URL=(.+)$/m.exec(readFileSync(envPath, 'utf8'));
  if (m) process.env.CERT_DATABASE_URL = m[1].trim();
}
const url = new URL(process.env.CERT_DATABASE_URL ?? 'postgresql://cert:cert@127.0.0.1:5433/aura_cert');
const name = decodeURIComponent(url.pathname.slice(1));
if (!/^[A-Za-z0-9_]+$/.test(name)) {
  console.error(`[cert] DB 이름 오류: ${name}`);
  process.exit(1);
}
url.pathname = '/postgres';
url.search = '';
const c = new pg.Client({ connectionString: url.toString() });
try {
  await c.connect();
  const r = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!r.rowCount) {
    await c.query(`CREATE DATABASE "${name}"`);
    console.log(`[cert] DB ${name} 생성`);
  }
} catch (e) {
  console.error(`[cert] DB 준비 실패: ${e.message}`);
  process.exit(1);
} finally {
  await c.end().catch(() => {});
}

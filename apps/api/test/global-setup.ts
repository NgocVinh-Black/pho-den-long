import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const apiDir = fileURLToPath(new URL('..', import.meta.url));
const testDb = fileURLToPath(new URL('../prisma/test.db', import.meta.url));

// Tạo CSDL test sạch trước khi chạy, xóa sau khi xong.
export function setup() {
  rmSync(testDb, { force: true });
  execSync('npx prisma db push --skip-generate', {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  });
}

export function teardown() {
  rmSync(testDb, { force: true });
  rmSync(`${testDb}-journal`, { force: true });
}

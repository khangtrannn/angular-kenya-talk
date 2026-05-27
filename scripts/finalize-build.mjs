import { copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BROWSER_DIR = join(__dirname, '..', 'dist', 'angular-kenya-talk', 'browser');
const SRC = join(BROWSER_DIR, 'introduction', 'index.html');
const DEST = join(BROWSER_DIR, 'index.html');

async function main() {
  if (!existsSync(SRC)) {
    console.error(`[finalize-build] missing prerendered source: ${SRC}`);
    process.exit(1);
  }
  await copyFile(SRC, DEST);
  console.log('[finalize-build] root / now serves prerendered introduction (with OG tags)');
}

main().catch((err) => {
  console.error('[finalize-build] failed:', err);
  process.exit(1);
});

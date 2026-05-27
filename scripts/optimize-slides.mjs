import { mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SRC_DIR = join(__dirname, '..', 'public', 'slides');
const OUT_DIR = join(SRC_DIR, 'webp');
const QUALITY = 85;

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`[optimize-slides] source dir missing: ${SRC_DIR}`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const entries = await readdir(SRC_DIR);
  const pngs = entries.filter((f) => f.toLowerCase().endsWith('.png'));

  let written = 0;
  let skipped = 0;

  await Promise.all(
    pngs.map(async (file) => {
      const src = join(SRC_DIR, file);
      const out = join(OUT_DIR, `${parse(file).name}.webp`);

      if (existsSync(out)) {
        const [srcStat, outStat] = await Promise.all([stat(src), stat(out)]);
        if (outStat.mtimeMs >= srcStat.mtimeMs) {
          skipped++;
          return;
        }
      }

      await sharp(src).webp({ quality: QUALITY }).toFile(out);
      written++;
    }),
  );

  console.log(
    `[optimize-slides] ${pngs.length} png → webp (wrote ${written}, skipped ${skipped} already up-to-date) at q${QUALITY}`,
  );
}

main().catch((err) => {
  console.error('[optimize-slides] failed:', err);
  process.exit(1);
});

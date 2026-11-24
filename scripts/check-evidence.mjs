// Confirms that every evidence excerpt on /how-this-site-works still matches the real file.
// Run: npm run check:evidence   (fails with a list if any line has drifted)
import { readFileSync } from 'node:fs';
import { built } from '../src/data/platform-status.ts';

let missing = 0;
for (const piece of built) {
  for (const { file, lines } of piece.evidence ?? []) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const line of lines) {
      if (line === '…') continue;
      if (!text.includes(line.trim())) {
        console.error(`✗ "${piece.name}": not found in ${file}: ${line.trim()}`);
        missing++;
      }
    }
  }
}
if (missing) { console.error(`\n${missing} evidence line(s) no longer match their file.`); process.exit(1); }
console.log('✓ every evidence excerpt matches its file');

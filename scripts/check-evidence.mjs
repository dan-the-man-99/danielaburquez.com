// Confirms that every evidence excerpt on /how-this-site-works still matches the real file.
// Run: npm run check:evidence   (fails with a list if any line has drifted)
import { readFileSync } from 'node:fs';
import { built } from '../src/data/platform-status.ts';
import { pieceArt, MAX_COLS } from '../src/data/piece-art.ts';

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
// Every built piece needs side art, and the art must fit the column.
for (const piece of built) {
  const art = pieceArt[piece.name];
  if (!art) { console.error(`✗ "${piece.name}": no entry in src/data/piece-art.ts`); missing++; continue; }
  const wide = art.find((l) => l.length > MAX_COLS || /[^\x20-\x7e]/.test(l));
  if (wide !== undefined) { console.error(`✗ "${piece.name}": art line too wide or not ASCII: ${wide}`); missing++; }
}
if (missing) { console.error(`\n${missing} evidence line(s) no longer match their file.`); process.exit(1); }
console.log('✓ every evidence excerpt matches its file, and every built piece has fitting art');

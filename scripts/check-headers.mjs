// Confirms public/_headers (Cloudflare Pages) sends the same security headers as
// security-headers.conf (nginx). Run: npm run check:headers
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const nginx = new Map(
  [...read('security-headers.conf').matchAll(/^add_header (\S+) "(.*)" always;$/gm)].map(([, name, value]) => [name, value]),
);

// Only the first block (`/*`) holds the security headers.
const pagesBlock = read('public/_headers').split(/\n\s*\n/).find((b) => /^\/\*$/m.test(b)) ?? '';
const pages = new Map(
  [...pagesBlock.matchAll(/^ {2}(\S+): (.*)$/gm)].map(([, name, value]) => [name, value]),
);

let problems = 0;
for (const [name, value] of nginx) {
  if (pages.get(name) !== value) { console.error(`✗ ${name}: nginx and _headers differ or _headers lacks it`); problems++; }
}
for (const name of pages.keys()) {
  if (!nginx.has(name)) { console.error(`✗ ${name}: in _headers but not in security-headers.conf`); problems++; }
}
if (problems || nginx.size === 0) { console.error(`\n${problems || 'No'} header problem(s).`); process.exit(1); }
console.log(`✓ _headers matches security-headers.conf (${nginx.size} headers)`);

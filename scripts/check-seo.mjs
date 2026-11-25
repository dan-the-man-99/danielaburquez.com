// Checks the BUILT site (dist/) for what search engines and AI assistants read:
// title, description, canonical, social tags, valid JSON-LD, robots.txt, sitemap,
// llms.txt. Run after `npm run build`: npm run check:seo
import { readFileSync, existsSync } from 'node:fs';

const dist = (p) => new URL(`../dist/${p}`, import.meta.url);
const read = (p) => readFileSync(dist(p), 'utf8');
const origin = 'https://danielaburquez.com';
let problems = 0;
const fail = (msg) => { console.error(`✗ ${msg}`); problems++; };

const pages = { 'index.html': '/', 'how-this-site-works/index.html': '/how-this-site-works' };
for (const [file, path] of Object.entries(pages)) {
  if (!existsSync(dist(file))) { fail(`${file} missing: run npm run build first`); continue; }
  const html = read(file);
  const tag = (re) => html.match(re)?.[1];
  const title = tag(/<title>([^<]*)<\/title>/);
  const desc = tag(/<meta name="description" content="([^"]*)"/);
  if (!title || title.length > 70) fail(`${file}: title missing or over 70 characters`);
  if (!desc || desc.length < 50 || desc.length > 170) fail(`${file}: description missing or not 50-170 characters`);
  if (tag(/<link rel="canonical" href="([^"]*)"/) !== origin + path) fail(`${file}: canonical should be ${origin + path}`);
  for (const p of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (!html.includes(`<meta property="${p}"`)) fail(`${file}: missing ${p}`);
  }
  if (!html.includes('name="twitter:card"')) fail(`${file}: missing twitter:card`);
  if ((html.match(/<h1[\s>]/g) ?? []).length !== 1) fail(`${file}: needs exactly one <h1>`);
  const ld = tag(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ld) fail(`${file}: no JSON-LD`);
  else { try { JSON.parse(ld); } catch { fail(`${file}: JSON-LD is not valid JSON`); } }
  for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
    if (!/\balt="/.test(img)) fail(`${file}: an <img> has no alt text`);
  }
}

if (existsSync(dist('og.png'))) {
  const png = readFileSync(dist('og.png'));
  if (png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) fail('og.png should be 1200x630');
} else fail('og.png missing');

const robots = existsSync(dist('robots.txt')) ? read('robots.txt') : '';
if (!/^Sitemap: https:\/\/danielaburquez\.com\/sitemap\.xml$/m.test(robots)) fail('robots.txt lacks the Sitemap line');
if (/^Disallow: \/\s*$/m.test(robots)) fail('robots.txt blocks the whole site');
const sitemap = existsSync(dist('sitemap.xml')) ? read('sitemap.xml') : '';
for (const path of Object.values(pages)) {
  if (!sitemap.includes(`<loc>${origin}${path}</loc>`)) fail(`sitemap.xml lacks ${path}`);
}
if (!existsSync(dist('llms.txt')) || !read('llms.txt').startsWith('# ')) fail('llms.txt missing or not Markdown');

if (problems) { console.error(`\n${problems} SEO problem(s).`); process.exit(1); }
console.log('✓ SEO checks passed (meta, canonical, social, JSON-LD, robots, sitemap, llms.txt)');

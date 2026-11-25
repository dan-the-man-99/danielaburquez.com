// Built into dist/sitemap.xml. One entry per page file, so a new page is listed
// automatically. No <lastmod>: a wrong date is worse than none.
import type { APIRoute } from 'astro';

const origin = 'https://danielaburquez.com';

export const GET: APIRoute = () => {
  const files = Object.keys(import.meta.glob('./**/*.astro'));
  const paths = files
    .map((f) => f.replace(/^\.\//, '').replace(/\.astro$/, '').replace(/(^|\/)index$/, ''))
    .map((p) => (p ? `/${p}` : '/'))
    .sort();
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};

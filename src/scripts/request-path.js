// /how-this-site-works: the request path drawn in plain ASCII, looping through the
// failover that was tested on the test address:
//   1. a request goes visitor -> Worker -> home server and the page comes back;
//   2. the home server stops;
//   3. the Worker waits two seconds, gives up on home and asks Pages instead;
//   4. home comes back.
// Two layouts of the same drawing: a wide one (visitor, Worker and the two hosts left to
// right) for tablets and up, and a tall one (top to bottom) for phones, picked by screen
// width and switched live if the window changes. Pure decoration (aria-hidden; the page
// carries the same explanation as text). ASCII only, so every character has the same width
// in any monospace font. Paused while off screen, and drawn once as a still frame for
// visitors who prefer reduced motion. No library.

// Routes are straight-line paths as [x, y] corners; a packet's place on one is a distance
// in cells. `junction` is where the home and Pages routes split, `stop` is where a request
// waits for a home server that does not answer.
const WIDE = {
  W: 76, H: 16, statusY: 15,
  VW: [[13, 6], [21, 6]],
  WH: [[41, 6], [47, 6], [47, 1], [53, 1]],
  WP: [[41, 6], [47, 6], [47, 12], [53, 12]],
  arrows: [[21, 6, '>'], [53, 1, '>'], [53, 12, '>']],
  visitor: { box: [0, 5, 13, 4], lines: ['Visitor', '(browser)'] },
  worker: { box: [22, 5, 19, 4], lines: ['Cloudflare edge', 'failover Worker'] },
  home: { box: [54, 0, 22, 4], up: ['Home server', 'container + tunnel'], down: ['Home server', '[ stopped ]'] },
  pages: { box: [54, 11, 22, 4], lines: ['Cloudflare Pages', 'static copy'] },
  legend: [0, 12], note: [49, 4], junction: 6, stop: 10,
};
const TALL = {
  W: 36, H: 24, statusY: 22,
  VW: [[17, 4], [17, 6]],
  WH: [[17, 11], [17, 12], [7, 12], [7, 14]],
  WP: [[17, 11], [17, 12], [28, 12], [28, 14]],
  arrows: [[17, 6, 'v'], [7, 14, 'v'], [28, 14, 'v']],
  visitor: { box: [8, 0, 20, 4], lines: ['Visitor', '(browser)'] },
  worker: { box: [8, 7, 20, 4], lines: ['Cloudflare edge', 'failover Worker'] },
  home: { box: [0, 15, 16, 4], up: ['Home server', '(container)'], down: ['Home server', '[ stopped ]'] },
  pages: { box: [20, 15, 16, 4], lines: ['Pages', 'static copy'] },
  legend: [0, 20], note: [9, 13], junction: 1, stop: 11,
};

const pre = document.querySelector('[data-request-path]');
if (pre) start(pre);

function start(pre) {
  const narrow = matchMedia('(max-width: 47.99rem)');
  let L = narrow.matches ? TALL : WIDE;

  const length = (poly) => poly.slice(1).reduce((n, p, i) => n + Math.abs(p[0] - poly[i][0]) + Math.abs(p[1] - poly[i][1]), 0);
  function at(poly, dist) {
    let d = dist;
    for (let i = 1; i < poly.length; i++) {
      const [x0, y0] = poly[i - 1], [x1, y1] = poly[i];
      const seg = Math.abs(x1 - x0) + Math.abs(y1 - y0);
      if (d <= seg || i === poly.length - 1) {
        const u = seg ? Math.min(Math.max(d / seg, 0), 1) : 0;
        return [Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u)];
      }
      d -= seg;
    }
    return poly[0];
  }

  // The story, in seconds. `o` is a request, `@` the page coming back, `?` a request
  // that is waiting for an answer that does not come. Distances come from the layout.
  const steps = () => {
    const { VW, WH, WP, junction: j, stop } = L;
    const vw = length(VW), wh = length(WH), wp = length(WP);
    return [
      { t: 0.0, d: 0.8, poly: VW, a: 0, b: vw, g: 'o' },
      { t: 0.8, d: 1.2, poly: WH, a: 0, b: wh, g: 'o' },
      { t: 2.0, d: 1.2, poly: WH, a: wh, b: 0, g: '@' },
      { t: 3.2, d: 0.8, poly: VW, a: vw, b: 0, g: '@' },
      // 5.2: the home server stops
      { t: 6.2, d: 0.8, poly: VW, a: 0, b: vw, g: 'o' },
      { t: 7.0, d: 0.9, poly: WH, a: 0, b: stop, g: 'o' },
      { t: 7.9, d: 1.5, poly: WH, a: stop, b: stop, g: '?' },     // waits, then gives up
      { t: 9.4, d: 0.5, poly: WH, a: stop, b: j, g: 'o' },
      { t: 9.9, d: 1.1, poly: WP, a: j, b: wp, g: 'o' },
      { t: 11.0, d: 1.6, poly: WP, a: wp, b: 0, g: '@' },
      { t: 12.6, d: 0.8, poly: VW, a: vw, b: 0, g: '@' },
      // 15.4: the home server is back
    ];
  };
  const LOOP = 16.5;
  const HOME_DOWN = [5.2, 15.4];
  const STATUS = [                                            // [from, text]
    [0, 'GET /'],
    [4.0, 'x-served-by: home'],
    [5.2, 'home server stops (container, then tunnel)'],
    [6.2, 'GET /'],
    [9.4, 'no answer in 2 s: ask Pages instead'],
    [11.0, 'Pages answers'],
    [13.4, 'x-served-by: pages'],
    [15.4, 'home server is back'],
  ];

  const put = (g, x, y, s) => { for (let i = 0; i < s.length; i++) if (x + i >= 0 && x + i < L.W && y >= 0 && y < L.H) g[y][x + i] = s[i]; };
  const line = (g, poly) => {
    for (let i = 1; i < poly.length; i++) {
      const [x0, y0] = poly[i - 1], [x1, y1] = poly[i];
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) put(g, x, y, x0 === x1 ? '|' : '-');
    }
    poly.forEach(([x, y], i) => { if (i > 0 && i < poly.length - 1) put(g, x, y, '+'); });
  };
  function box(g, [x, y, w, h], lines, down = false) {
    const horiz = down ? '.' : '-', vert = down ? ':' : '|', corner = down ? '.' : '+';
    put(g, x, y, corner + horiz.repeat(w - 2) + corner);
    put(g, x, y + h - 1, corner + horiz.repeat(w - 2) + corner);
    for (let r = 1; r < h - 1; r++) put(g, x, y + r, vert + ' '.repeat(w - 2) + vert);
    lines.forEach((text, i) => put(g, x + 1 + Math.floor((w - 2 - text.length) / 2), y + 1 + i, text));
  }
  // The status line wraps to the drawing's width (the tall layout is narrow).
  function wrap(text, max) {
    const rows = [];
    let row = '';
    for (const word of text.split(' ')) {
      if ((row + ' ' + word).trim().length > max) { rows.push(row); row = word; } else row = (row + ' ' + word).trim();
    }
    if (row) rows.push(row);
    return rows;
  }

  function frame(t) {
    const g = Array.from({ length: L.H }, () => Array(L.W).fill(' '));
    const down = t >= HOME_DOWN[0] && t < HOME_DOWN[1];

    // routes, then boxes on top
    line(g, L.VW); line(g, L.WH); line(g, L.WP);
    L.arrows.forEach(([x, y, ch]) => put(g, x, y, ch));
    box(g, L.visitor.box, L.visitor.lines);
    box(g, L.worker.box, L.worker.lines);
    box(g, L.home.box, down ? L.home.down : L.home.up, down);
    box(g, L.pages.box, L.pages.lines);
    put(g, L.legend[0], L.legend[1], 'o  request');
    put(g, L.legend[0], L.legend[1] + 1, '@  page coming back');

    // the packet and, while it waits, what it is waiting for
    for (const s of steps()) {
      if (t < s.t || t >= s.t + s.d) continue;
      const dist = s.a + (s.b - s.a) * ((t - s.t) / s.d);
      const [x, y] = at(s.poly, Math.min(dist, length(s.poly)));
      put(g, x, y, s.g);
      if (s.g === '?') put(g, L.note[0], L.note[1], 'no answer yet');
    }

    const status = [...STATUS].reverse().find(([from]) => t >= from)[1];
    wrap(status, L.W - 2).forEach((row, i) => put(g, 0, L.statusY + i, (i === 0 ? '> ' : '  ') + row));
    return g.map((r) => r.join('').replace(/\s+$/, '')).join('\n');
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, visible = false, started = 0, lastDraw = 0, clock = 4.5;
  const draw = () => { pre.textContent = frame(clock); };

  // Crossing the phone breakpoint swaps the drawing, and the type size (see global.css) follows.
  narrow.addEventListener('change', () => { L = narrow.matches ? TALL : WIDE; pre.dataset.layout = narrow.matches ? 'tall' : 'wide'; draw(); });
  pre.dataset.layout = narrow.matches ? 'tall' : 'wide';

  // Reduced motion: one still frame, the normal case (home answered).
  draw();
  if (reduce) return;

  const tick = (now) => {
    raf = 0;
    if (!visible) return;
    if (!started) started = now;
    if (now - lastDraw > 40) { clock = ((now - started) / 1000) % LOOP; draw(); lastDraw = now; }
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(tick);
  }, { threshold: 0.25 }).observe(pre);
}

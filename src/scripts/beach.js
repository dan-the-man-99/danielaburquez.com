// The hero: an El Nido, Palawan beach drawn as fine ASCII art, at whatever time it is
// in Palawan right now, seen from a raised camera behind and to one side of Dan. He
// is reclined in a striped deck chair on the sand with a laptop on his lap, one hand
// typing and the other arm behind his head. Beyond him the sand runs down to a
// diagonal shoreline, waves curl, break and run up the sand leaving a wet shine, a
// bangka drifts across the bay, low karst islands sit on the horizon, and the sky
// shows sunrise, a high sun, sunset, or a moon and stars. A grove of palms on the left
// sways in the wind, their shadows swinging with the time of day.
//
// A brightness picture is computed for every character cell and each cell's
// brightness picks a character from a density ramp. Every so often (or when tapped)
// he scratches his head and a thought bubble shows one of the lines listed in
// Hero.astro. Moving the pointer over the water sends out ripples; over the sand it
// leaves footprints that the next wave washes away.
// Pure decoration: aria-hidden, paused while off screen, and a single still frame for
// visitors who prefer reduced motion. Written for this site; no library.
//
// Testing hook: add ?hour=6.5 (any 0-24 value) to the URL to see that time of day.

// Only on screens 48rem and wider: phones don't show the beach (see global.css). If a
// small window is widened later, the beach starts then.
const canvas = document.querySelector('canvas.beach');
if (canvas) {
  const wide = matchMedia('(min-width: 48rem)');
  if (wide.matches) start(canvas);
  else wide.addEventListener('change', (e) => { if (e.matches) start(canvas); }, { once: true });
}

// ---- cheap deterministic noise -------------------------------------------
function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {   // smooth value noise, 0..1
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Density ramp: space is paper, '@' is the heaviest ink.
const RAMP = ' .:-=+*#%@';

// Limestone karst islands, after a photo of El Nido's bay: right of the sun's path, a
// tall dome with a lower peak behind its left shoulder, a rounded island with a sheer
// cliff on its right, and low islands far off at the right edge. Each is
// [centre (fraction of width), left and right half-widths and height (fractions of the
// band's height), tone (0..1), base (how far below the horizon it meets the sea, as a
// fraction of the height; more = nearer), left and right slope shapes (higher = steeper
// cliff)]. Far ones first, so nearer ones draw over them.
const ISLANDS = [
  [0.575, 0.03, 0.03, 0.03, 0.25, 0, 2, 2], [0.75, 0.035, 0.03, 0.04, 0.28, 0, 2, 2.5],     // tiny, far out on the horizon
  [0.86, 0.04, 0.05, 0.035, 0.3, 0, 2, 2], [0.93, 0.05, 0.04, 0.045, 0.3, 0, 2, 2.5], [0.99, 0.05, 0.05, 0.04, 0.3, 0, 2, 2],
  [0.61, 0.08, 0.06, 0.15, 0.42, 0.005, 1.6, 2],      // the lower peak behind the dome's shoulder
  [0.68, 0.16, 0.11, 0.25, 0.6, 0.02, 1.8, 3.5],      // the tall dome
  [0.81, 0.1, 0.07, 0.13, 0.55, 0.015, 2.2, 4.5],     // the rounded island with a sheer right cliff
  [0.64, 0.07, 0.06, 0.1, 0.66, 0.05, 1.8, 3],        // nearer: a smaller island out in the water
  [0.93, 0.09, 0.08, 0.15, 0.68, 0.06, 2, 3.5],       // nearer still, behind the right-hand palms
];

// ---- Palawan time ------------------------------------------------------------
// The beach is in El Nido (11°10′50″N 119°23′22″E), UTC+8 with no daylight saving.
// At 11°N sunrise and sunset move by well under an hour across the year, so fixed
// times are close enough here.
const RISE = 5.9, SET = 17.9, TWILIGHT = 0.6;   // hours
const forcedHour = (() => {
  const v = parseFloat(new URLSearchParams(location.search).get('hour'));
  return Number.isFinite(v) ? ((v % 24) + 24) % 24 : NaN;
})();
function palawanHour() {
  if (!Number.isNaN(forcedHour)) return forcedHour;
  const d = new Date();
  return (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + 8) % 24;
}
// What is in the sky: the sun by day, the moon by night, with p = 0 at rise and 1 at set.
// `low` is 1 when the body is at the horizon (sunrise/sunset colour), `night` fades stars in.
function sky(H) {
  if (H >= RISE && H <= SET) {
    const p = (H - RISE) / (SET - RISE), elev = Math.sin(Math.PI * p);
    return { sun: true, p, elev, low: Math.max(0, 1 - elev / 0.35), night: 0 };
  }
  const p = ((H - SET + 24) % 24) / (24 - (SET - RISE)), elev = Math.sin(Math.PI * p);
  const sinceSet = (H - SET + 24) % 24, toRise = (RISE - H + 24) % 24;
  const night = Math.min(1, Math.min(sinceSet, toRise) / TWILIGHT);
  return { sun: false, p, elev, low: 1 - night, night };
}

async function start(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MONO = '"Martian Mono Variable", ui-monospace, Menlo, Consolas, monospace';
  let FS = 5;                         // character size in px
  const PRINT_LIFE = 18, RIPPLE_LIFE = 1.8;
  const WAVE = 7;                     // seconds between waves reaching the sand
  let scratchUntil = 0;               // he scratches his head until this time (s)

  try { await document.fonts.load(`500 ${FS}px ${MONO}`, ' .:-=+*#%@'); } catch { /* fall back to system mono */ }

  let w = 0, h = 0, dpr = 1, cw = 4, lh = 8, cols = 0, rows = 0;
  let hz = 0, sunR = 0, riseX = 0, setX = 0, shoreL = 0.6, shoreR = 0.42;
  let ox = 0, oy = 0;             // the chair's origin (the top of its front post)
  let S = sky(palawanHour()), bodyX = 0, bodyY = 0, bodyR = 0;
  let rock = new Float32Array(0), B = new Float32Array(0), O = new Uint8Array(0), FG = new Uint8Array(0), shoreCol = new Float32Array(0), restCol = new Float32Array(0);
  let ink = '#000';
  let raf = 0, last = 0, visible = true;
  const ripples = [], prints = [];    // pointer effects, in canvas px
  const ptr = { lastX: NaN, lastY: NaN, dist: 0, foot: 1 };

  const readColor = () => { ink = getComputedStyle(canvas).color; };

  // Each wave: `wavePhase` runs 0..1. From 0 to 0.5 the crest rolls in toward the
  // sand, at 0.5 it breaks, then the water runs up the sand fast and slides back slowly.
  const wavePhase = (x, t) => { const v = t / WAVE + Math.sin(x * 0.004) * 0.12; return v - Math.floor(v); };
  const runUp = (q) => (q < 0.18 ? Math.sin((q / 0.18) * Math.PI / 2) : Math.pow(1 - (q - 0.18) / 0.82, 1.6));
  // The resting waterline: a diagonal from lower left to upper right (the camera looks
  // along the beach), a gently wavy edge and a slow tide.
  const restAt = (x, t) => h * (shoreL + (shoreR - shoreL) * (x / w)) + Math.sin(x * 0.011 + t * 0.25) * h * 0.01 + Math.sin(x * 0.027 - t * 0.4) * h * 0.005 + Math.sin(t * 0.05) * h * 0.008;
  const RUN = 0.035;                  // how far up the sand a wave runs, as a fraction of the height
  // The foam line right now: the resting line plus however far the last wave has run up.
  const shoreAt = (x, t) => { const q = wavePhase(x, t) - 0.5; return restAt(x, t) + runUp(q - Math.floor(q)) * h * RUN; };

  // Where the sun or moon sits right now: it rises on the left and sets over open sea,
  // on the 38.2% line, clear of the islands and the chair.
  function placeBody() {
    S = sky(palawanHour());
    bodyR = S.sun ? sunR : sunR * 0.7;
    bodyX = riseX + (setX - riseX) * S.p;
    const lowY = hz - bodyR * 0.42, highY = h * 0.03 + bodyR;     // half-sunk at the horizon .. near the top
    bodyY = lowY + (highY - lowY) * S.elev;
  }

  function size() {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    FS = 5;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(w * dpr);
    canvas.height = Math.ceil(h * dpr);
    ctx.font = `500 ${FS}px ${MONO}`;
    cw = ctx.measureText('M'.repeat(50)).width / 50;
    lh = Math.round(FS * 1.2);
    cols = Math.ceil(w / cw);
    rows = Math.ceil(h / lh);
    B = new Float32Array(cols * rows);
    O = new Uint8Array(cols * rows);
    FG = new Uint8Array(cols * rows);   // 1 where a figure (him, the chair, a palm, the boat) was drawn this frame
    shoreCol = new Float32Array(cols);
    restCol = new Float32Array(cols);

    // A raised camera: the horizon is 30% down, so most of the picture is sea and sand.
    // The chair sits on the golden 61.8% line.
    const PHI = 0.618;
    hz = h * 0.3;
    shoreL = 0.62; shoreR = 0.42;
    sunR = h * 0.065;
    // the sun and moon cross open sky right of the palm grove, so no frond ever covers them
    riseX = w * 0.44;
    setX = w * 0.52;
    // The chair group spans 890 x 670 px in the reference photo; fit it to the band.
    k = h * 0.66 / 620;
    ox = w * PHI;
    oy = h * 0.995 - (1000 - 610) * k;
    placeBody();

    // Karst islands never move, so work out their brightness once per size.
    rock = new Float32Array(cols * rows).fill(-1);
    // The mainland: on the left the bay is closed by a big headland covered in jungle,
    // with pale limestone cliff faces, two peaks, sloping down to the horizon before the
    // sun's path. Its foot stands out in the water, nearer on the left.
    const ML = 0.42 * w, MH = 0.28 * h;
    const bump = (u, c, wd) => Math.exp(-(((u - c) / wd) ** 2));
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cw, u = x / ML;
      if (u >= 1) continue;
      const prof = Math.max(bump(u, 0.18, 0.3), 0.72 * bump(u, 0.58, 0.22), (1 - u) * 0.55) * (1 - u ** 4);
      const top = hz - MH * prof * (0.9 + 0.2 * vnoise(x * 0.025, 1.5));
      const base = hz + h * 0.05 * (1 - u) ** 1.5;
      for (let r = 0; r < rows; r++) {
        const y = (r + 0.5) * lh;
        if (y < top) continue;
        if (y > base) break;
        const lump = vnoise(x * 0.06, y * 0.06) * 0.6 + vnoise(x * 0.16, y * 0.16) * 0.4;
        // Hazy with distance, so the palms in front stand out against it: lumpy jungle,
        // a little denser lower down, with pale streaky limestone cliff faces.
        let b = 0.1 + 0.26 * lump + 0.08 * (y - top) / (base - top + 1);
        if (vnoise(x * 0.018 + 5, y * 0.009) > 0.62) b = 0.03 + 0.12 * vnoise(x * 0.4, y * 0.04);
        if (y - top < 2.5) b = 0.85;                                   // the skyline
        if (base - y < 2.5) b = 0.6;                                   // where it meets the water
        rock[r * cols + c] = Math.max(0.06, Math.min(0.95, b));
      }
    }

    ISLANDS.forEach(([u, hwL0, hwR0, hh0, tone, base0, pL, pR], k) => {
      const cx = u * w, hwL = hwL0 * h, hwR = hwR0 * h, hh = hh0 * h, base = hz + base0 * h;
      const toSun = setX >= cx ? -1 : 1;                 // which side faces the sun
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cw, dx = x - cx, d = dx < 0 ? -dx / hwL : dx / hwR;
        if (d >= 1) continue;
        const shape = Math.pow(1 - Math.pow(d, dx < 0 ? pL : pR), 0.6) * (0.92 + 0.12 * vnoise(x * 0.05, k * 5.3));
        const top = base - Math.min(base - 4, hh * shape);
        const lit = (dx < 0 ? -1 : 1) === toSun ? 1 : 0;   // the face toward the sun is a little paler
        for (let r = 0; r < rows; r++) {
          const y = (r + 0.5) * lh;
          if (y > base) break;
          if (y < top) continue;
          const lump = vnoise(x * 0.07 + k * 9, y * 0.07) * 0.6 + vnoise(x * 0.18, y * 0.18 + k) * 0.4;
          let b = tone * (0.45 + 0.6 * lump) - 0.08 * lit * d;            // jungle over limestone
          if (d > 0.55 && vnoise(x * 0.03 + k * 4, y * 0.012) > 0.55) b = 0.08 + 0.16 * vnoise(x * 0.5, y * 0.05);   // pale cliff faces on the steep flanks
          if (y - top < 2.5) b = tone + 0.32;                              // the skyline
          if (base0 && base - y < 2.5) b = tone + 0.25;                    // where it meets the water
          rock[r * cols + c] = Math.max(0.06, Math.min(0.95, b));
        }
      }
    });
  }

  function plot(x, y, b) {
    const c = Math.floor(x / cw), r = Math.floor(y / lh);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    B[r * cols + c] = b; O[r * cols + c] = 0; FG[r * cols + c] = 1;
  }
  function stroke(x0, y0, x1, y1, b) {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
    for (let i = 0; i <= n; i++) plot(x0 + (x1 - x0) * (i / n), y0 + (y1 - y0) * (i / n), b);
  }
  // Every cell whose centre is within `rad` px of a segment gets `fn(index, cellY)`.
  function cellsNear(x0, y0, x1, y1, rad, fn) {
    const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - rad) / cw)), c1 = Math.min(cols - 1, Math.floor((Math.max(x0, x1) + rad) / cw));
    const r0 = Math.max(0, Math.floor((Math.min(y0, y1) - rad) / lh)), r1 = Math.min(rows - 1, Math.floor((Math.max(y0, y1) + rad) / lh));
    const vx = x1 - x0, vy = y1 - y0, vv = vx * vx + vy * vy || 1;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const px = (c + 0.5) * cw, py = (r + 0.5) * lh;
        const u = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / vv));
        const ex = px - (x0 + vx * u), ey = py - (y0 + vy * u);
        if (ex * ex + ey * ey <= rad * rad) fn(r * cols + c, c, py);
      }
    }
  }
  // A thick line (a capsule).
  const capsule = (x0, y0, x1, y1, rad, b) => cellsNear(x0, y0, x1, y1, rad, (i) => { B[i] = b; O[i] = 0; FG[i] = 1; });
  // Shade only the sand under a capsule: shadows never fall on the water.
  const shade = (x0, y0, x1, y1, rad, b) => cellsNear(x0, y0, x1, y1, rad, (i, c, py) => { if (py > shoreCol[c] + 2) { B[i] = Math.max(B[i], b); O[i] = 0; } });
  // A silhouette made of capsules, with a thin empty outline around it so it separates
  // from whatever is behind it.
  function silhouette(parts, b, gap) {
    for (const [x0, y0, x1, y1, rad] of parts) capsule(x0, y0, x1, y1, rad + gap, 0);
    for (const [x0, y0, x1, y1, rad] of parts) capsule(x0, y0, x1, y1, rad, b);
  }

  // Where shadows fall: away from the sun or moon (which is ahead of the camera), so
  // toward us and to the side, longer when the light is low. Null when it is too dark.
  function shadowDir(x) {
    const strength = S.sun ? 0.3 : 0.18 * S.night;
    if (strength < 0.05) return null;
    const sx = (x - bodyX) / w * 1.6, sy = 1, n = Math.hypot(sx, sy);
    return { x: sx / n, y: sy / n, k: 0.35 + 1.3 * (1 - S.elev), b: strength };
  }

  // ---- life on the sand -------------------------------------------------------------
  // Shells lie scattered on the dry sand. Crabs scuttle sideways and wave their claws;
  // others dig themselves in, flicking sand, peek out with their eyes, and climb back
  // out. Drawn on dry sand only, before the palms and the chair so those stand in front
  // of them. Positions are fractions of the band.
  const SHELLS = [[0.36, 0.72, '@'], [0.41, 0.86, '<>'], [0.31, 0.93, '()'], [0.44, 0.66, '%'], [0.27, 0.8, '@'],
    [0.85, 0.7, '<>'], [0.42, 0.97, '&'], [0.33, 0.66, 'o'], [0.91, 0.86, '@']];
  // walkers: [x, y, how far they wander (fraction of width), speed, phase]
  const WALKERS = [[0.37, 0.76, 0.05, 0.35, 0], [0.4, 0.9, 0.06, 0.28, 2.1], [0.84, 0.78, 0.03, 0.4, 4.2]];
  // diggers: [x, y, phase]
  const DIGGERS = [[0.3, 0.86, 0], [0.43, 0.74, 5]];
  function put(x, y, text) {                       // write text centred on (x, y)
    const r = Math.floor(y / lh), c0 = Math.round(x / cw - text.length / 2);
    if (r < 0 || r >= rows) return;
    for (let j = 0; j < text.length; j++) {
      const c = c0 + j, ch = text.charCodeAt(j);
      if (c >= 0 && c < cols && ch !== 32) O[r * cols + c] = ch;
    }
  }
  const onDrySand = (x, y, t) => y > shoreAt(x, t) + h * 0.05;
  // Crab size from its depth in the picture: nearer (lower) crabs are bigger.
  const crabSize = (y) => h * (0.024 + 0.035 * Math.max(0, y / h - 0.6));

  // One crab, seen from above: a wide shell, two eyes on stalks, two claws reaching
  // forward with pincers that open and close, and three legs each side that step as it
  // walks. `sink` (0..1) is how far it has dug into the sand.
  function crab(x, y, s, legPhase, open, sink) {
    if (sink > 0) {   // the ring of churned sand around its hole
      for (let a = 0; a < 6.28; a += 0.35) plot(x + Math.cos(a) * s * 0.75, y + Math.sin(a) * s * 0.3, 0.42);
    }
    if (sink < 0.85) {
      const k = 1 - sink;
      if (sink < 0.3) {
        for (const side of [-1, 1]) {
          for (let j = 0; j < 3; j++) {             // legs: hip, raised knee, foot; each lifts in turn
            const lift = Math.sin(legPhase + j * 2.1 + (side > 0 ? 1 : 0)) * 0.14 * s;
            const hx = x + side * 0.4 * s, hy = y + (j - 0.6) * 0.2 * s;
            const kx = x + side * 0.85 * s, ky = y + (j - 1.2) * 0.3 * s - lift;
            const fx = x + side * 1.08 * s, fy = y + (j - 0.7) * 0.42 * s;
            stroke(hx, hy, kx, ky, 0.85); stroke(kx, ky, fx, fy, 0.85);
          }
        }
      }
      for (const side of [-1, 1]) {                 // claws: an arm, then a two-fingered pincer
        const ax = x + side * 0.55 * s, ay = y - 0.62 * s * k;
        stroke(x + side * 0.3 * s, y - 0.2 * s * k, ax, ay, 0.9);
        capsule(ax, ay, ax, ay, 0.13 * s, 0.95);
        stroke(ax, ay, ax + side * (0.1 + 0.16 * open) * s, ay - 0.35 * s * k, 0.95);
        stroke(ax, ay, ax - side * 0.12 * s, ay - 0.32 * s * k, 0.95);
      }
      capsule(x - 0.15 * s, y - 0.3 * s * k, x - 0.17 * s, y - 0.48 * s * k, 0.06 * s + 0.5, 0.95);   // eyes on stalks
      capsule(x + 0.15 * s, y - 0.3 * s * k, x + 0.17 * s, y - 0.48 * s * k, 0.06 * s + 0.5, 0.95);
      silhouette([[x - 0.36 * s, y, x + 0.36 * s, y, 0.32 * s * k + 1]], 0.95, 1.5);   // the shell
    } else if (open > 0.5) {                         // buried: only its eyes peek out of the hole
      plot(x - 0.15 * s, y - 0.05 * s, 0.95); plot(x + 0.15 * s, y - 0.05 * s, 0.95);
    }
  }

  function sandLife(t) {
    for (const [u, v, g] of SHELLS) { const x = u * w, y = v * h; if (onDrySand(x, y, t)) put(x, y, g); }
    for (const [u, v, amp, sp, ph] of WALKERS) {
      // sideways back and forth, pausing at each end to wave its claws
      const sw = Math.sin(t * sp + ph), x = (u + amp * Math.max(-1, Math.min(1, sw * 1.4))) * w, y = v * h;
      if (!onDrySand(x, y, t)) continue;
      const moving = Math.abs(sw) < 0.7;
      crab(x, y, crabSize(y), moving ? t * 14 : 0, moving ? 0.2 : 0.5 + 0.5 * Math.sin(t * 4 + ph), 0);
    }
    for (const [u, v, ph] of DIGGERS) {
      const x = u * w, y = v * h, sz = crabSize(y);
      if (!onDrySand(x, y, t)) continue;
      // a 14 s cycle: stand waving its claws, dig in, stay buried peeking out, climb back out
      const q = ((t + ph) % 14) / 14;
      let sink = 0, digging = false;
      if (q < 0.3) sink = 0;
      else if (q < 0.45) { sink = ((q - 0.3) / 0.15) * 0.85; digging = true; }
      else if (q < 0.8) sink = 1;
      else if (q < 0.9) sink = 0.85 - ((q - 0.8) / 0.1) * 0.55;
      else sink = 0.3 - ((q - 0.9) / 0.1) * 0.3;
      const peek = Math.floor(t * 1.2) % 3 !== 0 ? 1 : 0;
      crab(x, y, sz, digging ? t * 20 : 0, sink >= 1 ? peek : 0.5 + 0.5 * Math.sin(t * 3 + ph), sink);
      if (digging) for (let n = 0; n < 6; n++) {     // sand flicked up as it digs
        const r1 = hash(Math.floor(t * 8), n + ph * 7), r2 = hash(n, Math.floor(t * 8) + 3);
        put(x + (r1 - 0.5) * 2.4 * sz, y - (0.3 + r2) * sz, r2 > 0.5 ? "'" : '.');
      }
    }
  }

  // Wind: slow swells of gusts, 0 (calm) to 1 (strong). It blows from right to left.
  const windAt = (t) => { const g = 0.5 + 0.5 * Math.sin(t * 0.33) * Math.sin(t * 0.13 + 1); return 0.2 + 0.8 * g * g; };

  // The palms: [foot x, foot y, crown x, crown y, size, sway phase]. Groves on both
  // sides of the beach at different depths: far ones are small with their feet up near
  // the water, near ones big and low in the frame. Their fronds stay clear of the sun
  // and moon's path in the middle of the sky.
  const palmSpecs = () => [
       // left grove: further ones smaller and higher in the frame, near ones big and low
       [w * 0.16, h * 0.66, w * 0.14, h * 0.34, 0.5, 5.2],
       [w * 0.08, h * 0.7, w * 0.05, h * 0.3, 0.62, 4.4],
       [w * 0.25, h * 0.7, w * 0.27, h * 0.32, 0.6, 2.4],
       [w * 0.12, h * 0.8, w * 0.15, h * 0.2, 0.82, 1.7],
       [w * 0.2, h * 0.9, w * 0.22, h * 0.2, 0.85, 3.1],
       [w * 0.04, h * 0.98, w * 0.07, h * 0.14, 0.95, 0],
       // right side, beyond and beside the chair; crowns kept low enough that no frond
       // reaches the Palawan clock in the top-right corner
       [w * 0.88, h * 0.62, w * 0.9, h * 0.22, 0.75, 3.7],
       [w * 0.97, h * 0.99, w * 0.94, h * 0.22, 0.9, 0.6]]
    .sort((a, b) => a[1] - b[1]);   // furthest (highest foot) first, so nearer palms draw over them

  // Its shadow on the sand: the trunk and a starburst of fronds, swinging with the light.
  function palmShadow([bx, by, tx, ty, k]) {
    const d = shadowDir(bx);
    if (!d) return;
    const L = (by - ty) * d.k * 0.55;
    const ex = bx + d.x * L, ey = by + d.y * L;
    shade(bx, by, ex, ey, h * 0.008 * k, d.b);
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2 + 0.3;
      shade(ex, ey, ex + Math.cos(a) * h * 0.11 * k, ey + Math.sin(a) * h * 0.05 * k, h * 0.007 * k, d.b * 0.9);
    }
  }

  // One coconut palm: a tapering, ringed trunk that bends with the wind, and a round
  // crown of drooping fronds that swing downwind and flutter.
  function palm(t, [bx, by, tx, ty, k, phase]) {
    const gust = windAt(t + phase) * (0.75 + 0.25 * Math.sin(t * 1.7 + phase * 3));
    const bend = -(gust * 0.03 + Math.sin(t * 0.9 + phase * 1.3) * 0.012) * h * k;   // gusts plus a slow back-and-forth sway
    const cx = tx + bend + Math.sin(t * 0.8 + phase) * h * 0.004 * k, cy = ty + gust * h * 0.006 * k;
    const H = by - cy, dx = cx - bx;
    const P = [[bx, by], [bx + dx * 0.1 + h * 0.02 * k, by - H * 0.35], [cx - dx * 0.2 - bend * 0.6, cy + H * 0.3], [cx, cy]];
    const at = (s) => {
      const m = 1 - s;
      return [m * m * m * P[0][0] + 3 * m * m * s * P[1][0] + 3 * m * s * s * P[2][0] + s * s * s * P[3][0],
              m * m * m * P[0][1] + 3 * m * m * s * P[1][1] + 3 * m * s * s * P[2][1] + s * s * s * P[3][1]];
    };
    const SEG = 36, rad = (s) => h * (0.016 - 0.008 * s) * k, trunk = [];
    for (let i = 0; i < SEG; i++) {
      const [x0, y0] = at(i / SEG), [x1, y1] = at((i + 1) / SEG);
      trunk.push([x0, y0, x1, y1, rad(i / SEG)]);
    }
    silhouette(trunk, 0.93, 2);
    for (let i = 2; i < SEG; i += 3) { const [x0, y0] = at(i / SEG); stroke(x0 - rad(i / SEG), y0, x0 + rad(i / SEG), y0, 0.5); }

    const L = h * 0.25 * k;
    [-3.3, -2.85, -2.35, -1.85, -1.3, -0.8, -0.3, 0.15].forEach((a0, j) => {
      const a = a0 - gust * 0.4 * (1 + Math.cos(a0)) / 2 + Math.sin(t * 4.2 + j * 1.7 + phase) * 0.06 * gust;
      const droop = 0.35 + 1.0 * Math.min(1, Math.abs(a0 + 1.57) / 1.7);
      const len = L * (0.82 + 0.18 * hash(j, 7));
      const pt = (s) => [cx + Math.cos(a) * len * s, cy + Math.sin(a) * len * s * 0.7 + droop * len * s * s];
      let prev = pt(0);
      for (let s = 0.025; s <= 1.001; s += 0.025) {
        const q = pt(s);
        stroke(prev[0], prev[1], q[0], q[1], 0.95);
        if (s > 0.2 && Math.round(s / 0.025) % 2 === 0) {
          const ddx = q[0] - prev[0], ddy = q[1] - prev[1], ln = Math.hypot(ddx, ddy) || 1;
          const nx = -ddy / ln, ny = ddx / ln, tick = h * 0.032 * k * (1 - s * 0.55);
          const flick = Math.sin(t * 6 + j + s * 9 + phase) * gust * tick * 0.35;
          stroke(q[0], q[1], q[0] + nx * tick + flick, q[1] + ny * tick + tick * 0.9, 0.55);
          stroke(q[0], q[1], q[0] - nx * tick + flick, q[1] - ny * tick + tick * 0.9, 0.55);
        }
        prev = q;
      }
    });
    const cr = h * 0.011 * k;
    silhouette([[cx - cr * 1.6, cy + cr * 1.5, cx - cr * 1.6, cy + cr * 1.5, cr], [cx + cr * 0.4, cy + cr * 2.1, cx + cr * 0.4, cy + cr * 2.1, cr], [cx + cr * 2.2, cy + cr * 1.2, cx + cr * 2.2, cy + cr * 1.2, cr]], 0.9, 1);
  }

  // A bangka (outrigger boat) drifting right to left across the bay, bobbing and
  // rocking on the swell. Bow on the left, a canopy on posts, the outrigger float
  // along the waterline.
  // The sea's swell height at (x, y), the same wave field the water is drawn from:
  // 1 at a crest, 0 in a trough.
  function swellAt(x, y, t) {
    const sh = shoreAt(x, t), d = Math.min(1, Math.max(0, (y - hz) / (sh - hz + 1)));
    const ph = 11 * Math.sqrt(d) - t * 0.9 + Math.sin(x * 0.012 + t * 0.2) * 1.1 + vnoise(x * 0.01, d * 3) * 2;
    return 0.5 + 0.5 * Math.sin(ph);
  }

  // A bangka (outrigger boat) at (bx, y0), L px long, riding the swell under it a beat
  // behind the water: bow and stern each sit on the wave height under them, so it rises,
  // falls and pitches with the sea. Bow on the left, a canopy on posts, the outrigger
  // float along the waterline.
  function boat(bx, y0, L, t) {
    const lag = 0.35, amp = h * 0.006 * (L / (h * 0.18));
    const bow = swellAt(bx - L * 0.4, y0, t - lag), stern = swellAt(bx + L * 0.4, y0, t - lag);
    const by = y0 - ((bow + stern) / 2 - 0.5) * amp * 2;
    const tilt = (stern - bow) * amp / L * 1.6;
    const P = (u, v2) => [bx + u * L, by + v2 * L + u * L * tilt];
    const seg = (u0, v0, u1, v1, rad) => [...P(u0, v0), ...P(u1, v1), Math.max(0.6, rad * L)];
    silhouette([
      seg(-0.36, -0.035, 0.36, -0.035, 0.045),    // hull
      seg(-0.36, -0.05, -0.52, -0.13, 0.02),      // upturned bow
      seg(0.36, -0.05, 0.48, -0.11, 0.02),        // stern
      seg(-0.46, 0.02, 0.44, 0.02, 0.012),        // outrigger float
      seg(-0.24, -0.06, -0.3, 0.02, 0.01),        // outrigger arms
      seg(0.24, -0.06, 0.3, 0.02, 0.01),
      seg(-0.15, -0.07, -0.15, -0.2, 0.01),       // canopy posts
      seg(0.2, -0.07, 0.2, -0.2, 0.01),
      seg(-0.24, -0.21, 0.29, -0.21, 0.018),      // canopy roof
    ], 0.9, 1.5);
  }
  // One bangka drifting right to left across the bay (moored ones were too small to read)
  function bangkas(t) {
    const L = h * 0.18, v = w / 90;
    boat(w + L - ((t * v + w * 0.55) % (w + 2 * L)), hz + h * 0.07, L, t);
  }

  // ---- dolphins ------------------------------------------------------------------
  // Every 20-40 s (the first after 6-14 s) a dolphin, sometimes two, leaps out of open
  // water: it arcs up and back in, body bending along its path, with a splash where it
  // leaves and re-enters the sea, then slides back under tail last. Size follows
  // distance: one far out near the horizon is a third the size of one close in.
  let leap = null, nextLeap = 6 + Math.random() * 8;
  const LEAP_TIME = 1.7;
  const DIVE = 1.42;   // the tail trails the snout by 0.36 of the arc, so it is under water by p ≈ 1.36
  function spawnLeap(t) {
    for (let tries = 0; tries < 12; tries++) {
      const x0 = w * (0.05 + Math.random() * 0.85), y0 = hz + h * (0.03 + Math.random() * 0.13);
      const dir = Math.random() < 0.5 ? -1 : 1, L = h * (0.02 + 1.1 * (y0 - hz) / h);
      const x1 = x0 + dir * L * 2.2;
      if (x1 < 0 || x1 > w) continue;
      if (y0 > restAt(x0, t) - h * 0.05 || y0 > restAt(x1, t) - h * 0.05) continue;   // stay in open water
      return { t0: t, x0, y0, dir, L, pair: Math.random() < 0.4 };
    }
    return null;
  }
  function dolphin(p, x0, y0, dir, L) {
    const span = L * 2.2, H = L * 1.05;
    const at = (q) => [x0 + dir * span * q, y0 - H * 4 * q * (1 - q)];   // the arc
    const pts = [];
    for (let k = 0; k <= 12; k++) {              // snout (s = 0) back to tail (s = 1), trailing along the arc
      const s = k / 12, [x, y] = at(p - s * 0.36);
      pts.push([x, y, s]);
    }
    const parts = [];
    for (let k = 0; k < 12; k++) {
      const [ax, ay, s] = pts[k], [bx, by] = pts[k + 1];
      if (ay > y0 - 1 && by > y0 - 1) continue;  // under water
      parts.push([ax, ay, bx, by, Math.max(1.5, L * (0.04 + 0.13 * Math.sin(Math.PI * Math.min(1, 0.15 + s * 1.05))))]);   // a thick, tapering body
    }
    if (!parts.length) return;
    const [fx, fy] = pts[5], [gx, gy] = pts[4], nx = -(gy - fy), ny = gx - fx, nl = Math.hypot(nx, ny) || 1;
    const up = ny / nl < 0 ? 1 : -1;            // the dorsal fin points away from the belly (up the arc)
    if (fy < y0 - 1) parts.push([fx, fy, fx + up * nx / nl * L * 0.3 - dir * L * 0.08, fy + up * ny / nl * L * 0.3, Math.max(1.5, L * 0.045)]);
    const [tx, ty] = pts[12], [ux, uy] = pts[11], vx = tx - ux, vy = ty - uy, vl = Math.hypot(vx, vy) || 1;
    if (ty < y0 - 1) for (const sd of [-1, 1]) parts.push([tx, ty, tx + (vx / vl * 0.5 - vy / vl * sd) * L * 0.22, ty + (vy / vl * 0.5 + vx / vl * sd) * L * 0.22, Math.max(1.5, L * 0.045)]);   // tail flukes
    silhouette(parts, 0.92, 1.5);
  }
  function splash(x, y, L, k, t) {
    for (let n = 0; n < 7; n++) {
      const r1 = hash(n, k + Math.floor(t * 10)), r2 = hash(n + 9, k);
      put(x + (r1 - 0.5) * L * 0.7, y - r2 * L * 0.35, r1 > 0.5 ? "'" : '.');
    }
  }
  function dolphins(t) {
    if (!leap && t >= nextLeap) leap = spawnLeap(t) || null;
    if (!leap) { if (t >= nextLeap) nextLeap = t + 5; return; }
    const { t0, x0, y0, dir, L, pair } = leap;
    for (let j = 0; j < (pair ? 2 : 1); j++) {
      const p = (t - t0 - j * 0.35) / LEAP_TIME;
      if (p < 0 || p > DIVE) continue;
      const ox = j * L * 0.9 * -dir, oy = j * h * 0.012;
      dolphin(p, x0 + ox, y0 + oy, dir, L * (1 - j * 0.12));   // past p = 1 the body keeps following the arc under the surface
      if (p < 0.22) splash(x0 + ox, y0 + oy, L, j, t);
      if (p > 0.82 && p < 1.3) splash(x0 + ox + dir * L * 2.2, y0 + oy, L, j + 5, t);
    }
    if (t - t0 > LEAP_TIME * DIVE + 0.4) { leap = null; nextLeap = t + 20 + Math.random() * 20; }
  }

  // Dan in a deck chair, seen from above, behind and to the right, facing the sea.
  // The shapes were measured on a reference photo of this camera angle (in that
  // photo's pixels, origin at the top of the chair's front post) and are scaled into
  // the scene by `k`. The long chair rail runs from its front foot (lower left) up to
  // the top of the backrest (upper right); he lies along the striped canvas with his
  // head at the top, one arm bent behind his head, the laptop on his lap
  // facing him (and us), knees up beside it and feet out on the sand to the left.
  // Lines of made-up code type out on the screen while his other hand taps the keys.
  // The screen glows at night; when asked he scratches his head.
  const screen = { line: 40, pos: 0, last: 0 };   // starts with a screenful of earlier lines
  const CODE = 'abcdefghijklmnopqrstuvwxyz=(){};.<>';
  let k = 1;                                      // photo px -> canvas px
  const P = (px, py) => [ox + (px - 1300) * k, oy + (py - 610) * k];
  // On phones the characters are big, so every part is at least half a row thick or it would fall between rows.
  const sg = (x0, y0, x1, y1, rad) => [...P(x0, y0), ...P(x1, y1), rad * k];
  const SLING = [[1080, 600], [1745, 470], [1610, 600], [1240, 722]];   // the striped canvas
  const headAt = () => P(1488, 452);

  function inQuad(px, py, Q) {
    let sign = 0;
    for (let q = 0; q < 4; q++) {
      const [ax, ay] = Q[q], [bx, by] = Q[(q + 1) % 4];
      const cr = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
      if (cr !== 0) { if (sign && Math.sign(cr) !== sign) return false; sign = Math.sign(cr); }
    }
    return true;
  }
  // Fill a quad (given in canvas px) cell by cell with brightness from `fn(px, py)`.
  function fillQuad(Q, fn) {
    const xs = Q.map((p) => p[0]), ys = Q.map((p) => p[1]);
    for (let r = Math.max(0, Math.floor(Math.min(...ys) / lh)); r <= Math.min(rows - 1, Math.floor(Math.max(...ys) / lh)); r++) {
      for (let c = Math.max(0, Math.floor(Math.min(...xs) / cw)); c <= Math.min(cols - 1, Math.floor(Math.max(...xs) / cw)); c++) {
        const px = (c + 0.5) * cw, py = (r + 0.5) * lh;
        if (inQuad(px, py, Q)) { B[r * cols + c] = fn(px, py); O[r * cols + c] = 0; FG[r * cols + c] = 1; }
      }
    }
  }

  function chairAndDan(t) {
    // Materials. On desktop each has its own density (wood darkest, then skin, then the
    // light shirt and canvas). In the chunky phone close-up those blur into noise, so it
    // uses two tones instead: Dan solid, the chair lighter, the canvas faint and plain.
    const SKIN = 0.84, SHIRT = 0.62, HAIR = 0.97, WOOD = 0.97;
    const SLING_A = 0.22, SLING_B = 0.42, KEYS = 0.74;
    // shadow of the chair and of him, on the sand
    const d = shadowDir(ox);
    if (d) {
      const L = 260 * k * d.k;
      const [ax, ay] = P(1150, 760), [bx, by] = P(1620, 930);
      shade(ax + d.x * L * 0.3, ay + d.y * L * 0.3, bx + d.x * L, by + d.y * L, 70 * k, d.b);
    }

    // the screen, in canvas px
    const [X0, Y0] = P(1118, 400), [X1, Y1] = P(1266, 512);

    // its glow at dusk and at night
    const glow = Math.max(S.night, S.sun ? 0 : 0.5);
    if (glow > 0) {
      const gx = (X0 + X1) / 2, gy = (Y0 + Y1) / 2, R = 260 * k;
      cellsNear(gx, gy, gx, gy, R, (i, c, py) => {
        const dd = Math.hypot((c + 0.5) * cw - gx, py - gy) / R;
        B[i] = Math.max(B[i], 0.45 * glow * (1 - dd) * (1 - dd)); O[i] = 0;
      });
    }

    // the far side of the seat's front edge, behind everything else
    silhouette([sg(1040, 598, 1100, 640, 9)], 0.8, 1.5);

    // the striped canvas sling
    const Q = SLING.map(([x, y]) => P(x, y));
    const [Ax, Ay] = Q[0], [Dx, Dy] = Q[3], adx = Dx - Ax, ady = Dy - Ay, ad2 = adx * adx + ady * ady;
    fillQuad(Q, (px, py) => (Math.floor((((px - Ax) * adx + (py - Ay) * ady) / ad2) * 6) % 2 ? SLING_A : SLING_B));   // light stripes along its length

    // legs: one knee raised beside the laptop with the foot out on the sand, the other
    // leg lower with its foot resting further back
    silhouette([
      sg(1185, 575, 1105, 470, 26), sg(1105, 470, 975, 598, 21), sg(975, 598, 902, 590, 13),
      sg(1120, 625, 1045, 688, 21), sg(1045, 690, 995, 690, 13),
    ], SKIN, 3);

    // body lying back along the canvas: chest and shoulders up by the backrest, the
    // shirt over his lap lower down
    silhouette([
      sg(1455, 530, 1290, 590, 48), sg(1290, 590, 1150, 615, 45),
      sg(1430, 522, 1565, 508, 32),
    ], SHIRT, 3);

    // the laptop screen (with code on it), then the keyboard on his lap below it
    const sc0 = Math.max(0, Math.floor(X0 / cw)), sc1 = Math.min(cols - 1, Math.floor(X1 / cw));
    const sr0 = Math.max(0, Math.floor(Y0 / lh)), sr1 = Math.min(rows - 1, Math.floor(Y1 / lh));
    for (let r = sr0 - 1; r <= sr1 + 1; r++) for (let c = sc0 - 1; c <= sc1 + 1; c++) {   // a clear ring around it
      if (r >= 0 && r < rows && c >= 0 && c < cols) { B[r * cols + c] = 0; O[r * cols + c] = 0; FG[r * cols + c] = 1; }
    }
    for (let r = sr0; r <= sr1; r++) for (let c = sc0; c <= sc1; c++) {
      const i = r * cols + c, edge = r === sr0 || r === sr1 || c === sc0 || c === sc1;
      B[i] = edge ? 0.9 : 0; O[i] = 0;
    }
    const scratching = t < scratchUntil;
    const typing = vnoise(t * 0.6, 3.5) > 0.3;
    const W = sc1 - sc0 - 3, Hn = sr1 - sr0 - 1;
    if (W > 2 && Hn > 0) {
      const lineLen = (n) => 2 + Math.floor(hash(n, 7) * (W - 2));
      const dt = Math.min(0.1, Math.max(0, t - screen.last));
      screen.last = t;
      if (typing) {
        screen.pos += dt * 9;
        if (screen.pos > lineLen(screen.line) + 3) { screen.line++; screen.pos = 0; }   // Enter, after a short pause
      }
      for (let q = 0; q < Hn; q++) {
        const n = screen.line - (Hn - 1 - q);
        if (n < 0) continue;
        const r = sr0 + 1 + q, ind = Math.floor(hash(n, 3) * 3) * 2;
        const shown = n === screen.line ? Math.min(lineLen(n), Math.floor(screen.pos)) : lineLen(n);
        for (let j = 0; j < shown && ind + j < W; j++) {
          if (hash(n * 31 + j, 5) < 0.18) continue;
          O[r * cols + sc0 + 2 + ind + j] = CODE.charCodeAt(Math.floor(hash(n * 17 + j, 9) * CODE.length));
        }
        if (n === screen.line && Math.floor(t * 2.5) % 2 === 0 && ind + shown < W) O[r * cols + sc0 + 2 + ind + shown] = 95;   // '_' cursor
      }
    }
    fillQuad([P(1150, 522), P(1320, 504), P(1334, 546), P(1182, 582)], () => KEYS);   // keyboard

    // his near arm, down from the shoulder to the hand typing on the keys
    const tap = typing && hash(Math.floor(t * 9), 1) > 0.5 ? -12 : 0;
    silhouette([sg(1440, 545, 1335, 598, 20), sg(1335, 598, 1248, 548 + tap, 17), sg(1248, 548 + tap, 1248, 548 + tap, 16)], SKIN, 3);

    // the near side of the chair, in front of him: the long rail, posts, legs and bars
    silhouette([
      sg(1020, 752, 1757, 462, 10),                     // long rail: front foot up to the top of the backrest
      sg(1300, 615, 1312, 918, 10),                     // front post
      sg(1560, 590, 1578, 858, 10),                     // back post
      sg(1158, 718, 1308, 915, 9),                      // front leg
      sg(1392, 712, 1682, 895, 9),                      // back brace
      sg(1330, 885, 1580, 798, 8),                      // bar along the sand
      sg(1340, 902, 1450, 990, 8), sg(1450, 990, 1688, 893, 8),   // feet
    ], WOOD, 4);                                        // wood, with a clear gap around it

    // his head, and the other arm bent up behind it with the hand on his head. The hand
    // always touches the head: at rest it sits on the back of the crown; when he scratches
    // it rubs back and forth along the curve of his head, with a few quick tick marks.
    silhouette([sg(1503, 500, 1512, 525, 18)], SKIN, 3);                                   // neck
    silhouette([sg(1488, 452, 1490, 452, 46)], HAIR, 3);                                   // head (hair)
    const ang = scratching ? -1.25 + 0.4 * Math.sin(t * 22) : -0.95;                      // where on the head the hand is
    const hx = 1488 + Math.cos(ang) * 40, hy = 452 + Math.sin(ang) * 40;                  // just inside the head's edge
    silhouette([sg(1570, 515, 1612, 440, 20)], SKIN, 3);                                   // upper arm, elbow up
    silhouette([sg(1612, 440, hx, hy, 17), sg(hx, hy, hx, hy, 17)], SKIN, 0);             // forearm and hand, on the head
    if (scratching && Math.floor(t * 10) % 2) {
      const [ax, ay] = P(hx + Math.cos(ang) * 34, hy + Math.sin(ang) * 34);
      put(ax, ay, "'"); put(ax + cw * 2, ay + lh * 0.5, '`');                              // scratch marks
    }
  }
  const manBox = () => { const [x0, y0] = P(880, 380), [x1, y1] = P(1770, 1000); return [x0, y0, x1, y1]; };

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = `500 ${FS}px ${MONO}`;
    ctx.textBaseline = 'top';
    ctx.fontKerning = 'none';
    ctx.fillStyle = ink;

    for (let c = 0; c < cols; c++) { const x = (c + 0.5) * cw; shoreCol[c] = shoreAt(x, t); restCol[c] = restAt(x, t); }
    const glow = S.low;                                              // 1 at sunrise/sunset, 0 at midday

    for (let r = 0; r < rows; r++) {
      const y = (r + 0.5) * lh;
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cw, i = r * cols + c, sh = shoreCol[c];
        let b = 0, ch = 0;

        if (rock[i] >= 0 && y >= hz) {
          b = rock[i];                                                      // a near island, standing in the sea
        } else if (y < hz) {
          // sky, sun or moon, stars, and islands
          b = rock[i];
          if (b < 0) {
            b = 0;
            const cl = vnoise(x * 0.004 + t * 0.008, y * 0.02);           // thin drifting clouds
            if (cl > 0.68) b = (cl - 0.68) * 0.8;
            const hg = 1 - (hz - y) / (h * 0.1);                            // a little haze near the horizon at dawn and dusk
            if (glow > 0 && hg > 0 && hash(c, r) < 0.07 * hg * hg * glow) b = Math.max(b, 0.1);
            if (S.night > 0 && hash(c * 3, r * 7) > 1 - 0.014 * S.night) {   // stars, gently twinkling
              ch = hash(c, r + Math.floor(t * 1.2)) > 0.35 ? 42 : 43;
            }
            const dx = x - bodyX, dy = y - bodyY, d = Math.hypot(dx, dy);
            if (S.sun) {
              if (d < bodyR) { b = d > bodyR - 2 ? 0.97 : 0.86; ch = 0; }
              else if (d < bodyR * 2.6) {
                const f = 1 - (d - bodyR) / (bodyR * 1.6);
                const ray = glow > 0 ? (0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 9 + t * 0.12)) : 0.4;
                b = Math.max(b, (0.12 + 0.3 * glow) * f * f * (0.4 + 0.6 * ray));
              }
            } else if (d < bodyR) {
              const lit = Math.hypot(dx - bodyR * 0.55, dy + bodyR * 0.1) > bodyR * 0.9;
              b = lit ? 0.9 : d > bodyR - 2 ? 0.3 : 0; ch = 0;
            }
          }
        } else if (y < sh) {
          // sea: darker toward the horizon, pale and clear near the shore
          const d = Math.min(1, (y - hz) / (sh - hz + 1));
          b = 0.02 + 0.2 * Math.pow(1 - d, 1.3);
          const ph = 11 * Math.sqrt(d) - t * 0.9 + Math.sin(x * 0.012 + t * 0.2) * 1.1 + vnoise(x * 0.01, d * 3) * 2;
          const s = Math.max(0, Math.sin(ph));
          b += 0.3 * s * s * (0.35 + 0.65 * d);
          if (y - hz < 2.5) b = 0.85;                                       // the horizon line
          // Waves rolling in: the main one curls over and breaks at the sand; a smaller
          // one half a cycle behind it just swells. Measured from the resting waterline.
          const rest = restCol[c], reach = (rest - hz) * 0.7;
          for (let k = 0; k < 2; k++) {
            const wp = (wavePhase(x, t) + k * 0.5) % 1;
            if (wp >= 0.5) continue;
            const u = wp / 0.5, amp = k ? 0.5 : 1;
            const yb = rest - (1 - u) * reach, th = h * (0.003 + 0.011 * u * u) * amp;
            if (y > yb - th && y <= yb) {
              const lace = vnoise(x * 0.13 + k * 9, y * 0.22 - t * 0.4) > 0.4 ? 1 : 0.45;
              b = Math.max(b, (0.3 + 0.6 * u) * lace * (0.6 + 0.4 * amp));
            } else if (!k && u > 0.55 && y > yb && y < yb + th * 0.9) {
              b = 0.04;                                                     // the shadowed face under the curling lip
            } else if (!k && u > 0.75 && y > yb - th - h * 0.02 && y <= yb - th && hash(c + Math.floor(t * 8), r) < 0.2 * u) {
              ch = 39;                                                      // "'" spray thrown up off the lip
            }
          }
          const q0 = wavePhase(x, t) - 0.5, q = q0 - Math.floor(q0);
          if (q < 0.7 && y > sh - h * 0.03 * (1 - q / 0.7) && vnoise(x * 0.09, y * 0.3 + t * 0.3) > 0.45 + 0.3 * q) b = Math.max(b, 0.6 - 0.5 * q);
          // The glitter path under the sun or moon: widens toward us, densest down its middle.
          const gw = h * (0.02 + 0.1 * d) * (1 + 0.6 * S.elev), off = Math.abs(x - bodyX);
          if (off < gw && y - hz > 3) {
            const core = 1 - off / gw;
            const strength = (S.sun ? 0.55 + 0.45 * glow : 0.45) * (S.sun || S.night > 0.3 ? 1 : 0.4);
            b += 0.16 * core * (0.5 + 0.5 * s) * strength;
            if (hash(c * 13 + Math.floor(t * 3), r) < (0.1 + 0.5 * core) * strength) ch = hash(c, r) > 0.65 ? 43 : 42;
          }
        } else {
          // sand
          const below = y - sh;
          if (below < h * 0.01) {
            b = vnoise(x * 0.2, y * 0.25 - t * 0.6) > 0.4 ? 0.85 : 0.25;    // lacy foam edge
          } else {
            const top = restCol[c] + h * RUN, n = hash(c, r);
            if (y < top + h * 0.005) {
              // still wet from the last wave: denser, and it glints
              b = 0.3 + 0.1 * n;
              const near = Math.max(0, 1 - Math.abs(x - bodyX) / (h * 0.25));
              if (hash(c * 7 + Math.floor(t * 2.5), r) < 0.08 + 0.3 * near) ch = near > 0.4 && hash(c, r * 3) > 0.5 ? 42 : 45;
            } else {
              // dry sand, lumpy and trodden: stipple that thickens in the dips
              const wet = Math.max(0, 1 - (y - top) / (h * 0.06));
              const lump = vnoise(x * 0.035, y * 0.06) * 0.6 + vnoise(x * 0.11, y * 0.2) * 0.4;
              b = n < 0.06 + 0.4 * wet + 0.12 * lump ? 0.1 + 0.16 * wet + 0.12 * lump : 0;   // sparse, so the figures read
            }
          }
        }
        B[i] = b; O[i] = ch; FG[i] = 0;
      }
    }

    const ps = palmSpecs();
    ps.forEach(palmShadow);
    sandLife(t);
    bangkas(t);
    dolphins(t);
    ps.filter((p) => p[1] < oy).forEach((p) => palm(t, p));   // palms further back than the chair
    chairAndDan(t);
    ps.filter((p) => p[1] >= oy).forEach((p) => palm(t, p));

    // Pointer effects replace the scenery under them.
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i], age = t - rp.t0;
      if (age > RIPPLE_LIFE) { ripples.splice(i, 1); continue; }
      const rad = age * 70, n = Math.max(10, Math.floor((2 * Math.PI * rad) / (cw * 1.3)));
      for (let s = 0; s < n; s++) {
        const ang = (s / n) * Math.PI * 2, x = rp.x + Math.cos(ang) * rad, y = rp.y + Math.sin(ang) * rad * 0.45;   // rings are flattened by perspective
        if (y < hz + 4 || y > shoreAt(x, t) - 3) continue;
        const c = Math.floor(x / cw), r = Math.floor(y / lh);
        if (c >= 0 && c < cols && r >= 0 && r < rows && !FG[r * cols + c]) O[r * cols + c] = age < RIPPLE_LIFE * 0.5 ? 79 : 111;   // never over a figure
      }
    }
    for (let i = prints.length - 1; i >= 0; i--) {
      const p = prints[i];
      if (t - p.t0 > PRINT_LIFE || shoreAt(p.x, t) + h * 0.01 >= p.y) { prints.splice(i, 1); continue; }
      const c = Math.floor(p.x / cw), r = Math.floor(p.y / lh);
      if (c >= 0 && c < cols && r > 0 && r < rows && !FG[r * cols + c] && !FG[(r - 1) * cols + c]) { O[r * cols + c] = 79; O[(r - 1) * cols + c] = 111; }
    }

    flush();
  }
  function flush() {
    // One line of text per row: fast, and the characters stay on the grid.
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        line += O[i] ? String.fromCharCode(O[i]) : RAMP[Math.max(0, Math.min(9, (B[i] * 10) | 0))];
      }
      ctx.fillText(line, 0, r * lh);
    }
  }

  let lastPlaced = 0;
  function frame(now) {
    raf = visible ? requestAnimationFrame(frame) : 0;
    if (now - last < 42) return;   // ~24 fps: plenty for slow water, easy on batteries
    last = now;
    if (now - lastPlaced > 30000) { placeBody(); lastPlaced = now; }
    draw(now / 1000);
  }

  readColor();
  size();

  if (reduceMotion) {
    draw(6);
  } else {
    raf = requestAnimationFrame(frame);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(canvas);

    // Passive listener, and no preventDefault: a finger on the beach still scrolls the page.
    window.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || x > r.width || y < 0 || y > r.height) { ptr.lastX = NaN; return; }
      if (Number.isNaN(ptr.lastX)) { ptr.lastX = x; ptr.lastY = y; }
      const dx = x - ptr.lastX, dy = y - ptr.lastY, len = Math.hypot(dx, dy);
      ptr.dist += len; ptr.lastX = x; ptr.lastY = y;

      const t = performance.now() / 1000, shore = shoreAt(x, t);
      if (y > shore + h * 0.02 && ptr.dist > 24 && len > 0) {
        ptr.foot = -ptr.foot; ptr.dist = 0;
        prints.push({ x: x + (-dy / len) * ptr.foot * 4, y: y + (dx / len) * ptr.foot * 4, t0: t });
        if (prints.length > 40) prints.shift();
      } else if (y > hz + 6 && y < shore - 6 && ptr.dist > 46) {
        ptr.dist = 0;
        ripples.push({ x, y, t0: t });
        if (ripples.length > 8) ripples.shift();
      }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { ptr.lastX = NaN; });
  }

  // ---- thought bubbles ------------------------------------------------------------
  // A random line from Hero.astro every 10-20 s while the beach is on screen, and a
  // new one (with a head scratch) whenever someone taps him.
  const bubble = canvas.parentElement.querySelector('.thought');
  const lines = [...canvas.parentElement.querySelectorAll('[data-thoughts] li')].map((li) => li.textContent.trim()).filter(Boolean);
  let lastLine = -1, hideTimer = 0, autoTimer = 0;
  function think() {
    if (!bubble || !lines.length) return;
    let i;
    do { i = Math.floor(Math.random() * lines.length); } while (i === lastLine && lines.length > 1);
    lastLine = i;
    bubble.classList.remove('is-on');
    bubble.textContent = lines[i];
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    const [headX, headY] = headAt();
    const left = Math.max(8, Math.min(w - bw - 8, headX - 28));
    const top = Math.max(8, headY - 70 * k - bh - 28);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.style.setProperty('--tail', `${Math.max(16, Math.min(bw - 16, headX - left))}px`);
    void bubble.offsetWidth;            // commit the hidden state so the fade-in runs
    bubble.classList.add('is-on');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => bubble.classList.remove('is-on'), 4800);
  }
  function scheduleThought() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (visible && !document.hidden) { scratchUntil = performance.now() / 1000 + 1.6; think(); }
      scheduleThought();
    }, 10000 + Math.random() * 10000);
  }
  const onMan = (e) => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const [x0, y0, x1, y1] = manBox();
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  };
  canvas.addEventListener('pointermove', (e) => { canvas.style.cursor = onMan(e) ? 'pointer' : ''; }, { passive: true });
  canvas.addEventListener('click', (e) => {
    if (!onMan(e)) return;
    scratchUntil = performance.now() / 1000 + 1.6;
    think();
    if (!reduceMotion) scheduleThought();   // tapping resets the automatic timer
  });
  if (!reduceMotion) setTimeout(() => { if (visible) { scratchUntil = performance.now() / 1000 + 1.6; think(); } scheduleThought(); }, 4000);

  // Resize is debounced to one rebuild per burst of events.
  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { size(); bubble?.classList.remove('is-on'); if (reduceMotion) draw(6); }, 120);
  }).observe(canvas);

  // Re-read the ink colour when the theme changes (button or system setting).
  const recolor = () => { readColor(); if (reduceMotion) draw(6); };
  new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);
}

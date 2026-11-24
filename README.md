# danielaburquez.com: site

The source for [danielaburquez.com](https://danielaburquez.com). It is a static
[Astro](https://astro.build) site, built into a hardened nginx container.

The site is half of a two-repo setup. This repo holds the **app**. A separate
`platform` repo holds the infrastructure (Terraform, Kubernetes manifests).
Keeping them apart is the GitOps pattern: a change to the site never directly
edits the cluster.

How the whole thing fits together is written up on the site itself at
`/how-this-site-works` (work in progress).

## Run it

Requirements: Node 22.23+ and Docker.

```sh
npm ci            # install exact dependency versions from package-lock.json
npm run dev       # dev server with hot reload at http://localhost:4321
npm run build     # static output in ./dist
```

### Run the production container locally

```sh
docker build -t dan-site:dev .
docker run -d --name dan-site -p 18080:8080 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --cap-drop=ALL --security-opt no-new-privileges \
  --pids-limit 100 --memory 64m \
  dan-site:dev
# open http://localhost:18080, then: docker rm -f dan-site
```

Those flags are the same hardening the Kubernetes `securityContext` will apply
later: no root, read-only filesystem, no Linux capabilities, resource caps.

## How it is built

| File | What it does |
|---|---|
| `Dockerfile` | Two stages. A Node stage builds the site; only the finished `dist/` is copied into a non-root nginx image. |
| `nginx.conf` | Serves the files. Everything nginx must write lives under `/tmp`, so the rest of the filesystem can stay read-only. |
| `security-headers.conf` | CSP, HSTS, `nosniff`, referrer and permissions policies. Each header is commented with why it is there. |
| `astro.config.mjs` | Turns off inlining of CSS, scripts and assets, so the CSP never needs `'unsafe-inline'`. |
| `src/styles/global.css` | The whole design system: tokens, ruled cells, type scale. Mobile-first; golden-ratio tokens (φ spacing steps, φ type steps for headings, 61.8/38.2 column splits); two themes: sun-yellow ground with sea-blue ink, and a warm off-white-on-near-black night theme (theme button or the device's dark mode). Fonts (Archivo at its widest for headlines, Newsreader, Martian Mono) are self-hosted npm packages, so the CSP needs no external font host. |
| `src/scripts/beach.js` | The hero: an El Nido beach (11°10′50″N 119°23′22″E) drawn as fine (5px) ASCII art at Palawan's real time of day (sunrise, high sun, sunset, crescent moon and stars at night; UTC+8, no library). A raised camera behind Dan: the horizon sits 30% down; the mainland headland closes the bay on the left (jungle with pale limestone cliffs, hazy with distance); karst islands sit on the right after a photo of El Nido's bay (a tall dome with a lower peak behind its shoulder, a rounded island with a sheer cliff, low islands far off, plus tiny ones on the horizon and two nearer ones out in the water). A diagonal shoreline has waves that curl, break and leave a wet shine; a bangka drifts across, riding the swell. Swaying palms stand on both sides at different depths (8 on desktop); their shadows swing with the time of day and their fronds never cover the sun or moon. Every 20-40 s a dolphin (sometimes a pair) leaps out of open water and dives back in with a splash, sliding under tail last; dolphins far out near the horizon are about a third the size of near ones. Shells lie on the dry sand, and crabs drawn from above (shell, eye stalks, pincers that open and close, stepping legs) scuttle sideways or dig in, peek out with their eyes and climb back out. Dan is reclined in a striped deck chair (golden 61.8% line; shapes measured from a reference photo of this camera angle) with one arm behind his head and a laptop on his lap whose screen types out made-up code. Every 10-20 s, or when he is tapped, he scratches his head and a thought bubble shows one of the lines in `src/components/Hero.astro`. Phones (under 48rem) don't show the beach at all: the script doesn't start there, and only the Palawan clock stays, as a row under the headline. A detailed ASCII scene needs a wide screen; three phone versions were tried and all read worse than no picture. Pointer: ripples on water, footprints on sand that waves wash away; neither is ever drawn over him, the chair, the palms or the boat. Decoration only: `aria-hidden`, passive listener, pauses off-screen, still frame under reduced motion. Add `?hour=6.5` (0-24) to the URL to preview another time of day. |
| `public/_headers` | The same security headers for the Cloudflare Pages copy of the site. `npm run check:headers` fails if it disagrees with `security-headers.conf`. |
| `public/theme.js` | Tiny same-origin script that re-applies a saved colour theme before first paint, so there is no flash. |
| `src/scripts/headline.js` | The headline's motion: in each word one letter at a time rolls out and back in (up, down, left or right) after a random pause of up to 2 s, and the star turns slowly and spins faster while the page scrolls. Letters are an `aria-hidden` copy; screen readers read the plain heading. Off under reduced motion. |
| `src/scripts/site.js` | Entry point for the small page enhancements, one module each: `clock.js` (Palawan time), `section-nav.js` (current-section highlight, phone "Email me" bar), `theme-toggle.js` (colour theme button), `logo.js` (rolling DAN letter), `strip.js` (platform strip fill-in), `planned-fold.js` (folds planned phases on phones). `roll.js` is the letter-roll helper shared with `headline.js`. |

## Deploy (Cloudflare Pages, until the cluster exists)

The live site is this build uploaded to the Cloudflare Pages project `danielaburquez`,
with `danielaburquez.com` and `www` attached as custom domains (proxied CNAMEs to
`danielaburquez.pages.dev`). `public/_headers` supplies the security headers.

```sh
npm run build && npm run check:evidence && npm run check:headers
npx wrangler pages deploy dist --project-name danielaburquez --branch main
```

## Rules this repo follows

- **No secrets in Git.** `gitleaks` runs before every commit (see below).
- **No inline `<script>` or `style=`.** The CSP is `default-src 'self'` and would block them. Put styles in `src/styles/` and scripts in `src/scripts/`.
- **Base images are pinned** to exact versions in the `Dockerfile`.

## Enable the secret-scan pre-commit hook (once per clone)

```sh
brew install gitleaks              # or see https://github.com/gitleaks/gitleaks
git config core.hooksPath .githooks
```

From then on, a commit that contains something that looks like a secret is
refused. To scan the whole working tree on demand: `gitleaks dir .`

## Adding or changing a client screenshot

Put the image in `src/assets/work/` (PNG or JPG, about 1440px wide) and
reference its file name in `src/pages/index.astro`. Astro converts it to
responsive WebP at build time. Optionally add a phone-shaped version (about
660 to 780px wide) and pass it as `mobileImage`; it is used on screens under 48rem.

## Keeping /how-this-site-works honest

The status list lives in `src/data/platform-status.ts` and feeds both the homepage strip and the engineering page. The "See the evidence" excerpts are copied word for word from files in this repo. After editing a file they quote (Dockerfile, README run flags, `security-headers.conf`, `.githooks/pre-commit`), run:

```sh
npm run check:evidence
```

It fails if an excerpt no longer matches its file. Moving an item from `planned` to `built` also means updating `asOf` in the same change.

// Keep this list honest (see platform/docs/brand-philosophy.md): an item moves
// from `planned` to `built` only once it works, and the date below is updated
// in the same change. The homepage strip and /how-this-site-works both read this file.
//
// `evidence` excerpts are copied word for word from files in this repo. Run
// `npm run check:evidence` after editing any of those files: it fails if an excerpt no
// longer matches. A line that is only "…" marks skipped lines.
export const asOf = '24 November 2026';

export interface Evidence { file: string; lines: string[] }
export interface Piece { phase: number; name: string; detail: string; evidence?: Evidence[] }

export const built: Piece[] = [
  {
    phase: 1,
    name: 'Static site, no moving parts',
    detail: 'Pages are built into plain files ahead of time. Nothing is generated per request, so there is far less to attack and to keep patched.',
    evidence: [
      {
        file: 'Dockerfile',
        lines: [
          'RUN npm run build',
          '…',
          'FROM nginxinc/nginx-unprivileged:1.30.6-alpine',
          'COPY --from=build /app/dist /usr/share/nginx/html',
        ],
      },
    ],
  },
  {
    phase: 1,
    name: 'Hardened container',
    detail: 'Runs as a non-root user with a read-only filesystem, no extra Linux privileges, and memory and process limits.',
    evidence: [
      { file: 'Dockerfile', lines: ['USER 101'] },
      {
        file: 'README.md',
        lines: [
          '  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m \\',
          '  --cap-drop=ALL --security-opt no-new-privileges \\',
          '  --pids-limit 100 --memory 64m \\',
        ],
      },
    ],
  },
  {
    phase: 1,
    name: 'Strict browser security headers',
    detail: 'A Content-Security-Policy that allows only this site\'s own files, plus HSTS and the usual anti-framing and referrer headers. No third-party scripts or fonts.',
    evidence: [
      {
        file: 'security-headers.conf',
        lines: [
          'add_header Content-Security-Policy "default-src \'self\'; img-src \'self\' data:; object-src \'none\'; base-uri \'none\'; form-action \'none\'; frame-ancestors \'none\'" always;',
          'add_header Strict-Transport-Security "max-age=31536000" always;',
          'add_header X-Content-Type-Options "nosniff" always;',
          'add_header X-Frame-Options "DENY" always;',
        ],
      },
    ],
  },
  {
    phase: 1,
    name: 'Secret scanning before every commit',
    detail: 'A pre-commit hook blocks any commit that looks like it contains a password, token or key.',
    evidence: [
      {
        file: '.githooks/pre-commit',
        lines: [
          'if ! command -v gitleaks >/dev/null 2>&1; then',
          '…',
          'exec gitleaks git --pre-commit --staged --redact --verbose',
        ],
      },
    ],
  },
  {
    phase: 1,
    name: 'Pinned versions',
    detail: 'Base images and dependencies are locked to exact versions, so builds stay predictable.',
    evidence: [
      {
        file: 'Dockerfile',
        lines: [
          'FROM node:22.23.5-alpine AS build',
          '…',
          'RUN npm ci',
          '…',
          'FROM nginxinc/nginx-unprivileged:1.30.6-alpine',
        ],
      },
    ],
  },
];

// Phases 2 to 8 of the plan, in order. Each is one piece of work.
export const planned: Piece[] = [
  { phase: 2, name: 'DNS and failover as code', detail: 'Cloudflare configuration in Terraform, with a static fallback if the home server is down.' },
  { phase: 3, name: 'Kubernetes at home', detail: 'k3s with a Cloudflare Tunnel, so no ports are opened on my router.' },
  { phase: 4, name: 'Automated checks and signed images', detail: 'Tests, vulnerability scans and a software bill of materials on every change, with the built image cryptographically signed.' },
  { phase: 5, name: 'GitOps deploys', detail: 'Argo CD applies what is in Git, so a deploy is a reviewed commit rather than a manual step.' },
  { phase: 6, name: 'Cluster hardening', detail: 'Admission policies, network policies, restricted pod security and encrypted secrets.' },
  { phase: 7, name: 'Monitoring and a public status page', detail: 'Metrics, logs and alerts, with a status page that stays up when the home server does not.' },
  { phase: 8, name: 'A tested rebuild', detail: 'Backups, and a timed destroy-and-rebuild drill, published with the real result.' },
];

// What phase 1 is called on the roadmap (the later phases are named by their one piece).
export const phase1Title = 'The site and its container';

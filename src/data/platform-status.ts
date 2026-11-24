// Keep this list honest (see platform/docs/brand-philosophy.md): an item moves
// from `planned` to `built` only once it works, and the date below is updated
// in the same change. The homepage strip and /how-this-site-works both read this file.
//
// `evidence` excerpts are copied word for word from files in this repo. Run
// `npm run check:evidence` after editing any of those files: it fails if an excerpt no
// longer matches. A line that is only "…" marks skipped lines.
export const asOf = '24 November 2026';

export interface Evidence { file: string; lines: string[] }
// `verify` is for pieces whose source lives in a private repository: instead of file
// excerpts, a command anyone can run against the live site, and what it should show.
export interface Verify { command: string; expect: string }
export interface Piece { phase: number; name: string; detail: string; evidence?: Evidence[]; verify?: Verify }

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
  {
    phase: 2,
    name: 'DNS as code',
    detail: 'The Cloudflare DNS records for this domain are described in Terraform, in a private repository, and each was imported as it already was. Comparing the files with the live zone reports no differences. Records that Cloudflare itself owns, such as the email signing key, are left out on purpose, so the two never fight over them.',
  },
  {
    phase: 2,
    name: 'Failover to Pages, tested',
    detail: 'A small Cloudflare Worker asks the home server first, and serves the same page from Cloudflare Pages if home errors or does not answer within two seconds. I tested it on a separate test address by stopping the container, then the tunnel: the page kept loading each time, and went back to home on restart. Visitors to danielaburquez.com are not routed through it yet.',
    verify: {
      command: 'curl -sI https://failover-test.danielaburquez.com | grep -i x-served-by',
      expect: 'Prints "x-served-by: home" normally, and "x-served-by: pages" while the home server is unreachable.',
    },
  },
  {
    phase: 3,
    name: 'A second copy at home, behind its own tunnel',
    detail: 'The same hardened container also runs on my home server. It publishes no ports and is reached only through a dedicated Cloudflare Tunnel, kept separate from the one my other home services use, so a mistake here cannot take them down.',
  },
];

// Phases 2 to 8 of the plan, in order. Each is one piece of work.
export const planned: Piece[] = [
  { phase: 2, name: 'Failover on the real address', detail: 'Move danielaburquez.com and www onto the failover Worker, set up so that if the Worker itself fails, traffic falls straight through to Pages.' },
  { phase: 3, name: 'Kubernetes at home', detail: 'k3s on the home server. Held back until that machine has memory to spare: it already runs other services, and Kubernetes on top would push it into swapping.' },
  { phase: 4, name: 'Automated checks and signed images', detail: 'Tests, vulnerability scans and a software bill of materials on every change, with the built image cryptographically signed.' },
  { phase: 5, name: 'GitOps deploys', detail: 'Argo CD applies what is in Git, so a deploy is a reviewed commit rather than a manual step.' },
  { phase: 6, name: 'Cluster hardening', detail: 'Admission policies, network policies, restricted pod security and encrypted secrets.' },
  { phase: 7, name: 'Monitoring and a public status page', detail: 'Metrics, logs and alerts, with a status page that stays up when the home server does not.' },
  { phase: 8, name: 'A tested rebuild', detail: 'Backups, and a timed destroy-and-rebuild drill, published with the real result.' },
];

// What each phase is called on the roadmap. A phase can hold built and planned pieces at once.
export const phaseTitles: Record<number, string> = {
  1: 'The site and its container',
  2: 'DNS and failover as code',
  3: 'The home server behind a tunnel',
  4: 'Automated checks and signed images',
  5: 'GitOps deploys',
  6: 'Cluster hardening',
  7: 'Monitoring and a public status page',
  8: 'A tested rebuild',
};

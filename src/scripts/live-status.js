// /how-this-site-works: live "who is serving this page right now", in two places:
//   - the badge under the intro (shown only when the failover Worker is in the path), and
//   - the line under the request-path diagram (always shown, with what is true today).
// Both come from one check: ask this same site for the current page (HEAD, never cached)
// and read the `x-served-by` header the failover Worker adds ("home" or "pages"). No
// header means the request did not go through the Worker, which today means Pages served
// it directly. Same-origin, so the CSP allows it and no third party is involved.
//
// It re-checks every minute while the tab is visible and again as soon as the tab comes
// back, and the "checked ... ago" age counts up between checks so it never looks fresher
// than it is. If a check fails (offline), the last result stays, with its growing age.

const badge = document.querySelector('[data-live]');
const line = document.querySelector('[data-live-line]');

if (badge || line) {
  const badgeText = badge?.querySelector('[data-live-text]');
  const SAYS = {
    home: { badge: 'This page is served by my home server.', line: 'Currently served by my home server' },
    pages: { badge: 'My home server is unreachable, so Cloudflare Pages is serving this page.', line: 'Currently served by Cloudflare Pages (my home server is unreachable)' },
    direct: { badge: '', line: 'Currently served by Cloudflare Pages directly, not through the Worker yet' },
  };
  let last = null;   // { by: 'home' | 'pages' | 'direct', at: Date.now() }

  const ago = (ms) => {
    const mins = Math.floor(ms / 60000);
    return mins < 1 ? 'just now' : mins === 1 ? '1 min ago' : `${mins} min ago`;
  };

  function render() {
    if (!last) return;
    const age = ago(Date.now() - last.at);
    if (line) line.textContent = `${SAYS[last.by].line}, checked ${age}.`;
    if (badge && badgeText) {
      badge.hidden = last.by === 'direct';
      badge.dataset.state = last.by;
      badgeText.textContent = `Right now: ${SAYS[last.by].badge} Checked ${age}.`;
    }
  }

  async function check() {
    try {
      const res = await fetch(location.pathname, { method: 'HEAD', cache: 'no-store' });
      const by = res.headers.get('x-served-by');
      last = { by: by === 'home' || by === 'pages' ? by : 'direct', at: Date.now() };
    } catch {
      // offline or blocked: keep the last known result and let its age grow
    }
    render();
  }

  check();
  setInterval(() => { if (!document.hidden) check(); }, 60000);
  setInterval(render, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}

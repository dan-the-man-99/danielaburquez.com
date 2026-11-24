// /how-this-site-works: each phase has a pinned ASCII picture in its left column
// (desktop and tablet only; see global.css). As you scroll through a phase's pieces,
// the picture for the piece in the middle of the screen is the one shown. Without
// JavaScript the first piece's picture simply stays. The per-line delay index is set
// here because the CSP blocks style="" attributes.

document.querySelectorAll('.phase').forEach((phase) => {
  const pieces = phase.querySelectorAll('[data-piece]');
  const arts = phase.querySelectorAll('.piece-art');
  if (!arts.length) return;

  arts.forEach((pre) => pre.querySelectorAll('.ln').forEach((ln, i) => ln.style.setProperty('--i', String(i))));
  if (pieces.length < 2 || !('IntersectionObserver' in window)) return;

  const show = (index) => arts.forEach((a) => a.classList.toggle('is-active', a.dataset.art === index));
  // A thin band a little above the middle of the screen: the piece crossing it is "current".
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) show(entry.target.dataset.piece);
  }, { rootMargin: '-35% 0px -55% 0px' });
  pieces.forEach((p) => watcher.observe(p));
});

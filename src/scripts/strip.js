// The platform strip ("Built step by step"): the built cells fill in once, left to
// right, the first time the strip scrolls into view. Armed here (not in CSS) so that
// without JavaScript the strip is just drawn filled; reduced motion is handled in
// the CSS. The per-cell delay index is set here too: the CSP blocks style="" attributes.
const strip = document.querySelector('[data-strip]');
if (strip) {
  strip.querySelectorAll('li').forEach((li, i) => li.style.setProperty('--i', String(i)));
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    strip.classList.add('is-armed');
    const once = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { strip.classList.add('is-in'); once.disconnect(); }
    }, { threshold: 0.6 });
    once.observe(strip);
  }
}

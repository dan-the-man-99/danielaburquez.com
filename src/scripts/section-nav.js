// Desktop rail and phone nav: highlight the section that is currently on screen.
// Also slides the phone-only "Email me" bar away while the contact section is
// visible, so it never covers the real contact details.
if ('IntersectionObserver' in window) {
  // A section counts as "current" while it crosses a line a bit above the middle of the screen.
  const MARGIN = '-35% 0px -60% 0px';
  const navLinks = [...document.querySelectorAll('.rail-index a[data-section], .cell-nav a[data-section]')];

  if (navLinks.length) {
    const mark = (id) => navLinks.forEach((a) => (a.dataset.section === id ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
    const ids = new Set(navLinks.map((a) => a.dataset.section));
    const sections = [...ids].map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: MARGIN });
    sections.forEach((s) => io.observe(s));
    // Above the first section (the hero), nothing is current.
    const hero = document.querySelector('.hero');
    if (hero) {
      new IntersectionObserver(([e]) => { if (e.isIntersecting && e.boundingClientRect.top > -50) mark(''); }, { rootMargin: MARGIN }).observe(hero);
    }
  }

  const bar = document.querySelector('.mobile-bar');
  const contact = document.getElementById('contact');
  if (bar && contact) {
    new IntersectionObserver(([entry]) => bar.classList.toggle('is-hidden', entry.isIntersecting), { threshold: 0.15 }).observe(contact);
  }
}

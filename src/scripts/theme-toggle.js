// Colour theme button: swaps the yellow and blue. Remembered in this browser
// only (see public/theme.js, which re-applies it before paint).
const toggle = document.querySelector('[data-theme-toggle]');
if (toggle) {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : system.matches);
  const sync = () => toggle.setAttribute('aria-pressed', String(isDark()));
  toggle.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* storage blocked: still works for this visit */ }
    sync();
  });
  system.addEventListener('change', sync);
  sync();
}

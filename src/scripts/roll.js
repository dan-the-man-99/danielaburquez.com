// Shared by the headline and the DAN logo: one letter slides out up, down, left
// or right and back in. The motion itself is the .ch / roll-* styles in global.css.
const DIRS = ['roll-up', 'roll-down', 'roll-left', 'roll-right'];

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Roll one random letter of `letters`, never the same one as last time.
// `prev` is the index rolled last; returns the index rolled now.
export function rollOne(letters, prev) {
  let i;
  do { i = Math.floor(Math.random() * letters.length); } while (i === prev && letters.length > 1);
  const el = letters[i];
  el.classList.remove(...DIRS);
  void el.offsetWidth;   // restart the animation if the class was just removed
  el.classList.add(DIRS[Math.floor(Math.random() * DIRS.length)]);
  el.addEventListener('animationend', () => el.classList.remove(...DIRS), { once: true });
  return i;
}

// The DAN logo: every few seconds one letter rolls out and back in, the same
// motion as the home page headline. Slower than the headline so the two never
// compete. Off for reduced motion.
import { prefersReducedMotion, rollOne } from './roll.js';

const logo = document.querySelector('[data-logo-roll]');
if (logo && !prefersReducedMotion()) {
  const letters = [...logo.querySelectorAll('.ch')];
  let prev = -1;
  const roll = () => {
    if (!document.hidden) prev = rollOne(letters, prev);
    setTimeout(roll, 2500 + Math.random() * 3000);
  };
  setTimeout(roll, 1500);
}

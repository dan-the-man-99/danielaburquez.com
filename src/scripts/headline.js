// The headline's two small motions. Both are off for reduced motion.
//
// 1. In each word, one letter at a time rolls: it slides out up, down, left or
//    right and the same letter slides back in from the other side. Each word
//    picks its next letter after a random pause of up to two seconds.
// 2. The star between the words turns slowly, and spins faster while the page
//    is being scrolled, settling back down when scrolling stops.

import { prefersReducedMotion, rollOne } from './roll.js';

const reduce = prefersReducedMotion();
const hero = document.querySelector('.hero');

if (!reduce && hero) {
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(hero);

  // 1. Rolling letters
  document.querySelectorAll('[data-roll]').forEach((word) => {
    const letters = [...word.querySelectorAll('.ch')];
    let prev = -1;
    const next = () => {
      setTimeout(() => {
        if (onScreen && !document.hidden) prev = rollOne(letters, prev);
        next();
      }, 500 + Math.random() * 1500);
    };
    next();
  });

  // 2. The star: a slow base turn plus a boost from scroll speed that eases off.
  const star = hero.querySelector('.star');
  if (star) {
    const BASE = 18;             // degrees per second when nothing is happening
    let angle = 0, boost = 0, lastY = scrollY, lastT = performance.now(), raf = 0;
    const tick = (now) => {
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const dy = Math.abs(scrollY - lastY);
      lastY = scrollY;
      if (dt > 0) boost = Math.max(boost * Math.exp(-dt * 2.5), Math.min(900, (dy / dt) * 0.9));
      angle = (angle + (BASE + boost) * dt) % 360;
      star.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      raf = onScreen ? requestAnimationFrame(tick) : 0;
    };
    raf = requestAnimationFrame(tick);
    // Restart the loop when the hero scrolls back into view.
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !raf) { lastT = performance.now(); lastY = scrollY; raf = requestAnimationFrame(tick); }
    }).observe(hero);
  }
}

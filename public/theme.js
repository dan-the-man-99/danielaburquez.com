// Runs before the page paints (loaded in <head>) so a visitor who chose a
// colour theme on an earlier visit never sees a flash of the other one.
try {
  var saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
} catch (e) { /* storage blocked: fall back to the system setting */ }

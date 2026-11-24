// /how-this-site-works: the planned phases are open in the HTML (so everything
// shows without JavaScript) and fold away on phones, where the built work should lead.
const fold = document.querySelector('.planned-fold');
if (fold) {
  const narrow = matchMedia('(max-width: 47.99rem)');
  const sync = () => { fold.open = !narrow.matches; };
  sync();
  narrow.addEventListener('change', sync);
}

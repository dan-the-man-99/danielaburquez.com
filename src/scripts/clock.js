// "It's 9:41 PM there right now": Dan's local time, so a client in another time
// zone knows when to expect a reply. Hidden in the HTML until this runs.
const timeEl = document.querySelector('[data-palawan-time]');
if (timeEl) {
  const format = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
  const show = () => { timeEl.textContent = format.format(new Date()); };
  show();
  timeEl.closest('[data-clock]')?.removeAttribute('hidden');
  setInterval(show, 30000);
}

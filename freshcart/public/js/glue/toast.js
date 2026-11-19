/** Bottom-center toast. Browser only (DOM glue, not unit tested). */
let timer = null;

export function showToast(message, ms = 4000) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.hidden = true;
  }, ms);
}

// Small UI helpers: icons, escaping, toasts, dialogs.
export { esc } from './highlight.js';

const P = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
  book: '<path d="M5 5.5c2.5-1 5-1 7 .5v13c-2-1.5-4.5-1.5-7-.5z"/><path d="M19 5.5c-2.5-1-5-1-7 .5v13c2-1.5 4.5-1.5 7-.5z"/>',
  puzzle: '<path d="M5 8h3.2a2 2 0 1 1 3.6 0H15v3.2a2 2 0 1 1 0 3.6V18H5z"/>',
  terminal: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="m7.5 10 2.5 2-2.5 2"/><path d="M12.5 14.5h4"/>',
  chart: '<path d="M4.5 19.5h15"/><path d="M7 16v-4"/><path d="M11 16V8"/><path d="M15 16v-6"/><path d="M19 16V5.5"/>',
  flame: '<path d="M12 20c-3.3 0-5.5-2.2-5.5-5.2 0-3.6 3.3-5.3 3.3-9.3 2.4 1.4 3.7 3.6 3.6 6 .9-.6 1.5-1.6 1.7-2.8 1.6 1.4 2.4 3.4 2.4 5.6 0 3.3-2.3 5.7-5.5 5.7z"/>',
  bolt: '<path d="M13 3.5 6 13.5h5.2L10.5 20.5 18 10h-5.4z"/>',
  check: '<path d="m5 12.5 4.2 4L19 7"/>',
  x: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  right: '<path d="M5 12h13"/><path d="m13 7 5 5-5 5"/>',
  left: '<path d="M19 12H6"/><path d="m11 7-5 5 5 5"/>',
  bulb: '<path d="M9 17.5h6"/><path d="M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.6.5 1 1.3 1 2.1h4.6c0-.8.4-1.6 1-2.1A5.5 5.5 0 0 0 12 3.5z"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  reset: '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5V9h4.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
  notes: '<path d="M6.5 3.5h8l3 3v14h-11z"/><path d="M9 10h6M9 13.5h6M9 17h4"/>',
  repeat: '<path d="M4.5 11V9a3 3 0 0 1 3-3h11"/><path d="m15.5 3 3 3-3 3"/><path d="M19.5 13v2a3 3 0 0 1-3 3h-11"/><path d="m8.5 21-3-3 3-3"/>',
  download: '<path d="M12 4v11"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15.5v-11"/><path d="M7.5 9 12 4.5 16.5 9"/><path d="M5 19.5h14"/>',
  trash: '<path d="M5 7h14"/><path d="M10 7V4.5h4V7"/><path d="M7 7l1 12.5h8L17 7"/>',
  target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r=".5"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
  code: '<path d="m8.5 7.5-4.5 4.5 4.5 4.5"/><path d="m15.5 7.5 4.5 4.5-4.5 4.5"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4.5 7h.5M4.5 12h.5M4.5 17h.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V5.5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.dot}</svg>`;
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

let toastTimer = null;
export function toast(msg, kind = '') {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.className = 'toast show ' + kind;
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

export function confirmDialog(message, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dialog';
    d.innerHTML = `<form method="dialog"><p>${message}</p><div class="row end"><button value="cancel" class="btn ghost">${cancel}</button><button value="ok" class="btn ${danger ? 'danger' : ''}">${ok}</button></div></form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => { resolve(d.returnValue === 'ok'); d.remove(); });
    if (d.showModal) d.showModal();
    else resolve(window.confirm(message));
  });
}

export function plural(n, word, pluralWord = word + 's') { return `${n} ${n === 1 ? word : pluralWord}`; }

export function shuffle(arr, seed = Math.random()) {
  const a = arr.slice();
  let s = Math.floor(seed * 2 ** 31) || 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function difficultyLabel(d) {
  return { warmup: 'Warm-up', easy: 'Easy', 'easy+': 'Easy+' }[d] || d;
}

import { store } from './store.js';
import { loadLanguage, LANGUAGES } from '../content/registry.js';
import { warmUp } from './run.js';
import { icon } from './ui.js';
import homeView from './views/home.js';
import learnView from './views/learn.js';
import lessonView from './views/lesson.js';
import practiceView from './views/practice.js';
import problemView from './views/problem.js';
import reviewView from './views/review.js';
import playgroundView from './views/playground.js';
import progressView from './views/progress.js';
import notesView from './views/notes.js';

const routes = [
  { re: /^\/?$/, view: homeView, nav: 'home' },
  { re: /^\/learn$/, view: learnView, nav: 'learn' },
  { re: /^\/lesson\/([\w-]+)$/, view: lessonView, nav: 'learn', keys: ['id'] },
  { re: /^\/practice$/, view: practiceView, nav: 'practice' },
  { re: /^\/problem\/([\w-]+)$/, view: problemView, nav: 'practice', keys: ['id'] },
  { re: /^\/review$/, view: reviewView, nav: 'home' },
  { re: /^\/playground$/, view: playgroundView, nav: 'playground' },
  { re: /^\/progress$/, view: progressView, nav: 'progress' },
  { re: /^\/notes$/, view: notesView, nav: 'learn' },
];

const NAV = [
  { id: 'home', label: 'Today', href: '#/', icon: 'home' },
  { id: 'learn', label: 'Learn', href: '#/learn', icon: 'book' },
  { id: 'practice', label: 'Problems', href: '#/practice', icon: 'puzzle' },
  { id: 'playground', label: 'Playground', href: '#/playground', icon: 'terminal' },
  { id: 'progress', label: 'Progress', href: '#/progress', icon: 'chart' },
];

const view = document.getElementById('view');
let cleanup = null;
let pack = null;

function shell() {
  const side = document.querySelector('.side-nav');
  const tab = document.querySelector('.tabbar');
  const items = NAV.map((n) => `<a href="${n.href}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join('');
  side.innerHTML = items;
  tab.innerHTML = items;
  const sel = document.querySelector('.lang-select');
  sel.innerHTML = LANGUAGES.map((l) => `<option value="${l.id}" ${l.available ? '' : 'disabled'}>${l.name}${l.available ? '' : ' (soon)'}</option>`).join('');
  sel.value = store.state.settings.lang;
  sel.addEventListener('change', () => { store.setSetting('lang', sel.value); location.reload(); });
}

function updateStats() {
  const streak = store.streak();
  const today = store.activeToday();
  document.querySelectorAll('[data-stat=streak]').forEach((el) => {
    el.textContent = streak;
    el.closest('.stat-chip').classList.toggle('lit', today);
    el.closest('.stat-chip').title = today ? `${streak}-day streak. You've practised today.` : `${streak}-day streak. Practise today to keep it going.`;
  });
  document.querySelectorAll('[data-stat=xp]').forEach((el) => { el.textContent = store.state.xp; });
}

async function route() {
  const hash = location.hash.replace(/^#/, '').split('#')[0] || '/';
  let match = null, params = {};
  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) { match = r; (r.keys || []).forEach((k, i) => { params[k] = m[i + 1]; }); break; }
  }
  if (!match) { location.hash = '#/'; return; }
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === match.nav));
  document.body.dataset.route = match.nav;
  view.innerHTML = '';
  view.className = 'view view-' + (match.view.name || match.nav);
  try {
    cleanup = await match.view({ root: view, pack, params, store });
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="panel"><h2>Something went wrong</h2><p class="muted">${String(e.message || e)}</p><p><a class="btn" href="#/">Go home</a></p></div>`;
  }
  if (!match.keepScroll) window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

async function boot() {
  shell();
  updateStats();
  store.subscribe(updateStats);
  try {
    pack = await loadLanguage(store.state.settings.lang);
  } catch (e) {
    store.setSetting('lang', 'java');
    pack = await loadLanguage('java');
  }
  window.addEventListener('hashchange', route);
  await route();
  document.body.classList.add('ready');
  setTimeout(warmUp, 800);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();

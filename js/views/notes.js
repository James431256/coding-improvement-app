import { icon, esc } from '../ui.js';
import { md } from '../md.js';

export default function notes({ root, pack }) {
  root.innerHTML = `
    <a class="back-link" href="#/learn">${icon('left')} Learn</a>
    <header class="page-head"><div class="kicker mono">All refreshers in one place</div><h1>Cheat sheet</h1>
      <p class="lede">Every lesson's notes, for quick look-ups while you code.</p></header>
    <nav class="toc panel"><div class="mini-label">Jump to</div><div class="chip-row">${pack.units.map((u) => `<a class="chip" href="#/notes#n-${u.id}">${esc(u.code)} ${esc(u.title)}</a>`).join('')}</div></nav>
    ${pack.units.map((u) => `<section class="notes-unit" id="n-${u.id}"><h2 class="section-title"><span class="mono">${esc(u.code)}</span> ${esc(u.title)}</h2>
      ${u.lessons.map((l) => `<details class="note-item panel"><summary><span class="mono muted">${l.num}</span> ${esc(l.title)}</summary><div class="prose">${md(l.notes)}</div><a class="btn ghost" href="#/lesson/${l.id}">Practise this ${icon('right')}</a></details>`).join('')}
    </section>`).join('')}`;
  const target = location.hash.split('#')[2];
  if (target) setTimeout(() => { const t = document.getElementById(target); if (t) t.scrollIntoView({ block: 'start' }); }, 30);
  root.querySelector('.toc').addEventListener('click', (ev) => {
    const a = ev.target.closest('a');
    if (!a) return;
    ev.preventDefault();
    const t = document.getElementById(a.getAttribute('href').split('#')[2]);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

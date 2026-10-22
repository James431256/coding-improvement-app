import { icon, esc, plural } from '../ui.js';
import { nextLesson } from './home.js';

export default function learn({ root, pack, store }) {
  const L = store.lang();
  const next = nextLesson(pack, store);
  root.innerHTML = `
    <header class="page-head">
      <div class="kicker mono">Java course · ${pack.units.length} units · ${pack.lessons.length} lessons</div>
      <h1>Learn</h1>
      <p class="lede">Work through in order, or jump to whatever you need. Each lesson starts with a short refresher.</p>
      <div class="row wrap">
        <a class="btn ghost" href="#/notes">${icon('notes')} Cheat sheet</a>
        <a class="btn ghost" href="#/review">${icon('repeat')} Review mistakes</a>
      </div>
    </header>
    ${pack.units.map((u) => {
      const d = u.lessons.filter((l) => L.lessons[l.id] && L.lessons[l.id].done).length;
      return `<section class="unit panel" id="${u.id}">
        <header class="unit-head">
          <div class="unit-code mono">${esc(u.code)}</div>
          <div class="unit-titles">
            <h2>${esc(u.title)}</h2>
            <p class="muted">${esc(u.blurb)}</p>
          </div>
          <div class="unit-progress mono" title="${d} of ${u.lessons.length} lessons done">${d}/${u.lessons.length}</div>
        </header>
        <ol class="lesson-list">
          ${u.lessons.map((l) => {
            const s = L.lessons[l.id];
            const isNext = next && next.id === l.id;
            const status = s && s.done ? 'done' : isNext ? 'next' : '';
            return `<li class="${status}"><a href="#/lesson/${l.id}">
              <span class="lesson-mark">${s && s.done ? icon('check') : `<span class="mono">${l.num}</span>`}</span>
              <span class="lesson-text"><span class="lesson-title">${esc(l.title)}</span><span class="lesson-sub">${esc(l.summary || '')}</span></span>
              <span class="lesson-meta">${s && s.done ? `<span class="score mono">${s.best}/${s.total}</span>` : isNext ? '<span class="pill next-pill">Next</span>' : `<span class="muted small">${plural(l.questions.length, 'q')}</span>`}</span>
            </a></li>`;
          }).join('')}
        </ol>
        ${u.problems.length ? `<div class="unit-problems"><span class="mini-label">Problems for this unit</span>
          <div class="chip-row">${u.problems.map((p) => {
            const solved = L.problems[p.id] && L.problems[p.id].solved;
            return `<a class="chip ${solved ? 'solved' : ''}" href="#/problem/${p.id}">${solved ? icon('check') : ''}${esc(p.title)}</a>`;
          }).join('')}</div></div>` : ''}
      </section>`;
    }).join('')}`;
  const target = location.hash.split('#')[2];
  if (target) setTimeout(() => { const t = document.getElementById(target); if (t) t.scrollIntoView({ block: 'start' }); }, 30);
}

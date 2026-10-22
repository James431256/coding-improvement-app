import { icon, esc, plural } from '../ui.js';
import { md } from '../md.js';
import { runSession } from './session.js';
import { TYPE_LABEL } from '../questions.js';

export default function lesson({ root, pack, params, store }) {
  const l = pack.lessonsById[params.id];
  if (!l) { root.innerHTML = '<div class="panel"><h2>Lesson not found</h2><a class="btn" href="#/learn">Back to Learn</a></div>'; return; }
  const unit = l.unit;
  const L = store.lang();
  const prev = L.lessons[l.id];
  store.setLast({ lesson: l.id });
  const types = [...new Set(l.questions.map((q) => q.type))];
  const idx = pack.lessons.indexOf(l);
  const nextL = pack.lessons[idx + 1];
  let cleanup = null;

  root.innerHTML = `
    <article class="lesson-intro">
      <a class="back-link" href="#/learn#${unit.id}">${icon('left')} ${esc(unit.code)} · ${esc(unit.title)}</a>
      <header class="page-head">
        <div class="kicker mono">Lesson ${l.num} of ${unit.lessons.length}${prev && prev.done ? ` · best ${prev.best}/${prev.total}` : ''}</div>
        <h1>${esc(l.title)}</h1>
        ${l.summary ? `<p class="lede">${esc(l.summary)}</p>` : ''}
      </header>
      <section class="notes panel">
        <div class="notes-label mono">Refresher</div>
        <div class="prose">${md(l.notes)}</div>
      </section>
      <div class="start-bar">
        <div class="start-meta">
          <b>${plural(l.questions.length, 'question')}</b>
          <span class="muted small">${types.map((t) => TYPE_LABEL[t]).join(' · ')}</span>
        </div>
        <button type="button" class="btn primary big start-btn">${prev && prev.done ? 'Practise again' : 'Start questions'} ${icon('right')}</button>
      </div>
    </article>`;

  root.querySelector('.start-btn').addEventListener('click', () => {
    window.scrollTo(0, 0);
    const items = l.questions.map((q, i) => ({ qid: `${l.id}:${i}`, q }));
    cleanup = runSession(root, {
      title: l.title,
      kicker: `${unit.code} · ${l.title}`,
      backHref: `#/lesson/${l.id}`,
      items,
      lang: pack.id,
      mode: 'lesson',
      onFinish: ({ right, total }) => {
        store.finishLesson(l.id, right, total);
        const probs = (l.problems || []).map((id) => pack.problemsById[id]).filter(Boolean);
        return {
          html: probs.length ? `<div class="after-problems"><div class="mini-label">Put it into practice</div>${probs.map((p) => `<a class="chip" href="#/problem/${p.id}">${icon('puzzle')} ${esc(p.title)}</a>`).join('')}</div>` : '',
          actions: `${nextL ? `<a class="btn primary" href="#/lesson/${nextL.id}">Next: ${esc(nextL.title)} ${icon('right')}</a>` : '<a class="btn primary" href="#/practice">On to the problems</a>'}
            <a class="btn ghost" href="#/learn#${unit.id}">Back to course</a>`,
        };
      },
    });
  });
  return () => { if (cleanup) cleanup(); };
}

import { icon, esc, shuffle } from '../ui.js';
import { runSession } from './session.js';

export default function review({ root, pack, store }) {
  const { due, later } = store.reviewQueue(Object.keys(pack.questionsById));
  if (!due.length) {
    root.innerHTML = `
      <header class="page-head"><div class="kicker mono">Review</div><h1>All caught up</h1>
      <p class="lede">${later.length ? `${later.length} question${later.length === 1 ? '' : 's'} will come back for another check once a bit of time has passed. That spacing helps it stick.` : 'When you get a question wrong it comes back here, and you clear it by getting it right on a later day.'}</p></header>
      <div class="row wrap"><a class="btn primary" href="#/learn">Keep learning ${icon('right')}</a><a class="btn ghost" href="#/practice">Try a problem</a></div>`;
    return;
  }
  const picked = shuffle(due).slice(0, 10);
  const items = picked.map((qid) => {
    const { q, lesson } = pack.questionsById[qid];
    return { qid, q, origin: `${lesson.unit.code} · ${lesson.title}` };
  });
  return runSession(root, {
    title: 'Review',
    kicker: `Review · ${due.length} due`,
    backHref: '#/',
    items,
    lang: pack.id,
    mode: 'review',
    onFinish: ({ right, total }) => {
      const left = store.reviewQueue(Object.keys(pack.questionsById)).due.length;
      return {
        heading: right === total ? 'Review cleared.' : 'Review done.',
        actions: `${left ? `<a class="btn primary" href="#/review" onclick="setTimeout(()=>dispatchEvent(new HashChangeEvent('hashchange')),0)">Keep going (${left} due)</a>` : ''}<a class="btn ${left ? 'ghost' : 'primary'}" href="#/">Home</a>`,
      };
    },
  });
}

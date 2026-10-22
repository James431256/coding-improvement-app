import { icon, esc } from '../ui.js';

export default function practice({ root, pack, store }) {
  const L = store.lang();
  const filters = { status: 'all', topic: 'all' };
  try { Object.assign(filters, JSON.parse(sessionStorage.getItem('practiceFilters') || '{}')); } catch (e) { /* ignore */ }
  const topics = [...new Set(pack.problems.map((p) => p.topic))];
  const solvedCount = pack.problems.filter((p) => L.problems[p.id] && L.problems[p.id].solved).length;

  root.innerHTML = `
    <header class="page-head">
      <div class="kicker mono">${solvedCount}/${pack.problems.length} solved</div>
      <h1>Problems</h1>
      <p class="lede">LeetCode-style problems, from warm-ups up to classic Easy questions. Write a method, run it against the tests, iterate.</p>
    </header>
    <div class="filters">
      <div class="seg" role="group" aria-label="Status">
        ${['all', 'todo', 'solved'].map((s) => `<button type="button" data-status="${s}" class="${filters.status === s ? 'on' : ''}">${{ all: 'All', todo: 'To do', solved: 'Solved' }[s]}</button>`).join('')}
      </div>
      <div class="chip-row topic-chips">
        <button type="button" class="chip ${filters.topic === 'all' ? 'on' : ''}" data-topic="all">All topics</button>
        ${topics.map((t) => `<button type="button" class="chip ${filters.topic === t ? 'on' : ''}" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </div>
    <div class="problem-table" role="list"></div>`;

  const table = root.querySelector('.problem-table');
  function draw() {
    const rows = pack.problems.filter((p) => {
      const s = L.problems[p.id];
      const solved = !!(s && s.solved);
      if (filters.status === 'todo' && solved) return false;
      if (filters.status === 'solved' && !solved) return false;
      if (filters.topic !== 'all' && p.topic !== filters.topic) return false;
      return true;
    });
    table.innerHTML = rows.length ? rows.map((p) => {
      const s = L.problems[p.id];
      const solved = s && s.solved;
      const tried = s && s.attempts > 0 && !solved;
      return `<a role="listitem" class="prow ${solved ? 'solved' : ''}" href="#/problem/${p.id}">
        <span class="prow-status" title="${solved ? 'Solved' : tried ? 'Attempted' : 'Not started'}">${solved ? icon('check') : tried ? '<i class="half"></i>' : '<i></i>'}</span>
        <span class="prow-num mono">${String(p.num).padStart(2, '0')}</span>
        <span class="prow-main"><span class="prow-title">${esc(p.title)}</span><span class="prow-blurb">${esc(p.blurb)}</span></span>
        <span class="prow-topic">${esc(p.topic)}</span>
        <span class="pill diff-${p.difficulty.replace('+', 'p')}">${esc(p.diffLabel)}</span>
      </a>`;
    }).join('') : '<p class="empty">Nothing matches that filter.</p>';
  }
  root.querySelector('.filters').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.status) filters.status = b.dataset.status;
    if (b.dataset.topic) filters.topic = b.dataset.topic;
    root.querySelectorAll('[data-status]').forEach((x) => x.classList.toggle('on', x.dataset.status === filters.status));
    root.querySelectorAll('[data-topic]').forEach((x) => x.classList.toggle('on', x.dataset.topic === filters.topic));
    try { sessionStorage.setItem('practiceFilters', JSON.stringify(filters)); } catch (e) { /* ignore */ }
    draw();
  });
  draw();
}

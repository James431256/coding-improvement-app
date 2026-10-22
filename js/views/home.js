import { icon, esc, plural } from '../ui.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night session';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

export function nextLesson(pack, store) {
  const L = store.lang();
  return pack.lessons.find((l) => !(L.lessons[l.id] && L.lessons[l.id].done)) || null;
}

export function nextProblem(pack, store) {
  const L = store.lang();
  const doneLessons = new Set(Object.keys(L.lessons).filter((k) => L.lessons[k].done));
  const ready = pack.problems.filter((p) => !(L.problems[p.id] && L.problems[p.id].solved));
  return ready.find((p) => !p.after || doneLessons.has(p.after)) || ready[0] || null;
}

export default function home({ root, pack, store }) {
  const L = store.lang();
  const lessonsDone = pack.lessons.filter((l) => L.lessons[l.id] && L.lessons[l.id].done).length;
  const solved = pack.problems.filter((p) => L.problems[p.id] && L.problems[p.id].solved).length;
  const next = nextLesson(pack, store);
  const nextUnit = next ? pack.units.find((u) => u.lessons.includes(next)) : null;
  const review = store.reviewQueue(Object.keys(pack.questionsById));
  const prob = nextProblem(pack, store);
  const xpToday = store.xpToday();
  const goal = store.state.settings.dailyGoal;
  const pct = Math.min(100, Math.round((xpToday / goal) * 100));
  const fresh = Object.keys(L.questions).length === 0;
  const streak = store.streak();

  root.innerHTML = `
    <header class="page-head">
      <div class="kicker mono">${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <h1>${fresh ? 'Let\'s get your Java back.' : `${greeting()}. ${streak > 1 ? `Day ${streak} of your streak.` : 'Good to see you.'}`}</h1>
    </header>

    <div class="home-grid">
      <section class="panel continue-card">
        ${next ? `
          <div class="kicker mono">${fresh ? 'Start here' : 'Up next'} · ${esc(nextUnit.code)} · Lesson ${next.num}</div>
          <h2>${esc(next.title)}</h2>
          <p class="muted">${esc(next.summary || '')}</p>
          <div class="row">
            <a class="btn primary big" href="#/lesson/${next.id}">${fresh ? 'Start lesson 1' : 'Continue'} ${icon('right')}</a>
            <span class="muted small">${plural(next.questions.length, 'question')}</span>
          </div>` : `
          <div class="kicker mono">Course complete</div>
          <h2>You've finished every lesson.</h2>
          <p class="muted">Keep sharp with the problem set and your review queue.</p>
          <a class="btn primary big" href="#/practice">Go to problems ${icon('right')}</a>`}
      </section>

      <section class="panel goal-card">
        <div class="ring" style="--p:${pct}">
          <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" class="ring-bg"/><circle cx="18" cy="18" r="15.5" class="ring-fg" pathLength="100" stroke-dasharray="${pct} 100"/></svg>
          <div class="ring-label"><b class="mono">${xpToday}</b><span>/ ${goal} XP</span></div>
        </div>
        <div>
          <div class="kicker mono">Today's goal</div>
          <p>${pct >= 100 ? 'Goal hit. Anything more is a bonus.' : xpToday ? `${goal - xpToday} XP to go. About ${Math.ceil((goal - xpToday) / 10)} correct answers.` : 'About 3 correct answers gets you there.'}</p>
        </div>
      </section>

      <section class="panel review-card ${review.due.length ? 'has-due' : ''}">
        <div class="kicker mono">${icon('repeat')} Review</div>
        ${review.due.length
          ? `<h3>${plural(review.due.length, 'question')} to review</h3><p class="muted">Questions you got wrong earlier. Get them right to clear them.</p><a class="btn" href="#/review">Start review</a>`
          : `<h3>Nothing due</h3><p class="muted">${review.later.length ? `${plural(review.later.length, 'question')} will come back for another check later.` : 'Questions you miss will show up here.'}</p>`}
      </section>

      <section class="panel problem-card">
        <div class="kicker mono">${icon('puzzle')} Problem to try</div>
        ${prob ? `<h3>${esc(prob.title)}</h3><p class="muted">${esc(prob.blurb)}</p>
          <div class="row"><span class="pill diff-${prob.difficulty.replace('+', 'p')}">${esc(prob.diffLabel)}</span><a class="btn" href="#/problem/${prob.id}">Open</a></div>`
          : '<h3>All problems solved.</h3><p class="muted">Impressive. Try the playground or redo old ones from memory.</p>'}
      </section>
    </div>

    ${fresh ? `
    <section class="panel intro">
      <h2>How this works</h2>
      <ol class="steps">
        <li><b>Short lessons.</b> Each one opens with a quick refresher, then 6 to 9 questions of different kinds: predict the output, fill the blank, spot the bug, put lines in order, and writing real code.</li>
        <li><b>Climbs to LeetCode.</b> Units go from syntax and strings, through collections and Big-O, up to linked lists, trees and classic Easy problems.</li>
        <li><b>Real code runs.</b> Your Java runs right here in the browser against test cases. No install, works on your phone.</li>
        <li><b>Mistakes come back.</b> Anything you miss lands in a review queue so it sticks.</li>
      </ol>
      <p class="muted small">Progress saves automatically in this browser. To move it between your phone and laptop, use Export / Import on the Progress page.</p>
    </section>` : ''}

    <section class="stats-strip">
      <div><b class="mono">${lessonsDone}<small>/${pack.lessons.length}</small></b><span>lessons</span></div>
      <div><b class="mono">${solved}<small>/${pack.problems.length}</small></b><span>problems solved</span></div>
      <div><b class="mono">${streak}</b><span>day streak</span></div>
      <div><b class="mono">${store.state.xp}</b><span>total XP</span></div>
    </section>

    <section class="path">
      <h2 class="section-title">The path</h2>
      <ol class="path-list">
        ${pack.units.map((u) => {
          const d = u.lessons.filter((l) => L.lessons[l.id] && L.lessons[l.id].done).length;
          const state = d === u.lessons.length ? 'complete' : d > 0 || (next && u.lessons.includes(next)) ? 'current' : '';
          return `<li class="${state}"><a href="#/learn#${u.id}">
            <span class="path-code mono">${esc(u.code)}</span>
            <span class="path-title">${esc(u.title)}</span>
            <span class="path-bar"><i style="width:${(d / u.lessons.length) * 100}%"></i></span>
            <span class="path-count mono">${d}/${u.lessons.length}</span></a></li>`;
        }).join('')}
      </ol>
    </section>`;
}

import { icon, esc, confirmDialog, toast } from '../ui.js';

function heatmap(store, weeks = 18) {
  const act = store.state.activity;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1) - ((end.getDay() + 6) % 7 === 6 ? 0 : 0));
  // align to Monday
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);
  let cells = '';
  const d = new Date(start);
  let max = 1;
  for (const k of Object.keys(act)) if (!k.startsWith('xp:')) max = Math.max(max, act[k]);
  while (d <= end) {
    const key = store.today(d);
    const v = act[key] || 0;
    const lvl = v === 0 ? 0 : v < max * 0.25 ? 1 : v < max * 0.5 ? 2 : v < max * 0.75 ? 3 : 4;
    cells += `<i class="l${lvl}" title="${key}: ${v} answer${v === 1 ? '' : 's'}"></i>`;
    d.setDate(d.getDate() + 1);
  }
  return `<div class="heatmap" aria-label="Activity over the last ${weeks} weeks">${cells}</div>`;
}

export default function progress({ root, pack, store }) {
  const L = store.lang();
  const qs = Object.values(L.questions);
  const answered = qs.length;
  const firstRight = qs.filter((q) => q.first).length;
  const acc = answered ? Math.round((firstRight / answered) * 100) : 0;
  const solved = pack.problems.filter((p) => L.problems[p.id] && L.problems[p.id].solved).length;
  const lessonsDone = pack.lessons.filter((l) => L.lessons[l.id] && L.lessons[l.id].done).length;
  const review = store.reviewQueue(Object.keys(pack.questionsById));

  // accuracy by question type
  const byType = {};
  for (const [qid, s] of Object.entries(L.questions)) {
    const entry = pack.questionsById[qid];
    if (!entry) continue;
    const t = entry.q.type;
    byType[t] = byType[t] || { n: 0, ok: 0 };
    byType[t].n++;
    if (s.first) byType[t].ok++;
  }
  const typeNames = { mcq: 'Multiple choice', multi: 'Select all', output: 'Predict output', fill: 'Fill blanks', bug: 'Spot the bug', order: 'Put in order', code: 'Write code' };

  root.innerHTML = `
    <header class="page-head"><div class="kicker mono">Since ${new Date(store.state.created).toLocaleDateString()}</div><h1>Progress</h1></header>
    <section class="tiles">
      <div class="tile"><span class="tile-k">Streak</span><b class="mono">${store.streak()}</b><span class="tile-s">${store.streak() === 1 ? 'day' : 'days'}</span></div>
      <div class="tile"><span class="tile-k">XP</span><b class="mono">${store.state.xp}</b><span class="tile-s">total</span></div>
      <div class="tile"><span class="tile-k">Lessons</span><b class="mono">${lessonsDone}<small>/${pack.lessons.length}</small></b><span class="tile-s">complete</span></div>
      <div class="tile"><span class="tile-k">Problems</span><b class="mono">${solved}<small>/${pack.problems.length}</small></b><span class="tile-s">solved</span></div>
      <div class="tile"><span class="tile-k">First-try</span><b class="mono">${acc}<small>%</small></b><span class="tile-s">of ${answered} questions</span></div>
      <div class="tile"><span class="tile-k">Review</span><b class="mono">${review.due.length}</b><span class="tile-s">due now</span></div>
    </section>

    <section class="panel">
      <h2 class="section-title">Activity</h2>
      ${heatmap(store)}
      <div class="heat-legend muted small">Less <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More</div>
    </section>

    <div class="two-col">
      <section class="panel">
        <h2 class="section-title">By unit</h2>
        <ul class="bars">
          ${pack.units.map((u) => {
            const d = u.lessons.filter((l) => L.lessons[l.id] && L.lessons[l.id].done).length;
            return `<li><span class="bar-label"><span class="mono">${esc(u.code)}</span> ${esc(u.title)}</span><span class="bar"><i style="width:${(d / u.lessons.length) * 100}%"></i></span><span class="mono small">${d}/${u.lessons.length}</span></li>`;
          }).join('')}
        </ul>
      </section>
      <section class="panel">
        <h2 class="section-title">First-try accuracy by question type</h2>
        ${Object.keys(byType).length ? `<ul class="bars">${Object.entries(byType).map(([t, v]) => `<li><span class="bar-label">${typeNames[t] || t}</span><span class="bar"><i style="width:${(v.ok / v.n) * 100}%"></i></span><span class="mono small">${Math.round((v.ok / v.n) * 100)}%</span></li>`).join('')}</ul>
          <p class="muted small">Your weakest type is worth extra attention. Predicting output is great for catching gaps.</p>`
          : '<p class="muted">Answer a few questions and this fills in.</p>'}
      </section>
    </div>

    <section class="panel backup">
      <h2 class="section-title">Your data</h2>
      <p class="muted">Progress lives in this browser on this device. To carry it between your phone and laptop, export it on one and import it on the other. You can send it as a file or copy it as text.</p>
      <div class="row wrap">
        <button type="button" class="btn export-btn">${icon('download')} Export file</button>
        <button type="button" class="btn ghost copy-btn">${icon('copy')} Copy as text</button>
        <label class="btn ghost import-label">${icon('upload')} Import file<input type="file" accept="application/json,.json,.txt" class="import-file" hidden></label>
        <button type="button" class="btn ghost paste-btn">Paste text…</button>
      </div>
      <div class="paste-area" hidden>
        <textarea rows="4" placeholder="Paste exported progress here"></textarea>
        <div class="row"><button type="button" class="btn do-paste">Import</button></div>
      </div>
      <hr>
      <div class="row wrap between">
        <label class="goal-set">Daily goal
          <select class="goal-select">${[20, 30, 50, 80, 120].map((g) => `<option value="${g}" ${store.state.settings.dailyGoal === g ? 'selected' : ''}>${g} XP</option>`).join('')}</select>
        </label>
        <button type="button" class="btn danger ghost reset-btn">${icon('trash')} Reset all progress</button>
      </div>
    </section>`;

  root.querySelector('.export-btn').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `recompile-progress-${store.today()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  root.querySelector('.copy-btn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(store.exportJSON()); toast('Copied. Paste it on your other device.', 'good'); } catch (e) { toast('Copy failed. Use Export file instead.', 'bad'); }
  });
  const doImport = async (text) => {
    if (!(await confirmDialog('Replace the progress on this device with the imported data?', { ok: 'Import', danger: true }))) return;
    try { store.importJSON(text); toast('Progress imported.', 'good'); location.reload(); } catch (e) { toast(e.message, 'bad'); }
  };
  root.querySelector('.import-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    if (f) doImport(await f.text());
    ev.target.value = '';
  });
  root.querySelector('.paste-btn').addEventListener('click', () => { root.querySelector('.paste-area').hidden = false; root.querySelector('.paste-area textarea').focus(); });
  root.querySelector('.do-paste').addEventListener('click', () => doImport(root.querySelector('.paste-area textarea').value));
  root.querySelector('.goal-select').addEventListener('change', (ev) => { store.setSetting('dailyGoal', +ev.target.value); toast('Daily goal updated.'); });
  root.querySelector('.reset-btn').addEventListener('click', async () => {
    if (await confirmDialog('Delete all progress, XP and saved code on this device? This can\'t be undone.', { ok: 'Delete everything', danger: true })) {
      store.reset();
      location.hash = '#/';
      location.reload();
    }
  });
}

import { icon, esc, confirmDialog, toast } from '../ui.js';
import { md, codeBlock } from '../md.js';
import { createEditor } from '../editor.js';
import { runTests } from '../run.js';
import { renderTestResults } from './testresults.js';
import { fmtValue, parseSignature } from '../java/runner.js';

export default function problem({ root, pack, params, store }) {
  const p = pack.problemsById[params.id];
  if (!p) { root.innerHTML = '<div class="panel"><h2>Problem not found</h2><a class="btn" href="#/practice">All problems</a></div>'; return; }
  const st = store.problem(p.id);
  const idx = pack.problems.indexOf(p);
  const prevP = pack.problems[idx - 1], nextP = pack.problems[idx + 1];
  const sig = parseSignature(p.signature);
  let hintsShown = 0;

  root.innerHTML = `
    <div class="problem-layout">
      <section class="problem-desc">
        <a class="back-link" href="#/practice">${icon('left')} Problems</a>
        <div class="kicker mono">#${String(p.num).padStart(2, '0')} · ${esc(p.topic)}</div>
        <h1>${esc(p.title)} ${st.solved ? `<span class="solved-stamp">${icon('check')} Solved</span>` : ''}</h1>
        <div class="row wrap tags"><span class="pill diff-${p.difficulty.replace('+', 'p')}">${esc(p.diffLabel)}</span>${p.leetcode ? `<span class="pill ghost-pill" title="This is a well-known LeetCode problem">LeetCode #${p.leetcode}</span>` : ''}</div>
        <div class="prose">${md(p.description)}</div>
        <div class="examples">
          ${p.examples.map((ti, k) => {
            const t = p.tests[ti];
            return `<div class="example"><div class="mini-label">Example ${k + 1}</div>
              <div class="kv"><span class="k">Input</span><span class="v mono">${sig.params.map((pp, i) => `${esc(pp.name)} = ${esc(fmtValue(t.args[i]))}`).join(', ')}</span></div>
              <div class="kv"><span class="k">Output</span><span class="v mono">${esc(fmtValue(t.expected))}</span></div>
              ${t.why ? `<div class="kv"><span class="k">Why</span><span class="v">${md(t.why).replace(/^<p>|<\/p>$/g, '')}</span></div>` : ''}
            </div>`;
          }).join('')}
        </div>
        ${p.constraints ? `<div class="constraints"><div class="mini-label">Constraints</div>${md(p.constraints)}</div>` : ''}
        <div class="hints">
          <div class="hint-list"></div>
          <div class="row wrap">
            <button type="button" class="btn ghost hint-btn">${icon('bulb')} Hint (${p.hints.length})</button>
            <button type="button" class="btn ghost sol-btn">${icon('eye')} Solution</button>
          </div>
          <div class="solution-box" hidden></div>
        </div>
        <nav class="prob-nav">
          ${prevP ? `<a href="#/problem/${prevP.id}">${icon('left')} ${esc(prevP.title)}</a>` : '<span></span>'}
          ${nextP ? `<a href="#/problem/${nextP.id}">${esc(nextP.title)} ${icon('right')}</a>` : ''}
        </nav>
      </section>
      <section class="problem-work">
        <div class="work-bar">
          <span class="mini-label">${esc(pack.name)} · Solution.java</span>
          <div class="row">
            <button type="button" class="icon-btn reset-btn" title="Reset to starter code" aria-label="Reset code">${icon('reset')}</button>
            <button type="button" class="btn primary run-btn">${icon('play')} Run tests</button>
          </div>
        </div>
        <div class="problem-editor"></div>
        <div class="kbd-hint muted small">Ctrl/⌘ + Enter runs the tests</div>
        <div class="problem-results"></div>
      </section>
    </div>`;

  const ed = createEditor(root.querySelector('.problem-editor'), {
    value: st.code || p.starter,
    minLines: 14,
    label: `Code for ${p.title}`,
    onChange: (v) => store.saveCode(p.id, v),
    onRun: () => run(),
  });
  const results = root.querySelector('.problem-results');
  const runBtn = root.querySelector('.run-btn');

  async function run() {
    if (runBtn.disabled) return;
    runBtn.disabled = true;
    results.innerHTML = `<div class="running">${icon('play')} Running ${p.tests.length} tests…</div>`;
    const res = await runTests(ed.value, { lang: pack.id, problem: p.id });
    runBtn.disabled = false;
    results.innerHTML = '';
    results.appendChild(renderTestResults(res, p));
    const errLine = res.compileError ? res.compileError.line : (res.results.find((r) => r.error) || {}).error?.line;
    ed.markLine(errLine);
    const all = !res.compileError && res.total > 0 && res.passed === res.total;
    const first = store.markRun(p.id, all);
    if (all) {
      if (first) {
        store.addXp(p.xp);
        toast(`Solved! +${p.xp} XP`, 'good');
        const h1 = root.querySelector('h1');
        if (!h1.querySelector('.solved-stamp')) h1.insertAdjacentHTML('beforeend', ` <span class="solved-stamp fresh">${icon('check')} Solved</span>`);
      }
      results.insertAdjacentHTML('beforeend', `<div class="after-solve">${p.explain ? `<div class="mini-label">Why this works</div><div class="prose">${md(p.explain)}</div>` : ''}
        ${nextP ? `<a class="btn primary" href="#/problem/${nextP.id}">Next problem: ${esc(nextP.title)} ${icon('right')}</a>` : ''}</div>`);
    }
    if (window.matchMedia('(max-width: 900px)').matches) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  runBtn.addEventListener('click', run);

  root.querySelector('.reset-btn').addEventListener('click', async () => {
    if (await confirmDialog('Replace your code with the starter code?', { ok: 'Reset', danger: true })) {
      ed.value = p.starter;
      store.saveCode(p.id, p.starter);
    }
  });

  const hintList = root.querySelector('.hint-list');
  const hintBtn = root.querySelector('.hint-btn');
  hintBtn.addEventListener('click', () => {
    if (hintsShown >= p.hints.length) return;
    hintList.insertAdjacentHTML('beforeend', `<div class="hint"><span class="mini-label">Hint ${hintsShown + 1}</span>${md(p.hints[hintsShown])}</div>`);
    hintsShown++;
    hintBtn.innerHTML = hintsShown >= p.hints.length ? `${icon('bulb')} No more hints` : `${icon('bulb')} Another hint (${p.hints.length - hintsShown} left)`;
    hintBtn.disabled = hintsShown >= p.hints.length;
  });

  root.querySelector('.sol-btn').addEventListener('click', async () => {
    const box = root.querySelector('.solution-box');
    if (!box.hidden) { box.hidden = true; return; }
    if (!st.solved && !(await confirmDialog('Show the solution? Giving it a real try first is how it sticks, even if you don\'t finish.', { ok: 'Show it' }))) return;
    box.innerHTML = `<div class="mini-label">Solution · ${esc(p.complexity || '')}</div>${codeBlock(p.solution)}${p.explain ? `<div class="prose">${md(p.explain)}</div>` : ''}`;
    box.hidden = false;
  });
}

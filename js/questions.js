// Renderers for each question type. Each returns { el, ready(), check(), answerHtml(), focus() }.
import { md, codeBlock } from './md.js';
import { highlight, esc } from './highlight.js';
import { createEditor } from './editor.js';
import { runTests } from './run.js';
import { icon, shuffle } from './ui.js';
import { renderTestResults } from './views/testresults.js';

export const TYPE_LABEL = {
  mcq: 'Multiple choice',
  multi: 'Select all that apply',
  output: 'Predict the output',
  fill: 'Fill in the blanks',
  bug: 'Spot the bug',
  order: 'Put in order',
  code: 'Write the code',
};

export function normOutput(s) {
  return String(s).replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');
}
function normCode(s) {
  return String(s).trim().replace(/\s+/g, ' ');
}
function squash(s) {
  return String(s).replace(/\s+/g, '');
}
function stripSemi(s) { return s.replace(/;$/, ''); }

export function renderQuestion(q, { lang = 'java', qid, onReady, seed = Math.random() } = {}) {
  const make = {
    mcq: mcq, multi: mcq, output, fill, bug, order, code,
  }[q.type];
  if (!make) throw new Error('Unknown question type ' + q.type);
  const r = make(q, { lang, qid, onReady: onReady || (() => {}), seed });
  r.el.classList.add('question', 'q-' + q.type);
  return r;
}

function head(q) {
  const label = TYPE_LABEL[q.type];
  return `<div class="q-type">${label}</div><div class="q-prompt">${md(q.prompt || defaultPrompt(q))}</div>`;
}
function defaultPrompt(q) {
  switch (q.type) {
    case 'output': return 'What does this print?';
    case 'bug': return 'Tap the line that contains the bug.';
    case 'order': return 'Tap the lines in the right order to build a working program.';
    default: return '';
  }
}

// ---------- multiple choice ----------
function mcq(q, { onReady, seed }) {
  const multi = q.type === 'multi';
  const order = q.shuffle === false ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i), seed);
  const el = document.createElement('div');
  el.innerHTML = `${head(q)}${q.code ? codeBlock(q.code) : ''}
    <div class="options ${multi ? 'multi' : ''}" role="${multi ? 'group' : 'radiogroup'}">
      ${order.map((oi, k) => `<button type="button" class="option" data-i="${oi}" role="${multi ? 'checkbox' : 'radio'}" aria-checked="false">
        <span class="opt-key">${String.fromCharCode(65 + k)}</span><span class="opt-text">${optionHtml(q.options[oi])}</span></button>`).join('')}
    </div>`;
  const chosen = new Set();
  const buttons = [...el.querySelectorAll('.option')];
  function toggle(b) {
    if (el.classList.contains('locked')) return;
    const i = +b.dataset.i;
    if (multi) {
      if (chosen.has(i)) chosen.delete(i); else chosen.add(i);
    } else {
      chosen.clear();
      chosen.add(i);
    }
    buttons.forEach((x) => {
      const on = chosen.has(+x.dataset.i);
      x.classList.toggle('chosen', on);
      x.setAttribute('aria-checked', String(on));
    });
    onReady(chosen.size > 0);
  }
  buttons.forEach((b) => b.addEventListener('click', () => toggle(b)));
  const correctSet = new Set(multi ? q.answers : [q.answer]);
  return {
    el,
    ready: () => chosen.size > 0,
    key(k) {
      const idx = k.toUpperCase().charCodeAt(0) - 65;
      const n = /^[1-9]$/.test(k) ? +k - 1 : idx;
      if (n >= 0 && n < buttons.length) { toggle(buttons[n]); return true; }
      return false;
    },
    async check() {
      el.classList.add('locked');
      const correct = chosen.size === correctSet.size && [...chosen].every((i) => correctSet.has(i));
      buttons.forEach((b) => {
        const i = +b.dataset.i;
        if (correctSet.has(i)) b.classList.add('is-correct');
        else if (chosen.has(i)) b.classList.add('is-wrong');
      });
      return { correct };
    },
    answerHtml: () => '',
    focus() { buttons[0] && buttons[0].focus({ preventScroll: true }); },
  };
}
function optionHtml(o) {
  if (typeof o === 'string' && o.startsWith('```')) return codeBlock(o.replace(/^```\w*\n?|```$/g, '').trim(), 'inline');
  if (typeof o === 'string' && /^`[^`]+`$/.test(o)) return `<code>${esc(o.slice(1, -1))}</code>`;
  return md(String(o)).replace(/^<p>|<\/p>$/g, '');
}

// ---------- predict the output ----------
function output(q, { onReady }) {
  const el = document.createElement('div');
  const lines = normOutput(Array.isArray(q.answer) ? q.answer[0] : q.answer).split('\n').length;
  el.innerHTML = `${head(q)}${codeBlock(q.code)}
    <label class="out-label" for="out-${q.__id}">Output</label>
    <div class="console-input"><span class="prompt-mark" aria-hidden="true">&gt;</span>
    <textarea id="out-${q.__id}" class="out-answer" rows="${Math.max(1, Math.min(lines, 8))}" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder="${lines > 1 ? 'Type each line of output…' : 'Type the output…'}"></textarea></div>
    ${lines > 1 ? `<div class="hint-line">${lines} lines of output</div>` : ''}`;
  const ta = el.querySelector('textarea');
  ta.addEventListener('input', () => onReady(ta.value.trim().length > 0));
  ta.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && lines === 1) { ev.preventDefault(); ta.dispatchEvent(new CustomEvent('submit-answer', { bubbles: true })); }
  });
  const answers = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(normOutput);
  return {
    el,
    ready: () => ta.value.trim().length > 0,
    async check() {
      ta.readOnly = true;
      const given = normOutput(ta.value);
      const correct = answers.includes(given) || answers.some((a) => a.replace(/[ \t]+/g, ' ') === given.replace(/[ \t]+/g, ' '));
      el.classList.add(correct ? 'was-correct' : 'was-wrong');
      return { correct };
    },
    answerHtml: () => `<div class="expected-out"><div class="mini-label">Actual output</div><pre class="console">${esc(answers[0])}</pre></div>`,
    focus() { ta.focus({ preventScroll: true }); },
  };
}

// ---------- fill in the blanks ----------
function fill(q, { onReady }) {
  const el = document.createElement('div');
  const parts = q.code.split('___');
  const blanks = q.blanks.map((b) => (Array.isArray(b) ? b : [b]));
  let html = '';
  parts.forEach((p, i) => {
    html += highlight(p);
    if (i < parts.length - 1) {
      const w = Math.max(3, ...blanks[i].map((a) => a.length)) + 1;
      html += `<input class="blank" data-b="${i}" style="width:${w + 1}ch" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Blank ${i + 1}">`;
    }
  });
  el.innerHTML = `${head(q)}<pre class="code fill-code"><code>${html}</code></pre>`;
  const inputs = [...el.querySelectorAll('input.blank')];
  const isReady = () => inputs.every((x) => x.value.trim().length > 0);
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => onReady(isReady()));
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (i < inputs.length - 1 && !inputs[i + 1].value) inputs[i + 1].focus();
        else inp.dispatchEvent(new CustomEvent('submit-answer', { bubbles: true }));
      }
    });
  });
  return {
    el,
    ready: isReady,
    async check() {
      let all = true;
      inputs.forEach((inp, i) => {
        inp.readOnly = true;
        const v = inp.value;
        const ok = blanks[i].some((a) => normCode(a) === normCode(v) || squash(a) === squash(v) || stripSemi(squash(a)) === stripSemi(squash(v)));
        inp.classList.add(ok ? 'ok' : 'bad');
        if (!ok) all = false;
      });
      return { correct: all };
    },
    answerHtml: () => {
      let filled = '';
      parts.forEach((p, i) => {
        filled += highlight(p);
        if (i < parts.length - 1) filled += `<mark class="filled">${esc(blanks[i][0])}</mark>`;
      });
      return `<div class="mini-label">Answer</div><pre class="code"><code>${filled}</code></pre>`;
    },
    focus() { inputs[0] && inputs[0].focus({ preventScroll: true }); },
  };
}

// ---------- spot the bug ----------
function bug(q, { onReady }) {
  const el = document.createElement('div');
  const lines = q.code.split('\n');
  el.innerHTML = `${head(q)}<div class="bug-code code" role="listbox" aria-label="Code lines">
    ${lines.map((l, i) => `<button type="button" class="bug-line" role="option" data-l="${i + 1}" ${l.trim() ? '' : 'disabled'}><span class="ln">${i + 1}</span><code>${highlight(l) || ' '}</code></button>`).join('')}
  </div>`;
  let chosen = null;
  const btns = [...el.querySelectorAll('.bug-line')];
  btns.forEach((b) => b.addEventListener('click', () => {
    if (el.classList.contains('locked')) return;
    chosen = +b.dataset.l;
    btns.forEach((x) => x.classList.toggle('chosen', x === b));
    onReady(true);
  }));
  const bugLines = Array.isArray(q.line) ? q.line : [q.line];
  return {
    el,
    ready: () => chosen !== null,
    async check() {
      el.classList.add('locked');
      const correct = bugLines.includes(chosen);
      btns.forEach((b) => {
        const l = +b.dataset.l;
        if (bugLines.includes(l)) b.classList.add('is-correct');
        else if (l === chosen) b.classList.add('is-wrong');
      });
      return { correct };
    },
    answerHtml: () => (q.fix ? `<div class="mini-label">Fixed line ${bugLines[0]}</div>${codeBlock(q.fix)}` : ''),
    focus() {},
  };
}

// ---------- put in order (Parsons) ----------
function order(q, { onReady, seed }) {
  const el = document.createElement('div');
  const all = [...q.lines.map((t, i) => ({ t, i, real: true })), ...(q.distractors || []).map((t, i) => ({ t, i: 1000 + i, real: false }))];
  const pool = shuffle(all, seed);
  el.innerHTML = `${head(q)}
    <div class="parsons">
      <div class="mini-label">Your code</div>
      <ol class="p-answer code" aria-label="Your code"><li class="p-empty">Tap lines below to add them here</li></ol>
      <div class="mini-label">Available lines${q.distractors && q.distractors.length ? ` <span class="muted">(${q.distractors.length} ${q.distractors.length === 1 ? "isn't" : "aren't"} needed)</span>` : ''}</div>
      <div class="p-pool code"></div>
    </div>`;
  const ans = el.querySelector('.p-answer');
  const poolEl = el.querySelector('.p-pool');
  const picked = [];
  function draw() {
    ans.innerHTML = picked.length ? picked.map((x, k) => `<li><button type="button" class="p-line" data-k="${k}"><code>${highlight(x.t) || ' '}</code></button></li>`).join('') : '<li class="p-empty">Tap lines below to add them here</li>';
    const left = pool.filter((x) => !picked.includes(x));
    poolEl.innerHTML = left.map((x) => `<button type="button" class="p-line" data-i="${x.i}"><code>${highlight(x.t.trim())}</code></button>`).join('') || '<div class="p-empty">All lines placed. Tap a placed line to remove it.</div>';
    onReady(picked.length >= q.lines.length);
  }
  poolEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('.p-line');
    if (!b || el.classList.contains('locked')) return;
    picked.push(all.find((x) => x.i === +b.dataset.i));
    draw();
  });
  ans.addEventListener('click', (ev) => {
    const b = ev.target.closest('.p-line');
    if (!b || el.classList.contains('locked')) return;
    picked.splice(+b.dataset.k, 1);
    draw();
  });
  draw();
  const target = q.lines.map((l) => l.trim());
  const alts = (q.alts || []).map((a) => a.map((l) => l.trim()));
  return {
    el,
    ready: () => picked.length >= q.lines.length,
    async check() {
      el.classList.add('locked');
      const got = picked.map((x) => x.t.trim());
      const same = (a) => a.length === got.length && a.every((l, i) => l === got[i]);
      const correct = same(target) || alts.some(same);
      [...ans.querySelectorAll('.p-line')].forEach((b, k) => {
        b.classList.add(got[k] === target[k] || correct ? 'is-correct' : 'is-wrong');
      });
      return { correct };
    },
    answerHtml: () => `<div class="mini-label">Correct order</div>${codeBlock(q.lines.join('\n'))}`,
    focus() {},
  };
}

// ---------- write code ----------
function code(q, { lang, qid, onReady }) {
  const el = document.createElement('div');
  el.innerHTML = `${head(q)}<div class="code-q-editor"></div><div class="code-q-results"></div>`;
  const results = el.querySelector('.code-q-results');
  const ed = createEditor(el.querySelector('.code-q-editor'), {
    value: q.starter,
    minLines: Math.min(12, q.starter.split('\n').length + 3),
    onChange: () => onReady(true),
    onRun: () => el.dispatchEvent(new CustomEvent('submit-answer', { bubbles: true })),
  });
  let lastRun = null;
  return {
    el,
    ready: () => true,
    keepGoing: true, // a failed check lets the learner edit and retry
    async check() {
      results.innerHTML = `<div class="running">${icon('play')} Running tests…</div>`;
      const res = await runTests(ed.value, { lang, question: qid });
      lastRun = res;
      results.innerHTML = '';
      results.appendChild(renderTestResults(res, q, { compact: true }));
      const errLine = res.compileError ? res.compileError.line : (res.results.find((r) => r.error) || {}).error?.line;
      ed.markLine(errLine);
      const correct = !res.compileError && res.passed === res.total && res.total > 0;
      return { correct, summary: res.compileError ? 'Your code did not compile.' : `${res.passed}/${res.total} tests passed.` };
    },
    answerHtml: () => (q.solution ? `<div class="mini-label">One possible solution</div>${codeBlock(q.solution)}` : ''),
    focus() {},
    get lastRun() { return lastRun; },
    get value() { return ed.value; },
  };
}

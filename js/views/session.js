// Plays a sequence of questions (a lesson or a review session).
import { renderQuestion } from '../questions.js';
import { md } from '../md.js';
import { icon, esc, el } from '../ui.js';
import { store } from '../store.js';

const PRAISE = ['Correct.', 'Nice.', 'Spot on.', 'Yes!', 'Exactly right.', 'Good.', 'That\'s it.'];

export function runSession(root, { title, kicker, backHref, items, mode = 'lesson', lang, onFinish }) {
  const queue = items.map((it) => ({ ...it, attempt: 0 }));
  const firstTry = new Map(); // qid -> boolean
  let xpEarned = 0;
  let done = 0;
  const total = items.length;
  let current = null;
  let state = 'idle';

  root.innerHTML = `
    <section class="session" aria-label="${esc(title)}">
      <div class="session-top">
        <a class="icon-btn" href="${backHref}" aria-label="Leave">${icon('x')}</a>
        <div class="seg-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="0">
          ${items.map(() => '<i></i>').join('')}
        </div>
        <span class="session-count mono">0/${total}</span>
      </div>
      <div class="session-kicker">${esc(kicker || '')}</div>
      <div class="session-stage"></div>
      <div class="session-foot">
        <div class="foot-inner">
          <div class="feedback" aria-live="polite"></div>
          <div class="foot-actions">
            <button type="button" class="btn ghost secondary-action" hidden></button>
            <button type="button" class="btn primary main-action" disabled>Check</button>
          </div>
        </div>
      </div>
    </section>`;
  document.body.classList.add('in-session');
  const stage = root.querySelector('.session-stage');
  const foot = root.querySelector('.session-foot');
  const feedback = root.querySelector('.feedback');
  const mainBtn = root.querySelector('.main-action');
  const secBtn = root.querySelector('.secondary-action');
  const segs = [...root.querySelectorAll('.seg-progress i')];
  const counter = root.querySelector('.session-count');
  const bar = root.querySelector('.seg-progress');

  function paintProgress() {
    segs.forEach((s, i) => {
      s.className = i < done ? 'done' : i === done ? 'now' : '';
    });
    counter.textContent = `${done}/${total}`;
    bar.setAttribute('aria-valuenow', String(done));
  }

  function setFoot(kind, html, mainLabel, secLabel = null) {
    foot.className = 'session-foot ' + kind;
    feedback.innerHTML = html;
    mainBtn.textContent = mainLabel;
    mainBtn.disabled = false;
    if (secLabel) { secBtn.hidden = false; secBtn.textContent = secLabel; } else secBtn.hidden = true;
  }

  function next() {
    if (!queue.length) return finish();
    const item = queue.shift();
    current = { item, r: null };
    state = 'idle';
    const q = item.q;
    stage.innerHTML = '';
    const origin = item.origin ? `<div class="q-origin">${esc(item.origin)}</div>` : '';
    if (origin) stage.insertAdjacentHTML('beforeend', origin);
    if (item.attempt > 0) stage.insertAdjacentHTML('beforeend', '<div class="q-again">Second try at this one</div>');
    const r = renderQuestion({ ...q, __id: item.qid.replace(/\W/g, '_') }, {
      lang, qid: item.qid, seed: Math.random(),
      onReady: (ok) => { if (state === 'idle') mainBtn.disabled = !ok; },
    });
    current.r = r;
    stage.appendChild(r.el);
    foot.className = 'session-foot';
    feedback.innerHTML = '';
    mainBtn.textContent = q.type === 'code' ? 'Run tests' : 'Check';
    mainBtn.disabled = !r.ready();
    secBtn.hidden = true;
    if (q.type === 'code') { secBtn.hidden = false; secBtn.textContent = 'Show solution'; }
    paintProgress();
    stage.classList.remove('enter');
    void stage.offsetWidth;
    stage.classList.add('enter');
    if (!('ontouchstart' in window)) setTimeout(() => r.focus(), 60);
  }

  async function check() {
    if (state !== 'idle' || mainBtn.disabled) return;
    state = 'checking';
    mainBtn.disabled = true;
    const { item, r } = current;
    const q = item.q;
    let res;
    try {
      res = await r.check();
    } catch (e) {
      console.error(e);
      res = { correct: false, summary: 'Something went wrong running that.' };
    }
    const first = !firstTry.has(item.qid);
    if (q.type === 'code' && !res.correct) {
      // let them keep editing
      state = 'idle';
      setFoot('warn', `<div class="fb-title">${icon('x')} Not yet: ${esc(res.summary || '')}</div><p class="fb-sub">Read the failing test above, fix your code and run it again.</p>`, 'Run again', 'Show solution');
      mainBtn.disabled = false;
      if (first) { firstTry.set(item.qid, false); store.recordAnswer(item.qid, false, { review: mode === 'review' }); }
      return;
    }
    if (first) firstTry.set(item.qid, res.correct);
    store.recordAnswer(item.qid, res.correct, { review: mode === 'review' });
    const gain = res.correct ? (mode === 'review' ? 5 : (item.attempt === 0 && first) ? (q.type === 'code' ? 20 : 10) : 4) : 0;
    if (gain) { store.addXp(gain); xpEarned += gain; }
    state = 'answered';
    const explain = q.explain ? `<div class="fb-explain">${md(q.explain)}</div>` : '';
    if (res.correct) {
      done++;
      setFoot('good', `<div class="fb-title">${icon('check')} ${PRAISE[Math.floor(Math.random() * PRAISE.length)]}${gain ? ` <span class="xp-pop">+${gain} XP</span>` : ''}</div>${explain}`, done >= total && !queue.length ? 'Finish' : 'Continue');
    } else {
      const again = mode === 'lesson' && item.attempt === 0;
      if (again) queue.push({ ...item, attempt: item.attempt + 1 });
      else done++;
      setFoot('bad', `<div class="fb-title">${icon('x')} Not quite.</div>${r.answerHtml()}${explain}${again ? '<p class="fb-sub">You\'ll get another go at this one before the lesson ends.</p>' : ''}`, 'Continue');
    }
    paintProgress();
    mainBtn.focus({ preventScroll: true });
  }

  function showSolution() {
    const { item, r } = current;
    const q = item.q;
    if (!firstTry.has(item.qid)) { firstTry.set(item.qid, false); store.recordAnswer(item.qid, false, { review: mode === 'review' }); }
    state = 'answered';
    done++;
    const explain = q.explain ? `<div class="fb-explain">${md(q.explain)}</div>` : '';
    setFoot('bad', `<div class="fb-title">${icon('eye')} Solution</div>${r.answerHtml()}${explain}<p class="fb-sub">This one's in your review list now, so you can come back to it.</p>`, 'Continue');
    paintProgress();
  }

  function finish() {
    const unique = new Set(items.map((i) => i.qid)).size;
    const right = [...firstTry.values()].filter(Boolean).length;
    const missed = items.filter((i) => firstTry.get(i.qid) === false);
    foot.className = 'session-foot hidden';
    document.body.classList.remove('in-session');
    segs.forEach((s) => { s.className = 'done'; });
    counter.textContent = `${total}/${total}`;
    const pct = unique ? Math.round((right / unique) * 100) : 100;
    stage.innerHTML = '';
    const extra = onFinish ? onFinish({ right, total: unique, xpEarned, missed }) : {};
    stage.appendChild(el(`<div class="summary">
      <div class="summary-stamp ${pct >= 80 ? 'great' : pct >= 50 ? 'ok' : 'low'}">
        <span class="big mono">${right}/${unique}</span><span>first-try correct</span>
      </div>
      <h2>${esc(extra.heading || (pct === 100 ? 'Perfect run.' : pct >= 80 ? 'Strong work.' : pct >= 50 ? 'Getting there.' : 'Worth another pass.'))}</h2>
      <p class="muted">${xpEarned ? `+${xpEarned} XP earned. ` : ''}${missed.length ? `${missed.length} question${missed.length === 1 ? '' : 's'} added to your review list.` : 'Nothing to review from this one.'}</p>
      ${extra.html || ''}
      <div class="summary-actions">${extra.actions || `<a class="btn primary" href="${backHref}">Done</a>`}</div>
    </div>`));
    root.querySelector('.session-kicker').textContent = '';
  }

  mainBtn.addEventListener('click', () => {
    if (state === 'idle') check();
    else if (state === 'answered') next();
  });
  secBtn.addEventListener('click', () => {
    if (current && current.item.q.type === 'code' && state === 'idle') showSolution();
  });
  root.addEventListener('submit-answer', () => {
    if (state === 'idle' && !mainBtn.disabled) check();
  });
  const onKey = (ev) => {
    if (!root.isConnected) return;
    const tag = (ev.target.tagName || '').toLowerCase();
    const typing = tag === 'textarea' || tag === 'input';
    if (ev.key === 'Enter' && !ev.shiftKey && (!typing || state === 'answered' || (ev.ctrlKey || ev.metaKey))) {
      if (tag === 'button' && ev.target !== mainBtn) return;
      ev.preventDefault();
      mainBtn.click();
      return;
    }
    if (!typing && state === 'idle' && current && current.r.key && /^[1-9a-fA-F]$/.test(ev.key) && !ev.ctrlKey && !ev.metaKey) {
      if (current.r.key(ev.key)) ev.preventDefault();
    }
  };
  document.addEventListener('keydown', onKey);

  next();
  return () => {
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('in-session');
  };
}

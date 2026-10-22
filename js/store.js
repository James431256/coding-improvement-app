// Progress persistence (localStorage) with export / import.
const KEY = 'recompile.progress.v1';

function today(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function blank() {
  return {
    version: 1,
    created: Date.now(),
    xp: 0,
    activity: {}, // 'YYYY-MM-DD' -> number of answers / runs
    langs: {},
    settings: { lang: 'java', dailyGoal: 30 },
  };
}

function blankLang() {
  return { lessons: {}, questions: {}, problems: {}, last: null, playground: null };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 1) return { ...blank(), ...s, settings: { ...blank().settings, ...(s.settings || {}) } };
    }
  } catch (e) { /* storage unavailable or corrupt */ }
  return blank();
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 150);
}
function flush() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota / private mode */ }
}
window.addEventListener('pagehide', flush);
window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

export const store = {
  get state() { return state; },
  lang(id = state.settings.lang) {
    if (!state.langs[id]) state.langs[id] = blankLang();
    return state.langs[id];
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  changed() { save(); listeners.forEach((fn) => fn(state)); },

  bump(amount = 1) {
    const d = today();
    state.activity[d] = (state.activity[d] || 0) + amount;
  },
  addXp(n) {
    state.xp += n;
    state.activity['xp:' + today()] = (state.activity['xp:' + today()] || 0) + n;
    this.changed();
  },
  xpToday() { return state.activity['xp:' + today()] || 0; },

  // ---- questions ----
  recordAnswer(qid, correct, { review = false } = {}) {
    const L = this.lang();
    const q = L.questions[qid] || (L.questions[qid] = { c: 0, w: 0, box: -1, due: 0, first: null });
    if (q.first === null) q.first = correct;
    if (correct) q.c++; else q.w++;
    if (!correct) {
      q.box = 0;
      q.due = Date.now();
    } else if (review && q.box >= 0) {
      q.box++;
      q.due = Date.now() + (q.box === 1 ? 20 * 3600e3 : 3 * 86400e3);
      if (q.box >= 3) q.box = -1; // graduated
    }
    q.last = Date.now();
    this.bump();
    this.changed();
    return q;
  },
  reviewQueue(allIds) {
    const L = this.lang();
    const now = Date.now();
    const due = [], later = [];
    for (const id of allIds) {
      const q = L.questions[id];
      if (q && q.box >= 0) (q.due <= now ? due : later).push(id);
    }
    return { due, later };
  },

  // ---- lessons ----
  finishLesson(lessonId, score, total) {
    const L = this.lang();
    const prev = L.lessons[lessonId] || { best: 0, runs: 0 };
    L.lessons[lessonId] = { ...prev, done: true, best: Math.max(prev.best || 0, score), total, runs: (prev.runs || 0) + 1, at: Date.now() };
    this.changed();
  },
  setLast(ref) { this.lang().last = ref; this.changed(); },

  // ---- problems ----
  problem(id) {
    const L = this.lang();
    return L.problems[id] || (L.problems[id] = { solved: false, attempts: 0, code: null });
  },
  saveCode(id, code) { this.problem(id).code = code; save(); },
  markRun(id, passedAll) {
    const p = this.problem(id);
    p.attempts++;
    this.bump();
    let firstSolve = false;
    if (passedAll && !p.solved) { p.solved = true; p.solvedAt = Date.now(); firstSolve = true; }
    this.changed();
    return firstSolve;
  },

  // ---- streak ----
  streak() {
    let n = 0;
    const d = new Date();
    if (!state.activity[today(d)]) d.setDate(d.getDate() - 1); // today not done yet: count up to yesterday
    while (state.activity[today(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },
  activeToday() { return !!state.activity[today()]; },
  today,

  // ---- backup ----
  exportJSON() { return JSON.stringify(state); },
  importJSON(text) {
    const s = JSON.parse(text);
    if (!s || s.version !== 1 || typeof s.langs !== 'object') throw new Error('That does not look like a Recompile backup.');
    state = { ...blank(), ...s };
    flush();
    this.changed();
  },
  reset() {
    state = blank();
    flush();
    this.changed();
  },
  setSetting(k, v) { state.settings[k] = v; this.changed(); },
};

// Languages the app knows about. Adding a language = adding a content folder + a runner.
export const LANGUAGES = [
  { id: 'java', name: 'Java', available: true, load: () => import('./java/index.js') },
  { id: 'python', name: 'Python', available: false },
  { id: 'javascript', name: 'JavaScript', available: false },
  { id: 'cpp', name: 'C++', available: false },
];

const cache = {};
export async function loadLanguage(id) {
  if (!cache[id]) {
    const lang = LANGUAGES.find((l) => l.id === id && l.available);
    if (!lang) throw new Error('Unknown language ' + id);
    cache[id] = lang.load().then((m) => m.default);
  }
  return cache[id];
}

// ref: { lang, problem } or { lang, question } -> spec with tests for the runner
export async function findRunnable(ref) {
  const pack = await loadLanguage(ref.lang);
  if (ref.problem) return pack.problemsById[ref.problem];
  return pack.questionsById[ref.question].q;
}

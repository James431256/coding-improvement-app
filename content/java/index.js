// Assembles the Java course pack: units -> lessons -> questions, plus the problem set.
import units from './course.js';
import problems from './problems.js';

const DIFF = { warmup: 'Warm-up', easy: 'Easy', 'easy+': 'Easy+' };

const pack = {
  id: 'java',
  name: 'Java',
  units,
  lessons: [],
  lessonsById: {},
  questionsById: {},
  problems,
  problemsById: {},
};

units.forEach((u, ui) => {
  u.code = 'U' + String(ui + 1).padStart(2, '0');
  u.problems = [];
  u.lessons.forEach((l, li) => {
    l.num = li + 1;
    l.unit = u;
    l.problems = [];
    pack.lessons.push(l);
    pack.lessonsById[l.id] = l;
    l.questions.forEach((q, qi) => {
      pack.questionsById[`${l.id}:${qi}`] = { q, lesson: l };
    });
  });
});

// Order problems by where they sit in the course (stable within a lesson).
const lessonPos = new Map(pack.lessons.map((l, i) => [l.id, i]));
problems.sort((a, b) => (lessonPos.get(a.after) ?? 999) - (lessonPos.get(b.after) ?? 999));

problems.forEach((p, i) => {
  p.num = i + 1;
  p.diffLabel = DIFF[p.difficulty] || p.difficulty;
  p.xp = p.difficulty === 'warmup' ? 20 : p.difficulty === 'easy' ? 35 : 45;
  p.examples = p.examples || [0, 1].filter((k) => k < p.tests.length);
  pack.problemsById[p.id] = p;
  const l = pack.lessonsById[p.after];
  if (l) {
    l.problems.push(p.id);
    l.unit.problems.push(p);
  }
});

export default pack;

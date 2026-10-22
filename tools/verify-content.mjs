// Verifies course content against real Java (javac/java) and the in-browser interpreter.
//  - output questions: both runtimes must print exactly the expected answer
//  - fill / bug / order: the corrected program must compile (and match `expect` if given)
//  - code questions & problems: reference solution passes all tests in both runtimes; starter compiles
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { runProgram, runTests, parseSignature, deepEqual } from '../js/java/runner.js';
import { normOutput } from './norm.mjs';
import pack from '../content/java/index.js';

const only = process.argv[2];
const cacheRoot = join(tmpdir(), 'recompile-verify');
mkdirSync(cacheRoot, { recursive: true });

function javaRun(src) {
  const h = createHash('sha1').update(src).digest('hex').slice(0, 16);
  const wd = join(cacheRoot, h);
  const cache = join(wd, 'result.json');
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'));
  mkdirSync(wd, { recursive: true });
  writeFileSync(join(wd, 'Main.java'), src);
  let res;
  try {
    execFileSync('javac', ['-nowarn', '-Xlint:none', '-d', wd, join(wd, 'Main.java')], { stdio: 'pipe' });
    try {
      const out = execFileSync('java', ['-Xss8m', '-cp', wd, 'Main'], { stdio: 'pipe', timeout: 20000 }).toString();
      res = { ok: true, out };
    } catch (e) {
      const err = (e.stderr || '').toString().split('\n').filter((l) => !l.startsWith('Picked up')).join('\n');
      res = { ok: true, out: (e.stdout || '').toString(), exception: err.split('\n')[0] };
    }
  } catch (e) {
    res = { ok: false, compileError: e.stderr.toString().split('\n').filter((l) => !l.startsWith('Picked up')).slice(0, 6).join('\n') };
  }
  writeFileSync(cache, JSON.stringify(res));
  return res;
}

function wrap(code) {
  if (/\bclass\s+Main\b/.test(code)) return code.includes('import java.util') ? code : 'import java.util.*;\n' + code;
  const hasClasses = /^\s*(public\s+)?(abstract\s+)?(class|interface|enum|record)\s+\w+/m.test(code);
  const lines = code.split('\n');
  // split into top-level declarations (methods/classes) and statements
  const decls = [];
  const stmts = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^(static|public|private|class|interface|enum|record|abstract)\b/.test(l) || /^(int|void|boolean|String|double|long|char)\s+\w+\s*\(.*\)\s*\{\s*$/.test(l)) {
      const block = [l];
      let depth = (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
      i++;
      while (i < lines.length && depth > 0) {
        block.push(lines[i]);
        depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
        i++;
      }
      decls.push(block.join('\n'));
    } else {
      stmts.push(l);
      i++;
    }
  }
  const imports = 'import java.util.*;\nimport java.util.function.*;\nimport java.util.stream.*;\n';
  const classDecls = decls.filter((d) => /^(public\s+)?(abstract\s+)?(class|interface|enum|record)\b/.test(d));
  const methodDecls = decls.filter((d) => !classDecls.includes(d)).map((d) => (/^static\b/.test(d) ? d : 'static ' + d));
  void hasClasses;
  return `${imports}${classDecls.join('\n')}\npublic class Main {\n${methodDecls.join('\n')}\npublic static void main(String[] args) throws Exception {\n${stmts.join('\n')}\n}\n}\n`;
}

let failures = 0;
let checked = 0;
function fail(where, msg) {
  failures++;
  console.log(`\x1b[31mFAIL\x1b[0m ${where}\n   ${msg.split('\n').join('\n   ')}`);
}

function checkProgram(where, code, expect, { mustCompile = true } = {}) {
  const src = wrap(code);
  const j = javaRun(src);
  checked++;
  if (!j.ok) {
    if (mustCompile) fail(where, 'javac error:\n' + j.compileError + '\n--- source ---\n' + src);
    return null;
  }
  const ours = runProgram(code);
  if (ours.error && /No `public static void main/.test(ours.error.message) && !j.out) return j; // class-only snippet
  let oursOut = ours.stdout;
  if (ours.error) {
    if (ours.error.kind === 'exception') oursOut += '\n<<' + ours.error.message.replace('Exception in thread "main" ', '') + '>>';
    else { fail(where, `interpreter ${ours.error.kind} error: ${ours.error.message} (line ${ours.error.line})`); return j; }
  }
  let javaOut = j.out;
  if (j.exception) javaOut += '\n<<' + j.exception.replace('Exception in thread "main" ', '') + '>>';
  if (normOutput(javaOut) !== normOutput(oursOut)) {
    fail(where, `interpreter differs from Java\n java: ${JSON.stringify(normOutput(javaOut))}\n ours: ${JSON.stringify(normOutput(oursOut))}`);
  }
  if (expect !== undefined) {
    const exps = (Array.isArray(expect) ? expect : [expect]).map(normOutput);
    if (!exps.includes(normOutput(javaOut))) fail(where, `expected ${JSON.stringify(exps[0])} but Java printed ${JSON.stringify(normOutput(javaOut))}`);
  }
  return j;
}

// ---------- Java harness for code problems ----------
function lit(v, type) {
  const t = type.trim();
  if (v === null) return 'null';
  const arr = t.match(/^(.*)\[\]$/);
  if (arr) {
    const et = arr[1];
    if (et === 'char' && typeof v === 'string') return `${JSON.stringify(v)}.toCharArray()`;
    return `new ${t}{${v.map((x) => lit(x, et)).join(', ')}}`;
  }
  const gen = t.match(/^(List|ArrayList|Set)<(.+)>$/);
  if (gen) {
    const ctor = gen[1] === 'Set' ? 'HashSet' : 'ArrayList';
    return `new ${ctor}<>(Arrays.asList(${v.map((x) => lit(x, gen[2])).join(', ')}))`.replace('Arrays.asList()', 'List.of()');
  }
  switch (t) {
    case 'int': case 'Integer': return String(v);
    case 'long': case 'Long': return `${v}L`;
    case 'double': case 'Double': return Number.isInteger(v) ? `${v}.0` : String(v);
    case 'boolean': return String(v);
    case 'char': case 'Character': return `'${v === "'" ? "\\'" : v === '\\' ? '\\\\' : v}'`;
    case 'String': return JSON.stringify(v);
    case 'ListNode': return `Main.list(new int[]{${v.join(', ')}})`;
    case 'TreeNode': return `Main.tree(new Integer[]{${v.map((x) => (x === null ? 'null' : x)).join(', ')}})`;
    default: throw new Error('no literal for type ' + t);
  }
}

const PRELUDE = {
  ListNode: 'class ListNode { int val; ListNode next; ListNode() {} ListNode(int val) { this.val = val; } ListNode(int val, ListNode next) { this.val = val; this.next = next; } }',
  TreeNode: 'class TreeNode { int val; TreeNode left; TreeNode right; TreeNode() {} TreeNode(int val) { this.val = val; } TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; } }',
};

const DUMP = `
  static ListNode list(int[] a) { ListNode d = new ListNode(0), c = d; for (int x : a) { c.next = new ListNode(x); c = c.next; } return d.next; }
  static TreeNode tree(Integer[] a) {
    if (a.length == 0 || a[0] == null) return null;
    TreeNode root = new TreeNode(a[0]); Deque<TreeNode> q = new ArrayDeque<>(); q.add(root); int i = 1;
    while (!q.isEmpty() && i < a.length) { TreeNode n = q.poll();
      if (i < a.length && a[i] != null) { n.left = new TreeNode(a[i]); q.add(n.left); } i++;
      if (i < a.length && a[i] != null) { n.right = new TreeNode(a[i]); q.add(n.right); } i++; }
    return root;
  }
  static String q(String s) { StringBuilder b = new StringBuilder("\\""); for (char c : s.toCharArray()) { if (c == '"' || c == '\\\\') b.append('\\\\'); b.append(c); } return b.append('"').toString(); }
  static String dump(Object o) {
    if (o == null) return "null";
    if (o instanceof String s) return q(s);
    if (o instanceof Character c) return q(String.valueOf(c));
    if (o instanceof Double d) { if (d.isNaN() || d.isInfinite()) return q(d.toString()); return d.toString(); }
    if (o instanceof Number || o instanceof Boolean) return o.toString();
    if (o instanceof int[] a) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(a[i]); } return b.append("]").toString(); }
    if (o instanceof long[] a) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(a[i]); } return b.append("]").toString(); }
    if (o instanceof double[] a) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(a[i]); } return b.append("]").toString(); }
    if (o instanceof boolean[] a) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(a[i]); } return b.append("]").toString(); }
    if (o instanceof char[] a) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(q(String.valueOf(a[i]))); } return b.append("]").toString(); }
    if (o instanceof Object[] a) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(dump(a[i])); } return b.append("]").toString(); }
    if (o instanceof Collection<?> c) { StringBuilder b = new StringBuilder("["); boolean f = true; for (Object x : c) { if (!f) b.append(","); f = false; b.append(dump(x)); } return b.append("]").toString(); }
    if (o instanceof ListNode n) { StringBuilder b = new StringBuilder("["); int k = 0; for (ListNode c = n; c != null && k < 100000; c = c.next, k++) { if (k > 0) b.append(","); b.append(c.val); } return b.append("]").toString(); }
    if (o instanceof TreeNode t) { List<String> out = new ArrayList<>(); Deque<TreeNode> dq = new LinkedList<>(); dq.add(t);
      while (!dq.isEmpty()) { TreeNode n = dq.poll(); if (n == null) { out.add("null"); continue; } out.add(String.valueOf(n.val)); dq.add(n.left); dq.add(n.right); }
      while (!out.isEmpty() && out.get(out.size() - 1).equals("null")) out.remove(out.size() - 1);
      return "[" + String.join(",", out) + "]"; }
    return q(o.toString());
  }`;

function javaHarness(solution, spec) {
  const sig = parseSignature(spec.signature);
  const needs = spec.needs || [];
  let src = 'import java.util.*;\nimport java.util.function.*;\nimport java.util.stream.*;\n';
  src += solution.replace(/^import .*$/gm, '') + '\n';
  for (const n of ['ListNode', 'TreeNode']) if (!new RegExp(`class\\s+${n}\\b`).test(solution)) src += PRELUDE[n] + '\n';
  void needs;
  src += 'public class Main {\n' + DUMP + '\n  public static void main(String[] args) {\n';
  spec.tests.forEach((tc, ti) => {
    src += `    { Solution s = new Solution();\n`;
    sig.params.forEach((p, i) => { src += `      ${p.type} a${i} = ${lit(tc.args[i], p.type)};\n`; });
    const call = `s.${sig.name}(${sig.params.map((_, i) => 'a' + i).join(', ')})`;
    if (sig.returns === 'void') src += `      ${call};\n      String r = "null";\n`;
    else src += `      String r = dump(${call});\n`;
    src += `      System.out.println("T${ti}|" + r${sig.params.map((_, i) => ` + "|" + dump(a${i})`).join('')}); }\n`;
  });
  src += '  }\n}\n';
  return src;
}

function checkCode(where, spec) {
  // 1) reference solution passes in our interpreter
  const ours = runTests(spec.solution, spec);
  checked++;
  if (ours.compileError) { fail(where, `solution does not compile in interpreter: ${ours.compileError.message} (line ${ours.compileError.line})`); return; }
  ours.results.forEach((r, i) => {
    if (!r.pass) fail(`${where} test ${i + 1}`, `interpreter: expected ${JSON.stringify(r.expected)} got ${JSON.stringify(r.got)}${r.error ? ' error ' + r.error.message : ''}`);
  });
  // 2) starter compiles (runs without compile error in interpreter)
  const st = runTests(spec.starter, spec, { only: 0 });
  if (st.compileError) fail(`${where} starter`, `starter does not compile: ${st.compileError.message}`);
  // 3) real Java agrees with expected values
  const src = javaHarness(spec.solution, spec);
  const j = javaRun(src);
  if (!j.ok) { fail(where, 'javac error in harness:\n' + j.compileError); return; }
  if (j.exception) { fail(where, 'java exception: ' + j.exception); return; }
  const lines = j.out.trim().split('\n');
  spec.tests.forEach((tc, ti) => {
    const line = lines.find((l) => l.startsWith(`T${ti}|`));
    if (!line) { fail(`${where} test ${ti + 1}`, 'no output from java'); return; }
    const parts = splitTop(line.slice(line.indexOf('|') + 1));
    let ret = JSON.parse(parts[0]);
    if (ret === null && /^(ListNode|TreeNode)$/.test(parseSignature(spec.signature).returns)) ret = [];
    const argsAfter = parts.slice(1).map((p) => JSON.parse(p));
    let pass;
    if (spec.check) pass = spec.check(ret, argsAfter, tc).pass;
    else pass = deepEqual(ret, tc.expected, spec.compare || 'exact');
    if (!pass) fail(`${where} test ${ti + 1}`, `REAL JAVA disagrees with expected.\n  expected ${JSON.stringify(tc.expected)}\n  java     ${JSON.stringify(ret)} args after ${JSON.stringify(argsAfter)}`);
  });
}
function splitTop(s) {
  // split on | that are not inside strings
  const out = [];
  let cur = '', inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { cur += c; if (c === '\\') { cur += s[++i]; continue; } if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    if (c === '|') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

// ---------- run ----------
for (const l of pack.lessons) {
  if (only && !l.id.includes(only)) continue;
  l.questions.forEach((q, i) => {
    const where = `${l.unit.code}/${l.id} q${i + 1} (${q.type})`;
    const around = (code) => [q.setup, code, q.teardown].filter((x) => x).join('\n');
    switch (q.type) {
      case 'output':
        checkProgram(where, q.code, q.answer);
        break;
      case 'fill': {
        let k = 0;
        const code = q.code.replace(/___/g, () => (Array.isArray(q.blanks[k]) ? q.blanks[k++][0] : q.blanks[k++]));
        if (q.verify !== false) checkProgram(where, around(code), q.expect);
        break;
      }
      case 'bug': {
        const lines = q.code.split('\n');
        const ln = Array.isArray(q.line) ? q.line[0] : q.line;
        if (q.fix) {
          const indent = lines[ln - 1].match(/^\s*/)[0];
          lines[ln - 1] = q.fix.split('\n').map((x, k) => (k === 0 ? indent + x.trimStart() : x)).join('\n');
          if (q.verify !== false) checkProgram(where, around(lines.join('\n')), q.expect);
        }
        if (q.buggyExpect !== undefined) checkProgram(where + ' (buggy)', around(q.code), q.buggyExpect);
        break;
      }
      case 'order':
        if (q.verify !== false) checkProgram(where, around(q.lines.join('\n')), q.expect);
        break;
      case 'mcq': case 'multi':
        checked++;
        if (q.type === 'mcq' && !(q.answer >= 0 && q.answer < q.options.length)) fail(where, 'answer index out of range');
        if (q.type === 'multi' && !q.answers.every((a) => a >= 0 && a < q.options.length)) fail(where, 'answers out of range');
        if (q.run) checkProgram(where, q.code, q.run);
        break;
      case 'code':
        checkCode(where, q);
        break;
      default:
        fail(where, 'unknown type');
    }
  });
}
for (const p of pack.problems) {
  if (only && !p.id.includes(only)) continue;
  checkCode(`problem ${p.id}`, p);
  if (!pack.lessonsById[p.after]) fail(`problem ${p.id}`, `after: unknown lesson ${p.after}`);
}

const nq = pack.lessons.reduce((s, l) => s + l.questions.length, 0);
console.log(`\n${pack.units.length} units, ${pack.lessons.length} lessons, ${nq} questions, ${pack.problems.length} problems`);
console.log(`${checked} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);

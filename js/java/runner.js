// Public API: run a program, or run a Solution method against test cases.
import { Interpreter } from './interp.js';
import { JavaSyntaxError } from './lexer.js';
import { parseType } from './parser.js';
import {
  R, JChar, JLong, JDouble, JArray, JObject, JavaThrow, InterpError,
  mkChar, mkLong, mkDouble, T, str,
} from './values.js';
import { JList, JSet, JMap, JMapView } from './stdlib.js';

const PRELUDE = {
  ListNode: `
class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}`,
  TreeNode: `
class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}`,
};

function describeError(e, rt) {
  if (e instanceof JavaSyntaxError) {
    return { kind: 'compile', message: e.message, line: e.line };
  }
  if (e instanceof InterpError) {
    if (e.kind === 'exit') return null;
    return { kind: e.kind === 'compile' ? 'compile' : e.kind, message: e.message, line: e.line };
  }
  if (e instanceof JavaThrow) {
    const text = rt.objToString(e.obj);
    const out = { kind: 'exception', message: `Exception in thread "main" ${text}`, short: text, line: e.obj.line };
    if (e.obj.cls.name === 'StackOverflowError') {
      out.note = 'Recursion went too deep. Check your base case. (This in-browser runner allows a few hundred nested calls; real Java allows thousands.)';
    }
    return out;
  }
  if (e instanceof RangeError) {
    return { kind: 'exception', message: 'Exception in thread "main" java.lang.StackOverflowError', short: 'java.lang.StackOverflowError', line: rt ? rt.line : undefined,
      note: 'Recursion went too deep. Check your base case.' };
  }
  return { kind: 'internal', message: 'Internal error in the Java runner: ' + (e && e.message ? e.message : String(e)), line: rt ? rt.line : undefined };
}

export function runProgram(src, opts = {}) {
  const t0 = Date.now();
  let rt;
  try {
    rt = new Interpreter({ stdin: opts.stdin || '', maxSteps: opts.maxSteps, maxMillis: opts.maxMillis });
    rt.load(src);
    rt.runMain();
    return { stdout: rt.out, error: null, ms: Date.now() - t0, steps: rt.steps };
  } catch (e) {
    return { stdout: rt ? rt.out : '', error: describeError(e, rt), ms: Date.now() - t0, steps: rt ? rt.steps : 0 };
  } finally {
    R.rt = null;
  }
}

// ---------- conversion between JS test data and Java values ----------
function typeOf(s) { return typeof s === 'string' ? parseType(s) : s; }

export function toJava(rt, v, type) {
  const t = typeOf(type);
  if (v === null || v === undefined) {
    if (t.dims === 0 && ['int', 'long', 'double', 'boolean', 'char'].includes(t.base)) throw new Error('null for primitive');
    return null;
  }
  if (t.dims > 0) {
    const et = { ...t, dims: t.dims - 1 };
    if (et.dims === 0 && et.base === 'char' && typeof v === 'string') return new JArray(et, [...v].map((c) => mkChar(c.charCodeAt(0))));
    return new JArray(et, v.map((x) => toJava(rt, x, et)));
  }
  switch (t.base) {
    case 'int': case 'Integer': case 'short': case 'byte': return v | 0;
    case 'long': case 'Long': return mkLong(BigInt(v));
    case 'double': case 'Double': case 'float': return mkDouble(v);
    case 'char': case 'Character': return mkChar(typeof v === 'string' ? v.charCodeAt(0) : v);
    case 'boolean': case 'Boolean': return !!v;
    case 'String': return String(v);
    case 'List': case 'ArrayList': case 'Collection': {
      const et = t.args[0] || T('Object');
      return new JList('ArrayList', v.map((x) => toJava(rt, x, et)));
    }
    case 'Set': case 'HashSet': {
      const et = t.args[0] || T('Object');
      const s = new JSet('HashSet');
      v.forEach((x) => s.add(toJava(rt, x, et)));
      return s;
    }
    case 'ListNode': {
      const cls = rt.classes.get('ListNode');
      let head = null;
      for (let i = v.length - 1; i >= 0; i--) {
        const n = new JObject(cls);
        n.fields.val = v[i] | 0;
        n.fields.next = head;
        head = n;
      }
      return head;
    }
    case 'TreeNode': {
      const cls = rt.classes.get('TreeNode');
      const mk = (x) => { const n = new JObject(cls); n.fields.val = x | 0; n.fields.left = null; n.fields.right = null; return n; };
      if (!v.length || v[0] === null) return null;
      const root = mk(v[0]);
      const q = [root];
      let i = 1;
      while (q.length && i < v.length) {
        const node = q.shift();
        if (i < v.length && v[i] !== null) { node.fields.left = mk(v[i]); q.push(node.fields.left); }
        i++;
        if (i < v.length && v[i] !== null) { node.fields.right = mk(v[i]); q.push(node.fields.right); }
        i++;
      }
      return root;
    }
    default: return v;
  }
}

export function fromJava(v, depth = 0) {
  if (depth > 10000) return '...';
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (v instanceof JChar) return String.fromCharCode(v.c);
  if (v instanceof JLong) {
    const n = Number(v.v);
    return Number.isSafeInteger(n) ? n : v.v.toString();
  }
  if (v instanceof JDouble) return v.v;
  if (v instanceof JArray) return v.data.map((x) => fromJava(x, depth + 1));
  if (v instanceof JList) return v.a.map((x) => fromJava(x, depth + 1));
  if (v instanceof JSet) return v.keys().map((x) => fromJava(x, depth + 1));
  if (v instanceof JMapView) return v.items().map((x) => fromJava(x, depth + 1));
  if (v instanceof JMap) {
    const o = {};
    for (const e of v.entries()) o[str(e.k)] = fromJava(e.v, depth + 1);
    return o;
  }
  if (v instanceof JObject) {
    if (v.cls.name === 'ListNode') {
      const out = [];
      const seen = new Set();
      for (let n = v; n; n = n.fields.next) {
        if (seen.has(n)) { out.push('...cycle'); break; }
        seen.add(n);
        out.push(n.fields.val);
        if (out.length > 10000) break;
      }
      return out;
    }
    if (v.cls.name === 'TreeNode') {
      const out = [];
      const q = [v];
      while (q.length) {
        const n = q.shift();
        if (n === null) { out.push(null); continue; }
        out.push(n.fields.val);
        q.push(n.fields.left, n.fields.right);
        if (out.length > 20000) break;
      }
      while (out.length && out[out.length - 1] === null) out.pop();
      return out;
    }
    return str(v);
  }
  return str(v);
}

export function fmtValue(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (Array.isArray(v)) return '[' + v.map(fmtValue).join(',') + ']';
  if (typeof v === 'object') return '{' + Object.entries(v).map(([k, x]) => `${k}=${fmtValue(x)}`).join(', ') + '}';
  return String(v);
}

function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  return v;
}
function sortDeep(v) {
  if (!Array.isArray(v)) return v;
  const inner = v.map(sortDeep);
  return inner.sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0));
}

export function deepEqual(a, b, mode = 'exact') {
  if (mode === 'unordered') return deepEqual(sortDeep(a), sortDeep(b), 'exact');
  if (mode === 'float') {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b));
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i], mode === 'unordered' ? 'exact' : mode));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k], mode));
  }
  return canon(a) === canon(b);
}

// Parse "public int[] twoSum(int[] nums, int target)"
export function parseSignature(sig) {
  const m = sig.replace(/^\s*(public|private|protected|static|\s)+/, '').match(/^(.+?)\s+(\w+)\s*\((.*)\)\s*$/);
  if (!m) throw new Error('bad signature ' + sig);
  const params = m[3].trim() ? splitParams(m[3]).map((p) => {
    const mm = p.trim().match(/^(.+?)\s+(\w+)$/);
    return { type: mm[1].trim(), name: mm[2] };
  }) : [];
  return { returns: m[1].trim(), name: m[2], params };
}
function splitParams(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const c of s) {
    if (c === '<') depth++;
    if (c === '>') depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// problem: { signature, className?, tests:[{args, expected}], compare?, check?(result, args) , needs?:['ListNode'] }
export function runTests(src, problem, opts = {}) {
  const sig = parseSignature(problem.signature);
  const className = problem.className || 'Solution';
  const needs = problem.needs || [];
  let code = src;
  for (const n of needs) {
    if (!new RegExp(`\\bclass\\s+${n}\\b`).test(src)) code += '\n' + PRELUDE[n];
  }
  const results = [];
  let compileError = null;
  const tests = opts.only != null ? [problem.tests[opts.only]] : problem.tests;
  for (const tc of tests) {
    let rt;
    const t0 = Date.now();
    const res = { args: tc.args, expected: tc.expected, got: undefined, pass: false, stdout: '', error: null, hidden: !!tc.hidden };
    try {
      rt = new Interpreter({ maxSteps: opts.maxSteps ?? 8_000_000, maxMillis: opts.maxMillis ?? 4000 });
      rt.load(code);
      const cls = rt.classes.get(className);
      if (!cls) throw new InterpError('compile', `Could not find class ${className}. Keep the class name as given.`, 1);
      const ms = (cls.methods.get(sig.name) || []).filter((m) => m.params.length === sig.params.length);
      if (!ms.length) throw new InterpError('compile', `Could not find method ${sig.name}(${sig.params.map((p) => p.type).join(', ')}) in class ${className}. Keep the method signature as given.`, 1);
      const m = ms[0];
      const args = tc.args.map((a, i) => toJava(rt, a, sig.params[i].type));
      let self = null;
      if (!m.isStatic) self = rt.instantiate(cls, []);
      rt.ensureInit(cls);
      const ret = rt.invoke(cls, m, self, args);
      res.stdout = rt.out;
      const argsAfter = args.map((a) => fromJava(a));
      if (problem.check) {
        const r = problem.check(fromJava(ret), argsAfter, tc);
        res.got = r.got;
        res.pass = r.pass;
        if (r.expected !== undefined) res.expected = r.expected;
      } else {
        res.got = fromJava(ret);
        if (res.got === null && /^(ListNode|TreeNode)$/.test(sig.returns)) res.got = [];
        res.pass = deepEqual(res.got, tc.expected, problem.compare || 'exact');
      }
    } catch (e) {
      res.stdout = rt ? rt.out : '';
      res.error = describeError(e, rt);
      if (res.error && res.error.kind === 'compile') compileError = res.error;
    } finally {
      R.rt = null;
    }
    res.ms = Date.now() - t0;
    results.push(res);
    if (compileError) break;
  }
  return { results, compileError, passed: results.filter((r) => r.pass).length, total: tests.length };
}

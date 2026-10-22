// Java standard library subset.
import {
  JChar, JLong, JDouble, JArray, JObject, InterpError, compileError,
  mkChar, mkLong, mkDouble, T, defaultValue, kindOf, typeNameOf, typeStr, coerce,
  str, javaHash, javaEquals, compareNatural, identityHash, toInt, toNumber, toBig, isNumeric,
  fmtDouble, stringHash, stringCompare, doubleCompare, d2i, javaClassName, castTo,
} from './values.js';

export const NO_METHOD = Symbol('no-method');

let RT = null; // interpreter, set on each entry point

function fail(name, args, where) {
  return compileError(`cannot find symbol: method ${name}(${args.map(typeNameOf).join(',')})${where ? ' in ' + where : ''}`);
}
function thr(cls, msg) { return RT.makeThrow(cls, msg); }
function checkIndex(i, n, cls = 'IndexOutOfBoundsException') {
  if (i < 0 || i >= n) throw thr(cls, `Index ${i} out of bounds for length ${n}`);
}
function cmpFn(c) {
  if (c === null || c === undefined) return compareNatural;
  return (a, b) => toInt(RT.callFunctional(c, [a, b]));
}
function bool(v) {
  if (typeof v !== 'boolean') throw compileError(`incompatible types: ${typeNameOf(v)} cannot be converted to boolean`);
  return v;
}
function call(f, ...args) { return RT.callFunctional(f, args); }

// ---------- object identity for hash keys ----------
let nextId = 1;
const ids = new WeakMap();
function objectId(o) {
  let id = ids.get(o);
  if (!id) { id = nextId++; ids.set(o, id); }
  return id;
}

// Key used for JS Map lookups that mirrors Java equals(); null => needs slow path.
function hashKey(v) {
  if (v === null || v === undefined) return 'n';
  switch (typeof v) {
    case 'number': return 'i' + v;
    case 'string': return 's' + v;
    case 'boolean': return v ? 'bT' : 'bF';
    default: break;
  }
  if (v instanceof JChar) return 'c' + v.c;
  if (v instanceof JLong) return 'l' + v.v;
  if (v instanceof JDouble) return Object.is(v.v, -0) ? 'd-0' : 'd' + v.v;
  if (v instanceof JList) {
    const parts = [];
    for (const x of v.a) { const k = hashKey(x); if (k === null) return null; parts.push(k); }
    return 'L[' + parts.join(',') + ']';
  }
  if (v instanceof JSet) {
    const parts = [];
    for (const x of v.keys()) { const k = hashKey(x); if (k === null) return null; parts.push(k); }
    return 'S{' + parts.sort().join(',') + '}';
  }
  if (v instanceof JObject) {
    if (RT.hasUserEquals(v)) return null;
    return 'o' + objectId(v);
  }
  if (v instanceof JEntry) {
    const a = hashKey(v.k), b = hashKey(v.v);
    if (a === null || b === null) return null;
    return 'E' + a + '=' + b;
  }
  return 'o' + objectId(v);
}

// ======================= PrintStream =======================
class PrintStream {
  constructor(isErr) { this.isErr = isErr; this.jclass = 'PrintStream'; }
  toJavaString() { return 'java.io.PrintStream@' + identityHash(this).toString(16); }
}

function printStr(v) {
  if (v instanceof JArray && v.elemType.base === 'char' && !v.elemType.dims) {
    return v.data.map((c) => String.fromCharCode(c.c)).join('');
  }
  return str(v);
}

// ======================= StringBuilder =======================
export class JStringBuilder {
  constructor(s = '') { this.s = s; this.jclass = 'StringBuilder'; }
  toJavaString() { return this.s; }
}

// ======================= Lists / Deques =======================
export class JList {
  constructor(kind = 'ArrayList', a = []) {
    this.kind = kind; // ArrayList | LinkedList | ArrayDeque | Stack | Immutable | AsList
    this.a = a;
    this.modCount = 0;
    this.jclass = kind === 'Immutable' ? 'ImmutableCollections.ListN' : kind;
  }
  get size() { return this.a.length; }
  toJavaString() { return '[' + this.a.map((x) => (x === this ? '(this Collection)' : str(x))).join(', ') + ']'; }
  javaEquals(o) {
    if (!(o instanceof JList) || o.kind === 'ArrayDeque' || this.kind === 'ArrayDeque') return o === this;
    if (o.a.length !== this.a.length) return false;
    return this.a.every((x, i) => javaEquals(x, o.a[i]));
  }
  javaHashCode() {
    if (this.kind === 'ArrayDeque') return identityHash(this);
    let h = 1;
    for (const x of this.a) h = (Math.imul(31, h) + javaHash(x)) | 0;
    return h;
  }
  mutate() {
    if (this.kind === 'Immutable') throw thr('UnsupportedOperationException', null);
    this.modCount++;
  }
}

// ======================= Maps / Sets =======================
function tableSizeFor(c) {
  let n = 1;
  while (n < c) n *= 2;
  return Math.max(1, n);
}

export class JMap {
  constructor(kind = 'HashMap', cmp = null, initialCap = 0) {
    this.kind = kind; // HashMap | LinkedHashMap | TreeMap | Immutable
    this.m = new Map(); // hk -> entry  (for TreeMap: unused)
    this.sorted = []; // TreeMap entries (sorted)
    this.cmp = cmp;
    this.cap = initialCap; // HashMap table capacity (0 = not allocated yet)
    this.modCount = 0;
    this.jclass = kind === 'Immutable' ? 'ImmutableCollections.MapN' : kind;
    this.slowSeq = 0;
  }
  get size() { return this.kind === 'TreeMap' ? this.sorted.length : this.m.size; }

  treeFind(k) {
    const c = cmpFn(this.cmp);
    if (k === null && !this.cmp) throw RT.npe();
    let lo = 0, hi = this.sorted.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const d = c(this.sorted[mid].k, k);
      if (d === 0) return { found: true, i: mid };
      if (d < 0) lo = mid + 1; else hi = mid - 1;
    }
    return { found: false, i: lo };
  }

  findEntry(k) {
    if (this.kind === 'TreeMap') {
      if (!this.sorted.length) { if (k === null && !this.cmp) throw RT.npe(); return undefined; }
      const r = this.treeFind(k);
      return r.found ? this.sorted[r.i] : undefined;
    }
    const hk = hashKey(k);
    if (hk !== null) return this.m.get(hk);
    const h = javaHash(k);
    for (const en of this.m.values()) if (en.slow && en.h === h && javaEquals(k, en.k)) return en;
    return undefined;
  }

  get(k) {
    const en = this.findEntry(k);
    return en ? en.v : null;
  }

  put(k, v) {
    if (this.kind === 'Immutable') throw thr('UnsupportedOperationException', null);
    if (this.kind === 'TreeMap') {
      if (!this.sorted.length) {
        compareNatural; // type check: TreeMap calls compare(key, key) on first insert
        cmpFn(this.cmp)(k, k);
      }
      const r = this.treeFind(k);
      if (r.found) { const old = this.sorted[r.i].v; this.sorted[r.i].v = v; return old; }
      this.sorted.splice(r.i, 0, new JEntry(k, v, this));
      this.modCount++;
      return null;
    }
    const en = this.findEntry(k);
    if (en) { const old = en.v; en.v = v; return old; }
    let hk = hashKey(k);
    const entry = new JEntry(k, v, this);
    if (hk === null) { hk = '#slow' + (this.slowSeq++); entry.slow = true; }
    entry.h = javaHash(k);
    entry.hk = hk;
    this.m.set(hk, entry);
    this.modCount++;
    if (this.cap === 0) this.cap = 16;
    if (this.m.size > this.cap * 0.75) this.cap *= 2;
    return null;
  }

  remove(k) {
    if (this.kind === 'Immutable') throw thr('UnsupportedOperationException', null);
    if (this.kind === 'TreeMap') {
      if (!this.sorted.length) return null;
      const r = this.treeFind(k);
      if (!r.found) return null;
      const [en] = this.sorted.splice(r.i, 1);
      this.modCount++;
      return en.v;
    }
    const en = this.findEntry(k);
    if (!en) return null;
    this.m.delete(en.hk);
    this.modCount++;
    return en.v;
  }

  clear() {
    if (this.size) this.modCount++;
    this.m.clear();
    this.sorted = [];
  }

  // Entries in Java iteration order.
  entries() {
    if (this.kind === 'TreeMap') return this.sorted.slice();
    const list = [...this.m.values()];
    if (this.kind === 'HashMap') {
      const mask = this.cap - 1;
      const idx = (en) => {
        const h = en.h;
        return (h ^ (h >>> 16)) & mask;
      };
      list.sort((x, y) => idx(x) - idx(y));
    }
    return list;
  }
  keys() { return this.entries().map((e) => e.k); }

  toJavaString() { return '{' + this.entries().map((e) => `${e.k === this ? '(this Map)' : str(e.k)}=${e.v === this ? '(this Map)' : str(e.v)}`).join(', ') + '}'; }
  javaEquals(o) {
    if (!(o instanceof JMap) || o.size !== this.size) return false;
    for (const e of this.entries()) {
      const oe = o.findEntry(e.k);
      if (!oe || !javaEquals(e.v, oe.v)) return false;
    }
    return true;
  }
  javaHashCode() {
    let h = 0;
    for (const e of this.entries()) h = (h + (javaHash(e.k) ^ javaHash(e.v))) | 0;
    return h;
  }
}

export class JEntry {
  constructor(k, v, map = null) { this.k = k; this.v = v; this.map = map; this.jclass = 'Map.Entry'; }
  toJavaString() { return str(this.k) + '=' + str(this.v); }
  javaEquals(o) { return o instanceof JEntry && javaEquals(this.k, o.k) && javaEquals(this.v, o.v); }
  javaHashCode() { return javaHash(this.k) ^ javaHash(this.v); }
}

export class JSet {
  constructor(kind = 'HashSet', cmp = null, initialCap = 0) {
    const mk = { HashSet: 'HashMap', LinkedHashSet: 'LinkedHashMap', TreeSet: 'TreeMap', Immutable: 'HashMap' }[kind] || 'HashMap';
    this.map = new JMap(mk, cmp, initialCap);
    this.kind = kind;
    this.immutable = kind === 'Immutable';
    this.jclass = kind === 'Immutable' ? 'ImmutableCollections.SetN' : kind;
  }
  get size() { return this.map.size; }
  get modCount() { return this.map.modCount; }
  add(v) {
    if (this.immutable) throw thr('UnsupportedOperationException', null);
    if (this.map.findEntry(v)) return false;
    this.map.put(v, true);
    return true;
  }
  has(v) { return !!this.map.findEntry(v); }
  remove(v) {
    if (this.immutable) throw thr('UnsupportedOperationException', null);
    if (!this.map.findEntry(v)) return false;
    this.map.remove(v);
    return true;
  }
  keys() { return this.map.keys(); }
  toJavaString() { return '[' + this.keys().map(str).join(', ') + ']'; }
  javaEquals(o) {
    if (!(o instanceof JSet || o instanceof JMapView) || o.size !== this.size) return false;
    const other = o instanceof JSet ? o : null;
    return this.keys().every((k) => (other ? other.has(k) : viewContains(o, k)));
  }
  javaHashCode() {
    let h = 0;
    for (const k of this.keys()) h = (h + javaHash(k)) | 0;
    return h;
  }
}

// keySet() / values() / entrySet() live views
export class JMapView {
  constructor(map, which) { this.map = map; this.which = which; this.jclass = which === 'values' ? 'Collection' : 'Set'; }
  get size() { return this.map.size; }
  get modCount() { return this.map.modCount; }
  items() {
    const es = this.map.entries();
    if (this.which === 'keys') return es.map((e) => e.k);
    if (this.which === 'values') return es.map((e) => e.v);
    return es;
  }
  toJavaString() { return '[' + this.items().map(str).join(', ') + ']'; }
  javaEquals(o) {
    if (this.which === 'values') return o === this;
    if (!(o instanceof JSet || o instanceof JMapView) || o.size !== this.size) return false;
    const mine = this.items();
    return toArrayOf(o).every((x) => mine.some((y) => javaEquals(x, y)));
  }
  javaHashCode() { let h = 0; for (const k of this.items()) h = (h + javaHash(k)) | 0; return h; }
}
function viewContains(view, x) {
  if (view.which === 'keys') return !!view.map.findEntry(x);
  return view.items().some((y) => javaEquals(x, y));
}

// ======================= PriorityQueue (same algorithm as OpenJDK) =======================
export class JPQ {
  constructor(cmp = null) { this.q = []; this.cmp = cmp; this.modCount = 0; this.jclass = 'PriorityQueue'; }
  get size() { return this.q.length; }
  c(a, b) { return cmpFn(this.cmp)(a, b); }
  offer(x) {
    if (x === null) throw RT.npe();
    this.modCount++;
    let k = this.q.length;
    this.q.push(x);
    if (k === 0) { this.c(x, x); return true; }
    while (k > 0) {
      const parent = (k - 1) >>> 1;
      const e = this.q[parent];
      if (this.c(x, e) >= 0) break;
      this.q[k] = e;
      k = parent;
    }
    this.q[k] = x;
    return true;
  }
  siftDown(k, x) {
    const n = this.q.length;
    const half = n >>> 1;
    while (k < half) {
      let child = 2 * k + 1;
      let c = this.q[child];
      const right = child + 1;
      if (right < n && this.c(c, this.q[right]) > 0) c = this.q[child = right];
      if (this.c(x, c) <= 0) break;
      this.q[k] = c;
      k = child;
    }
    this.q[k] = x;
  }
  siftUp(k, x) {
    while (k > 0) {
      const parent = (k - 1) >>> 1;
      const e = this.q[parent];
      if (this.c(x, e) >= 0) break;
      this.q[k] = e;
      k = parent;
    }
    this.q[k] = x;
  }
  poll() {
    if (!this.q.length) return null;
    this.modCount++;
    const result = this.q[0];
    const x = this.q.pop();
    if (this.q.length) this.siftDown(0, x);
    return result;
  }
  removeAt(i) {
    this.modCount++;
    const s = this.q.length - 1;
    if (s === i) { this.q.pop(); return; }
    const moved = this.q.pop();
    this.siftDown(i, moved);
    if (this.q[i] === moved) this.siftUp(i, moved);
  }
  heapify() {
    for (let i = (this.q.length >>> 1) - 1; i >= 0; i--) this.siftDown(i, this.q[i]);
  }
  toJavaString() { return '[' + this.q.map(str).join(', ') + ']'; }
}

// ======================= Iterators =======================
class JIterator {
  constructor(hasNext, next, remove = null) {
    this.hasNext = hasNext;
    this.next = next;
    this.remove = remove;
    this.jclass = 'Iterator';
  }
}

function listIterator(list) {
  let cursor = 0, lastRet = -1, expected = list.modCount;
  const check = () => { if (list.modCount !== expected) throw thr('ConcurrentModificationException', null); };
  return new JIterator(
    () => cursor !== list.a.length,
    () => {
      check();
      if (cursor >= list.a.length) throw thr('NoSuchElementException', null);
      lastRet = cursor;
      return list.a[cursor++];
    },
    () => {
      if (lastRet < 0) throw thr('IllegalStateException', null);
      check();
      list.mutate();
      list.a.splice(lastRet, 1);
      cursor = lastRet;
      lastRet = -1;
      expected = list.modCount;
    },
  );
}

function snapshotIterator(owner, items, removeFn) {
  let i = 0, expected = owner.modCount, last;
  let hasLast = false;
  return new JIterator(
    () => i < items.length,
    () => {
      if (owner.modCount !== expected) throw thr('ConcurrentModificationException', null);
      if (i >= items.length) throw thr('NoSuchElementException', null);
      hasLast = true;
      last = items[i++];
      return last;
    },
    () => {
      if (!hasLast) throw thr('IllegalStateException', null);
      removeFn(last);
      hasLast = false;
      expected = owner.modCount;
    },
  );
}

export function iteratorOf(rt, v) {
  RT = rt;
  if (v instanceof JArray) {
    let i = 0;
    return new JIterator(() => i < v.data.length, () => v.data[i++]);
  }
  if (v instanceof JList) {
    if (v.kind === 'Stack' || v.kind === 'ArrayList' || v.kind === 'LinkedList' || v.kind === 'AsList' || v.kind === 'Immutable' || v.kind === 'ArrayDeque') {
      return listIterator(v);
    }
  }
  if (v instanceof JSet) return snapshotIterator(v.map, v.keys(), (k) => v.remove(k));
  if (v instanceof JMapView) {
    return snapshotIterator(v.map, v.items(), (x) => v.map.remove(v.which === 'entries' ? x.k : v.which === 'keys' ? x : v.map.entries().find((e) => e.v === x).k));
  }
  if (v instanceof JPQ) return snapshotIterator(v, v.q.slice(), (x) => v.removeAt(v.q.indexOf(x)));
  if (v instanceof JIterator) return v;
  if (v instanceof JStream) return snapshotIterator({ modCount: 0 }, v.a, () => {});
  if (v instanceof JObject) {
    const it = rt.callMethod(v, 'iterator', []);
    if (it instanceof JIterator) return it;
    return new JIterator(() => rt.callMethod(it, 'hasNext', []), () => rt.callMethod(it, 'next', []));
  }
  if (typeof v === 'string') throw compileError('for-each not applicable to expression type String (use s.toCharArray())');
  throw compileError(`for-each not applicable to expression type ${typeNameOf(v)}`);
}

function toArrayOf(v) {
  if (v instanceof JList) return v.a.slice();
  if (v instanceof JSet) return v.keys();
  if (v instanceof JMapView) return v.items();
  if (v instanceof JPQ) return v.q.slice();
  if (v instanceof JArray) return v.data.slice();
  if (v instanceof JStream) return v.a.slice();
  if (v === null) throw RT.npe();
  const out = [];
  const it = iteratorOf(RT, v);
  while (it.hasNext()) out.push(it.next());
  return out;
}

// ======================= Streams =======================
export class JStream {
  constructor(a, kind = 'obj') { this.a = a; this.kind = kind; this.jclass = { int: 'IntStream', long: 'LongStream', double: 'DoubleStream', obj: 'Stream' }[kind]; }
}
class JOptional {
  constructor(v, kind = 'obj') { this.v = v; this.kind = kind; this.jclass = 'Optional'; }
  toJavaString() {
    const prefix = { int: 'OptionalInt', double: 'OptionalDouble', long: 'OptionalLong', obj: 'Optional' }[this.kind];
    return this.v === undefined ? prefix + '.empty' : `${prefix}[${str(this.v)}]`;
  }
}
class JCollector {
  constructor(fn) { this.fn = fn; this.jclass = 'Collector'; }
}

function sumOf(a, kind) {
  if (kind === 'double') return mkDouble(a.reduce((s, x) => s + toNumber(x), 0));
  if (kind === 'long') return mkLong(a.reduce((s, x) => s + toBig(x), 0n));
  return a.reduce((s, x) => (s + toInt(x)) | 0, 0);
}

function streamMethod(s, name, args) {
  const a = s.a;
  const f = args[0];
  switch (name) {
    case 'map': return new JStream(a.map((x) => coerceKind(call(f, x), s.kind)), s.kind);
    case 'mapToInt': return new JStream(a.map((x) => toInt(call(f, x))), 'int');
    case 'mapToLong': return new JStream(a.map((x) => mkLong(toBig(call(f, x)))), 'long');
    case 'mapToDouble': return new JStream(a.map((x) => mkDouble(toNumber(call(f, x)))), 'double');
    case 'mapToObj': return new JStream(a.map((x) => call(f, x)), 'obj');
    case 'asDoubleStream': return new JStream(a.map((x) => mkDouble(toNumber(x))), 'double');
    case 'asLongStream': return new JStream(a.map((x) => mkLong(toBig(x))), 'long');
    case 'boxed': return new JStream(a.slice(), 'obj');
    case 'filter': return new JStream(a.filter((x) => bool(call(f, x))), s.kind);
    case 'flatMap': return new JStream(a.flatMap((x) => toArrayOf(call(f, x))), s.kind);
    case 'peek': a.forEach((x) => call(f, x)); return s;
    case 'sorted': { const b = a.slice(); b.sort(cmpFn(f)); return new JStream(b, s.kind); }
    case 'distinct': {
      const seen = new JSet('LinkedHashSet');
      a.forEach((x) => seen.add(x));
      return new JStream(seen.keys(), s.kind);
    }
    case 'limit': return new JStream(a.slice(0, Number(toBig(f))), s.kind);
    case 'skip': return new JStream(a.slice(Number(toBig(f))), s.kind);
    case 'forEach': case 'forEachOrdered': a.forEach((x) => call(f, x)); return undefined;
    case 'sum': return sumOf(a, s.kind);
    case 'count': return mkLong(a.length);
    case 'average': return a.length ? new JOptional(mkDouble(a.reduce((t, x) => t + toNumber(x), 0) / a.length), 'double') : new JOptional(undefined, 'double');
    case 'max': case 'min': {
      if (!a.length) return new JOptional(undefined, s.kind);
      const c = s.kind === 'obj' ? cmpFn(f) : compareNatural;
      let best = a[0];
      for (const x of a.slice(1)) {
        const d = c(x, best);
        if (name === 'max' ? d > 0 : d < 0) best = x;
      }
      return new JOptional(best, s.kind);
    }
    case 'reduce': {
      if (args.length === 2) return a.reduce((acc, x) => call(args[1], acc, x), args[0]);
      if (!a.length) return new JOptional(undefined, s.kind);
      return new JOptional(a.slice(1).reduce((acc, x) => call(f, acc, x), a[0]), s.kind);
    }
    case 'anyMatch': return a.some((x) => bool(call(f, x)));
    case 'allMatch': return a.every((x) => bool(call(f, x)));
    case 'noneMatch': return !a.some((x) => bool(call(f, x)));
    case 'findFirst': case 'findAny': return new JOptional(a.length ? a[0] : undefined, s.kind);
    case 'toList': return new JList('Immutable', a.slice());
    case 'toArray': {
      const et = s.kind === 'obj' ? T('Object') : T(s.kind);
      return new JArray(et, a.slice());
    }
    case 'collect': return f.fn(a);
    case 'summaryStatistics': return new JStream(a, s.kind);
    case 'getMax': return a.reduce((m, x) => (compareNatural(x, m) > 0 ? x : m));
    case 'getMin': return a.reduce((m, x) => (compareNatural(x, m) < 0 ? x : m));
    case 'getSum': return sumOf(a, s.kind === 'int' ? 'long' : s.kind);
    case 'getAverage': return mkDouble(a.length ? a.reduce((t, x) => t + toNumber(x), 0) / a.length : 0);
    case 'getCount': return mkLong(a.length);
    case 'iterator': return snapshotIterator({ modCount: 0 }, a, () => {});
    default: throw fail(name, args, s.jclass);
  }
}
function coerceKind(v, kind) {
  if (kind === 'int') return toInt(v);
  if (kind === 'double') return mkDouble(toNumber(v));
  if (kind === 'long') return mkLong(toBig(v));
  return v;
}

function optionalMethod(o, name, args) {
  switch (name) {
    case 'isPresent': return o.v !== undefined;
    case 'isEmpty': return o.v === undefined;
    case 'get': case 'getAsInt': case 'getAsDouble': case 'getAsLong': case 'orElseThrow':
      if (o.v === undefined) throw thr('NoSuchElementException', 'No value present');
      return o.v;
    case 'orElse': return o.v === undefined ? args[0] : o.v;
    case 'orElseGet': return o.v === undefined ? call(args[0]) : o.v;
    case 'ifPresent': if (o.v !== undefined) call(args[0], o.v); return undefined;
    case 'map': return new JOptional(o.v === undefined ? undefined : call(args[0], o.v));
    default: throw fail(name, args, 'Optional');
  }
}

// ======================= Random (java.util.Random LCG) =======================
class JRandom {
  constructor(seed) {
    this.jclass = 'Random';
    this.seed = (BigInt(seed) ^ 0x5DEECE66Dn) & ((1n << 48n) - 1n);
  }
  next(bits) {
    this.seed = (this.seed * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n);
    return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
  }
  nextInt(bound) {
    if (bound === undefined) return this.next(32);
    if (bound <= 0) throw thr('IllegalArgumentException', 'bound must be positive');
    if ((bound & -bound) === bound) return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
    let bits, val;
    do {
      bits = this.next(31);
      val = bits % bound;
    } while (bits - val + (bound - 1) > 2147483647 || bits - val + (bound - 1) < 0);
    return val;
  }
  nextDouble() {
    const hi = BigInt(this.next(26)), lo = BigInt(this.next(27));
    return Number((hi << 27n) + lo) * 2 ** -53;
  }
  nextBoolean() { return this.next(1) !== 0; }
}

// ======================= Scanner =======================
class JScanner {
  constructor(rt) { this.rt = rt; this.jclass = 'Scanner'; }
  skipWs() { const s = this.rt.stdin; while (this.rt.stdinPos < s.length && /\s/.test(s[this.rt.stdinPos])) this.rt.stdinPos++; }
  peekToken() {
    const s = this.rt.stdin;
    let p = this.rt.stdinPos;
    while (p < s.length && /\s/.test(s[p])) p++;
    let q = p;
    while (q < s.length && !/\s/.test(s[q])) q++;
    return p < s.length ? { tok: s.slice(p, q), end: q } : null;
  }
  token() {
    const t = this.peekToken();
    if (!t) throw thr('NoSuchElementException', null);
    this.rt.stdinPos = t.end;
    return t.tok;
  }
}

// ======================= String.format =======================
export function javaFormat(fmt, args) {
  let ai = 0;
  return fmt.replace(/%(\d+\$)?([-#+ 0,(]*)(\d+)?(\.\d+)?([a-zA-Z%])/g, (m, idx, flags, width, prec, conv) => {
    if (conv === 'n') return '\n';
    if (conv === '%') return pad('%', flags, width);
    let arg;
    if (idx) arg = args[parseInt(idx, 10) - 1];
    else {
      if (ai >= args.length) throw thr('MissingFormatArgumentException', `Format specifier '${m}'`);
      arg = args[ai++];
    }
    let out;
    const p = prec ? parseInt(prec.slice(1), 10) : undefined;
    const bad = () => thr('IllegalFormatConversionException', `${conv} != ${javaClassName(arg)}`);
    switch (conv) {
      case 'd': {
        if (!(typeof arg === 'number' || arg instanceof JLong)) throw bad();
        let s = (typeof arg === 'number' ? BigInt(arg) : arg.v).toString();
        let neg = s.startsWith('-');
        if (neg) s = s.slice(1);
        if (flags.includes(',')) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        if (neg) s = flags.includes('(') ? '(' + s + ')' : '-' + s;
        else if (flags.includes('+')) s = '+' + s;
        else if (flags.includes(' ')) s = ' ' + s;
        out = s;
        if (flags.includes('0') && width && out.length < +width) {
          const sign = /^[-+ ]/.test(out) ? out[0] : '';
          out = sign + out.slice(sign.length).padStart(+width - sign.length, '0');
        }
        break;
      }
      case 'f': case 'e': case 'E': {
        if (!(arg instanceof JDouble)) throw bad();
        const x = arg.v;
        if (!Number.isFinite(x)) { out = Number.isNaN(x) ? 'NaN' : x > 0 ? 'Infinity' : '-Infinity'; break; }
        if (conv === 'f') {
          out = roundHalfUp(Math.abs(x), p ?? 6);
          if (flags.includes(',')) {
            const [i, d] = out.split('.');
            out = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d !== undefined ? '.' + d : '');
          }
        } else {
          out = Math.abs(x).toExponential(p ?? 6).replace(/e([+-])(\d)$/, 'e$10$2');
          if (conv === 'E') out = out.toUpperCase();
        }
        const neg = x < 0 || Object.is(x, -0);
        if (neg) out = '-' + out;
        else if (flags.includes('+')) out = '+' + out;
        if (flags.includes('0') && width && out.length < +width) {
          const sign = /^[-+]/.test(out) ? out[0] : '';
          out = sign + out.slice(sign.length).padStart(+width - sign.length, '0');
        }
        break;
      }
      case 's': case 'S':
        out = str(arg);
        if (p !== undefined) out = out.slice(0, p);
        if (conv === 'S') out = out.toUpperCase();
        break;
      case 'c': case 'C':
        if (arg instanceof JChar) out = String.fromCharCode(arg.c);
        else if (typeof arg === 'number') out = String.fromCharCode(arg);
        else throw bad();
        if (conv === 'C') out = out.toUpperCase();
        break;
      case 'b': case 'B':
        out = arg === null ? 'false' : typeof arg === 'boolean' ? String(arg) : 'true';
        if (conv === 'B') out = out.toUpperCase();
        break;
      case 'x': case 'X': case 'o': {
        if (!(typeof arg === 'number' || arg instanceof JLong)) throw bad();
        const radix = conv === 'o' ? 8 : 16;
        out = typeof arg === 'number' ? (arg >>> 0).toString(radix) : BigInt.asUintN(64, arg.v).toString(radix);
        if (flags.includes('#')) out = (radix === 16 ? '0x' : '0') + out;
        if (conv === 'X') out = out.toUpperCase();
        if (flags.includes('0') && width) out = out.padStart(+width, '0');
        break;
      }
      case 'h': out = (javaHash(arg) >>> 0).toString(16); break;
      default:
        throw thr('UnknownFormatConversionException', `Conversion = '${conv}'`);
    }
    return pad(out, flags, width);
  });
}
function pad(s, flags, width) {
  if (!width || s.length >= +width) return s;
  return flags.includes('-') ? s.padEnd(+width) : s.padStart(+width);
}
function roundHalfUp(x, p) {
  // Use exact decimal expansion of the double, then round half-up like java.util.Formatter.
  let s = x.toFixed(Math.min(100, p + 30));
  const [ip, fp = ''] = s.split('.');
  const digits = (ip + fp.slice(0, p)).split('').map(Number);
  const next = +(fp[p] || 0);
  if (next >= 5) {
    let i = digits.length - 1;
    while (i >= 0) {
      if (digits[i] === 9) { digits[i] = 0; i--; } else { digits[i]++; break; }
    }
    if (i < 0) digits.unshift(1);
  }
  const intLen = digits.length - p;
  const ints = digits.slice(0, intLen).join('') || '0';
  const fr = digits.slice(intLen).join('');
  return p > 0 ? ints + '.' + fr : ints;
}

// ======================= helpers =======================
function charArg(v) {
  if (v instanceof JChar) return String.fromCharCode(v.c);
  if (typeof v === 'number') return String.fromCharCode(v);
  return str(v);
}
function seqArg(v) {
  if (v === null) throw RT.npe();
  if (typeof v === 'string') return v;
  if (v instanceof JStringBuilder) return v.s;
  throw compileError(`incompatible types: ${typeNameOf(v)} cannot be converted to CharSequence`);
}

function toJavaRegex(re) {
  // Java and JS regex syntax overlap for everything we expect beginners to use.
  return re.replace(/\\p\{Alpha\}/g, '[A-Za-z]').replace(/\\p\{Punct\}/g, '[!-\\/:-@\\[-`{-~]').replace(/\\p\{Upper\}/g, '[A-Z]').replace(/\\p\{Lower\}/g, '[a-z]').replace(/\\p\{Digit\}/g, '[0-9]').replace(/\\p\{Alnum\}/g, '[A-Za-z0-9]').replace(/\(\?<([a-zA-Z][a-zA-Z0-9]*)>/g, '(?<$1>');
}
function regex(re, flags = 'g') {
  try {
    return new RegExp(toJavaRegex(re), flags);
  } catch (e) {
    throw thr('PatternSyntaxException', e.message);
  }
}

function javaSplit(s, re, limit = 0) {
  if (s === '') return [''];
  const parts = [];
  // fast path for single literal chars that are not regex-special
  const rx = regex(re);
  let last = 0;
  let m;
  rx.lastIndex = 0;
  while ((m = rx.exec(s)) !== null) {
    if (m[0].length === 0) {
      if (m.index >= s.length) break;
      if (m.index === 0) { rx.lastIndex++; continue; }
    }
    if (limit > 0 && parts.length === limit - 1) break;
    if (!(m.index === 0 && m[0].length > 0 && last === 0 && false)) parts.push(s.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[0].length === 0) rx.lastIndex++;
  }
  parts.push(s.slice(last));
  // a zero-width match at position 0 never yields a leading empty string; a real match does
  if (limit === 0) while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
  if (limit === 0 && parts.length === 1 && parts[0] === '' && s !== '') return [];
  return parts;
}

function strArray(list) { return new JArray(T('String'), list); }
function charArray(s) { return new JArray(T('char'), Array.from({ length: s.length }, (_, i) => mkChar(s.charCodeAt(i)))); }

function parseIntJava(s, radix = 10, isLong = false) {
  if (s === null) throw thr('NumberFormatException', 'Cannot parse null string: null');
  const valid = radix === 10 ? /^[+-]?\d+$/ : new RegExp(`^[+-]?[0-9a-${String.fromCharCode(86 + radix)}]+$`, 'i');
  const msg = radix === 10 ? `For input string: "${s}"` : `For input string: "${s}" under radix ${radix}`;
  if (!valid.test(s)) throw thr('NumberFormatException', msg);
  let neg = s[0] === '-';
  const body = s.replace(/^[+-]/, '');
  let v = 0n;
  for (const ch of body.toLowerCase()) v = v * BigInt(radix) + BigInt(parseInt(ch, radix));
  if (neg) v = -v;
  if (isLong) {
    if (v > 9223372036854775807n || v < -9223372036854775808n) throw thr('NumberFormatException', msg);
    return mkLong(v);
  }
  if (v > 2147483647n || v < -2147483648n) throw thr('NumberFormatException', msg);
  return Number(v);
}

function parseDoubleJava(s) {
  if (s === null) throw RT.npe();
  const t = s.trim();
  if (/^[+-]?(NaN|Infinity)$/.test(t)) return mkDouble(parseFloat(t.replace('Infinity', 'Infinity')));
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[fFdD]?$/.test(t)) throw thr('NumberFormatException', t === '' ? 'empty String' : `For input string: "${s}"`);
  return mkDouble(parseFloat(t));
}

function arraysToString(a) {
  if (a === null) return 'null';
  if (!(a instanceof JArray)) throw compileError(`no suitable method found for toString(${typeNameOf(a)})`);
  return '[' + a.data.map(str).join(', ') + ']';
}
function deepToString(a) {
  if (a === null) return 'null';
  return '[' + a.data.map((x) => (x instanceof JArray ? deepToString(x) : str(x))).join(', ') + ']';
}

function sortArrayData(data, from, to, c, isPrim) {
  const part = data.slice(from, to);
  if (isPrim) part.sort((x, y) => compareNatural(x, y));
  else part.sort(c ? cmpFn(c) : (x, y) => compareNatural(x, y));
  for (let i = 0; i < part.length; i++) data[from + i] = part[i];
}

function newCollectionFrom(kind, src) {
  const items = toArrayOf(src);
  return items;
}

function mathMinMax(name, a, b) {
  const ka = kindOf(a), kb = kindOf(b);
  if (!ka || !kb) throw RT.npe();
  if (ka === 'double' || kb === 'double') {
    const x = toNumber(a), y = toNumber(b);
    if (Number.isNaN(x) || Number.isNaN(y)) return mkDouble(NaN);
    return mkDouble(name === 'max' ? Math.max(x, y) : Math.min(x, y));
  }
  if (ka === 'long' || kb === 'long') {
    const x = toBig(a), y = toBig(b);
    return mkLong(name === 'max' ? (x > y ? x : y) : (x < y ? x : y));
  }
  const x = toInt(a), y = toInt(b);
  return name === 'max' ? Math.max(x, y) : Math.min(x, y);
}

const ORDER_REVERSE = () => fn((args) => -compareNatural(args[0], args[1]) | 0, 'Collections$ReverseComparator');
const ORDER_NATURAL = () => fn((args) => compareNatural(args[0], args[1]), 'Comparators$NaturalOrderComparator');

// Simple functional object usable as Comparator / Function etc.
class JFunc2 {
  constructor(invoke, label = 'Lambda') { this.invoke = invoke; this.jclass = label; }
  toJavaString() { return this.jclass + '@' + identityHash(this).toString(16); }
}
function fn(invoke, label) {
  const F = RT.constructor.JFuncClass;
  if (F) return new F(invoke, label);
  return new JFunc2(invoke, label);
}

export function classObject(name) {
  return { jclass: 'Class', name, toJavaString: () => 'class ' + name };
}

// ======================= static classes =======================
const STATIC_CLASSES = new Set(['Math', 'Integer', 'Long', 'Double', 'Float', 'Short', 'Byte', 'Character', 'Boolean', 'String',
  'Arrays', 'Collections', 'System', 'List', 'Set', 'Map', 'Objects', 'Comparator', 'IntStream', 'LongStream', 'DoubleStream',
  'Stream', 'Collectors', 'Thread', 'Optional', 'Entry', 'Map.Entry', 'Function', 'StrictMath', 'ThreadLocalRandom', 'Character.UnicodeBlock',
  'StringBuilder', 'ArrayList', 'HashMap', 'HashSet', 'LinkedList', 'ArrayDeque', 'TreeMap', 'TreeSet', 'PriorityQueue', 'Stack',
  'LinkedHashMap', 'LinkedHashSet', 'Random', 'Scanner', 'Object', 'Iterator', 'Number', 'Deque', 'Queue', 'Collection', 'Iterable',
  'BiFunction', 'Predicate', 'Consumer', 'Supplier', 'Runnable', 'Comparable', 'CharSequence', 'StringBuffer', 'UnaryOperator', 'BinaryOperator']);

export function isStaticClass(name) { return STATIC_CLASSES.has(name); }

const STATIC_FIELDS = {
  Integer: { MAX_VALUE: 2147483647, MIN_VALUE: -2147483648, SIZE: 32, BYTES: 4 },
  Long: { MAX_VALUE: () => mkLong(9223372036854775807n), MIN_VALUE: () => mkLong(-9223372036854775808n), SIZE: 64 },
  Double: {
    MAX_VALUE: () => mkDouble(Number.MAX_VALUE), MIN_VALUE: () => mkDouble(Number.MIN_VALUE),
    POSITIVE_INFINITY: () => mkDouble(Infinity), NEGATIVE_INFINITY: () => mkDouble(-Infinity), NaN: () => mkDouble(NaN),
  },
  Float: { MAX_VALUE: () => mkDouble(3.4028234663852886e38), MIN_VALUE: () => mkDouble(1.401298464324817e-45) },
  Short: { MAX_VALUE: 32767, MIN_VALUE: -32768 },
  Byte: { MAX_VALUE: 127, MIN_VALUE: -128 },
  Character: { MAX_VALUE: () => mkChar(0xffff), MIN_VALUE: () => mkChar(0) },
  Boolean: { TRUE: true, FALSE: false },
  Math: { PI: () => mkDouble(Math.PI), E: () => mkDouble(Math.E) },
  StrictMath: { PI: () => mkDouble(Math.PI), E: () => mkDouble(Math.E) },
  String: { CASE_INSENSITIVE_ORDER: () => fn((a) => stringCompare(a[0].toLowerCase(), a[1].toLowerCase()), 'CaseInsensitiveComparator') },
};

export function getStaticField(rt, cls, name, line) {
  RT = rt;
  if (cls === 'System') {
    if (name === 'out') return rt.__out || (rt.__out = new PrintStream(false));
    if (name === 'err') return rt.__err || (rt.__err = new PrintStream(true));
    if (name === 'in') return { jclass: 'InputStream' };
  }
  if (cls === 'Map' && name === 'Entry') return new (rt.constructor.ClassRefClass)('Map.Entry');
  const f = STATIC_FIELDS[cls] && STATIC_FIELDS[cls][name];
  if (f !== undefined) return typeof f === 'function' ? f() : f;
  throw compileError(`cannot find symbol: variable ${name} in ${cls}`, line);
}

const STATIC_METHOD_NAMES = {
  Math: ['abs', 'max', 'min', 'pow', 'sqrt', 'cbrt', 'floor', 'ceil', 'round', 'random', 'floorDiv', 'floorMod', 'log', 'log10', 'exp', 'hypot', 'signum', 'sin', 'cos', 'tan', 'atan', 'atan2', 'toRadians', 'toDegrees', 'rint', 'addExact', 'subtractExact', 'multiplyExact', 'negateExact', 'toIntExact', 'abs', 'log1p', 'asin', 'acos', 'incrementExact', 'decrementExact', 'absExact', 'clamp'],
  Integer: ['parseInt', 'valueOf', 'toString', 'toBinaryString', 'toHexString', 'toOctalString', 'bitCount', 'max', 'min', 'sum', 'compare', 'signum', 'reverse', 'highestOneBit', 'lowestOneBit', 'numberOfTrailingZeros', 'numberOfLeadingZeros', 'hashCode', 'parseUnsignedInt'],
  Long: ['parseLong', 'valueOf', 'toString', 'compare', 'sum', 'max', 'min', 'toBinaryString', 'bitCount', 'hashCode', 'signum', 'numberOfTrailingZeros', 'toHexString', 'abs'],
  Double: ['parseDouble', 'valueOf', 'isNaN', 'isInfinite', 'compare', 'toString', 'sum', 'max', 'min', 'isFinite', 'hashCode'],
  Character: ['isDigit', 'isLetter', 'isLetterOrDigit', 'isAlphabetic', 'isUpperCase', 'isLowerCase', 'isWhitespace', 'isSpaceChar', 'toUpperCase', 'toLowerCase', 'getNumericValue', 'toString', 'valueOf', 'compare', 'forDigit', 'digit', 'hashCode', 'toChars'],
  Boolean: ['parseBoolean', 'valueOf', 'toString', 'compare', 'logicalAnd', 'logicalOr', 'logicalXor'],
  String: ['valueOf', 'join', 'format', 'copyValueOf'],
};

export function hasStatic(cls, name, nargs) {
  const names = STATIC_METHOD_NAMES[cls];
  if (!names) return !['Comparator', 'Object'].includes(cls) && !(cls === 'String');
  if (cls === 'Integer' && name === 'toString' && nargs === 1) return true;
  if (cls === 'Integer' && ['compareTo', 'intValue', 'equals'].includes(name)) return false;
  return names.includes(name);
}

export function callStatic(rt, cls, name, args, argNodes, line) {
  RT = rt;
  const a0 = args[0], a1 = args[1];
  switch (cls) {
    case 'Math': case 'StrictMath':
      switch (name) {
        case 'abs': {
          const k = kindOf(a0);
          if (k === 'double') return mkDouble(Math.abs(a0.v));
          if (k === 'long') return mkLong(a0.v < 0n ? -a0.v : a0.v);
          return Math.abs(toInt(a0)) | 0;
        }
        case 'max': case 'min': return mathMinMax(name, a0, a1);
        case 'pow': return mkDouble(Math.pow(toNumber(a0), toNumber(a1)));
        case 'sqrt': case 'cbrt': case 'floor': case 'ceil': case 'log': case 'log10': case 'exp': case 'sin': case 'cos': case 'tan':
        case 'atan': case 'asin': case 'acos': case 'log1p':
          return mkDouble(Math[name](toNumber(a0)));
        case 'rint': {
          const x = toNumber(a0);
          const r = Math.round(x);
          return mkDouble(Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : r);
        }
        case 'signum': return kindOf(a0) === 'double' ? mkDouble(Math.sign(a0.v)) : mkDouble(Math.sign(toNumber(a0)));
        case 'hypot': return mkDouble(Math.hypot(toNumber(a0), toNumber(a1)));
        case 'atan2': return mkDouble(Math.atan2(toNumber(a0), toNumber(a1)));
        case 'toRadians': return mkDouble(toNumber(a0) / 180 * Math.PI);
        case 'toDegrees': return mkDouble(toNumber(a0) * 180 / Math.PI);
        case 'round': {
          const x = toNumber(a0);
          if (kindOf(a0) !== 'double') return kindOf(a0) === 'long' ? a0 : mkLong(BigInt(toInt(a0)));
          if (Number.isNaN(x)) return mkLong(0n);
          return mkLong(BigInt(Math.floor(x + 0.5)));
        }
        case 'random': return mkDouble(Math.random());
        case 'floorDiv': case 'floorMod': {
          if (kindOf(a0) === 'long' || kindOf(a1) === 'long') {
            const x = toBig(a0), y = toBig(a1);
            if (y === 0n) throw thr('ArithmeticException', '/ by zero');
            let q = x / y;
            if ((x % y !== 0n) && ((x < 0n) !== (y < 0n))) q -= 1n;
            return name === 'floorDiv' ? mkLong(q) : mkLong(x - q * y);
          }
          const x = toInt(a0), y = toInt(a1);
          if (y === 0) throw thr('ArithmeticException', '/ by zero');
          const q = Math.floor(x / y);
          return name === 'floorDiv' ? q | 0 : (x - q * y) | 0;
        }
        case 'addExact': case 'subtractExact': case 'multiplyExact': {
          if (kindOf(a0) === 'long' || kindOf(a1) === 'long') {
            const x = toBig(a0), y = toBig(a1);
            const r = name === 'addExact' ? x + y : name === 'subtractExact' ? x - y : x * y;
            if (r !== BigInt.asIntN(64, r)) throw thr('ArithmeticException', 'long overflow');
            return mkLong(r);
          }
          const x = toInt(a0), y = toInt(a1);
          const r = name === 'addExact' ? x + y : name === 'subtractExact' ? x - y : x * y;
          if (r > 2147483647 || r < -2147483648) throw thr('ArithmeticException', 'integer overflow');
          return r;
        }
        case 'negateExact': return -toInt(a0) | 0;
        case 'incrementExact': if (a0 === 2147483647) throw thr('ArithmeticException', 'integer overflow'); return a0 + 1;
        case 'decrementExact': if (a0 === -2147483648) throw thr('ArithmeticException', 'integer overflow'); return a0 - 1;
        case 'toIntExact': {
          const x = toBig(a0);
          if (x !== BigInt.asIntN(32, x)) throw thr('ArithmeticException', 'integer overflow');
          return Number(x);
        }
        default: break;
      }
      break;
    case 'Integer': case 'Short': case 'Byte':
      switch (name) {
        case 'parseInt': case 'parseShort': case 'parseByte': return parseIntJava(a0, a1 ?? 10);
        case 'valueOf': return typeof a0 === 'string' ? parseIntJava(a0, a1 ?? 10) : toInt(a0);
        case 'toString': return a1 !== undefined ? (toInt(a0)).toString(a1) : String(toInt(a0));
        case 'toBinaryString': return (toInt(a0) >>> 0).toString(2);
        case 'toHexString': return (toInt(a0) >>> 0).toString(16);
        case 'toOctalString': return (toInt(a0) >>> 0).toString(8);
        case 'bitCount': { let x = toInt(a0) >>> 0, c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }
        case 'max': return Math.max(a0, a1);
        case 'min': return Math.min(a0, a1);
        case 'sum': return (a0 + a1) | 0;
        case 'compare': return a0 < a1 ? -1 : a0 > a1 ? 1 : 0;
        case 'signum': return Math.sign(a0);
        case 'hashCode': return a0;
        case 'reverse': { let x = toInt(a0) >>> 0, r = 0; for (let i = 0; i < 32; i++) { r = (r << 1) | (x & 1); x >>>= 1; } return r | 0; }
        case 'highestOneBit': return a0 === 0 ? 0 : (1 << (31 - Math.clz32(a0))) | 0;
        case 'lowestOneBit': return a0 & -a0;
        case 'numberOfLeadingZeros': return Math.clz32(a0);
        case 'numberOfTrailingZeros': return a0 === 0 ? 32 : 31 - Math.clz32(a0 & -a0);
        default: break;
      }
      break;
    case 'Long':
      switch (name) {
        case 'parseLong': return parseIntJava(a0, a1 ?? 10, true);
        case 'valueOf': return typeof a0 === 'string' ? parseIntJava(a0, 10, true) : mkLong(toBig(a0));
        case 'toString': return toBig(a0).toString(a1 ?? 10);
        case 'compare': { const x = toBig(a0), y = toBig(a1); return x < y ? -1 : x > y ? 1 : 0; }
        case 'sum': return mkLong(toBig(a0) + toBig(a1));
        case 'max': case 'min': return mathMinMax(name, castTo(T('long'), a0), castTo(T('long'), a1));
        case 'toBinaryString': return BigInt.asUintN(64, toBig(a0)).toString(2);
        case 'toHexString': return BigInt.asUintN(64, toBig(a0)).toString(16);
        case 'bitCount': return [...BigInt.asUintN(64, toBig(a0)).toString(2)].filter((c) => c === '1').length;
        case 'hashCode': return javaHash(castTo(T('long'), a0));
        case 'signum': { const x = toBig(a0); return x > 0n ? 1 : x < 0n ? -1 : 0; }
        case 'abs': { const x = toBig(a0); return mkLong(x < 0n ? -x : x); }
        default: break;
      }
      break;
    case 'Double': case 'Float':
      switch (name) {
        case 'parseDouble': case 'parseFloat': return parseDoubleJava(a0);
        case 'valueOf': return typeof a0 === 'string' ? parseDoubleJava(a0) : mkDouble(toNumber(a0));
        case 'isNaN': return Number.isNaN(toNumber(a0));
        case 'isInfinite': return Math.abs(toNumber(a0)) === Infinity;
        case 'isFinite': return Number.isFinite(toNumber(a0));
        case 'compare': return doubleCompare(toNumber(a0), toNumber(a1));
        case 'toString': return fmtDouble(toNumber(a0));
        case 'sum': return mkDouble(toNumber(a0) + toNumber(a1));
        case 'max': return mkDouble(Math.max(toNumber(a0), toNumber(a1)));
        case 'min': return mkDouble(Math.min(toNumber(a0), toNumber(a1)));
        case 'hashCode': return javaHash(mkDouble(toNumber(a0)));
        default: break;
      }
      break;
    case 'Character': {
      const isCharArg = a0 instanceof JChar;
      const c = a0 instanceof JChar ? a0.c : typeof a0 === 'number' ? a0 : null;
      const ch = c === null ? '' : String.fromCharCode(c);
      const ret = (code) => (isCharArg ? mkChar(code) : code);
      switch (name) {
        case 'isDigit': return /\p{Nd}/u.test(ch);
        case 'isLetter': return /\p{L}/u.test(ch);
        case 'isLetterOrDigit': return /[\p{L}\p{Nd}]/u.test(ch);
        case 'isAlphabetic': return /\p{Alphabetic}/u.test(ch);
        case 'isUpperCase': return /\p{Lu}/u.test(ch);
        case 'isLowerCase': return /\p{Ll}/u.test(ch);
        case 'isWhitespace': return /[\t\n\u000b\f\r\u001c-\u001f ]/.test(ch) || (/\s/.test(ch) && !/[   ]/.test(ch));
        case 'isSpaceChar': return /\p{Zs}|\p{Zl}|\p{Zp}/u.test(ch);
        case 'toUpperCase': { const u = ch.toUpperCase(); return ret(u.length === 1 ? u.charCodeAt(0) : c); }
        case 'toLowerCase': { const l = ch.toLowerCase(); return ret(l.length === 1 ? l.charCodeAt(0) : c); }
        case 'getNumericValue': {
          if (/[0-9]/.test(ch)) return c - 48;
          if (/[a-z]/i.test(ch)) return ch.toLowerCase().charCodeAt(0) - 87;
          return -1;
        }
        case 'digit': {
          const d = parseInt(ch, a1);
          return Number.isNaN(d) ? -1 : d;
        }
        case 'forDigit': return a0 >= 0 && a0 < a1 ? mkChar(a0.toString(a1).charCodeAt(0)) : mkChar(0);
        case 'toString': case 'valueOf': return name === 'toString' ? ch : mkChar(c);
        case 'compare': return a0.c - a1.c;
        case 'hashCode': return c;
        case 'toChars': return new JArray(T('char'), [mkChar(c)]);
        default: break;
      }
      break;
    }
    case 'Boolean':
      switch (name) {
        case 'parseBoolean': return typeof a0 === 'string' && a0.toLowerCase() === 'true';
        case 'valueOf': return typeof a0 === 'boolean' ? a0 : typeof a0 === 'string' && a0.toLowerCase() === 'true';
        case 'toString': return String(a0);
        case 'compare': return a0 === a1 ? 0 : a0 ? 1 : -1;
        case 'logicalAnd': return a0 && a1;
        case 'logicalOr': return a0 || a1;
        case 'logicalXor': return a0 !== a1;
        default: break;
      }
      break;
    case 'String':
      switch (name) {
        case 'valueOf': case 'copyValueOf':
          if (a0 instanceof JArray && a0.elemType.base === 'char') {
            const d = args.length === 3 ? a0.data.slice(a1, a1 + args[2]) : a0.data;
            return d.map((x) => String.fromCharCode(x.c)).join('');
          }
          return str(a0);
        case 'join': {
          const delim = seqArg(a0);
          let items;
          if (args.length === 2 && (a1 instanceof JList || a1 instanceof JSet || a1 instanceof JMapView || (a1 instanceof JArray))) items = toArrayOf(a1);
          else items = args.slice(1);
          return items.map(str).join(delim);
        }
        case 'format': return javaFormat(a0, args.slice(1));
        default: break;
      }
      break;
    case 'Arrays': return arraysStatic(name, args);
    case 'Collections': return collectionsStatic(name, args);
    case 'System':
      switch (name) {
        case 'currentTimeMillis': return mkLong(BigInt(Date.now()));
        case 'nanoTime': return mkLong(BigInt(Math.round(performance.now() * 1e6)));
        case 'lineSeparator': return '\n';
        case 'exit': throw new InterpError('exit', 'System.exit(' + a0 + ')');
        case 'identityHashCode': return a0 === null ? 0 : identityHash(a0);
        case 'arraycopy': {
          const [src, sp, dst, dp, len] = args;
          if (src === null || dst === null) throw rt.npe();
          if (sp < 0 || dp < 0 || len < 0 || sp + len > src.data.length || dp + len > dst.data.length) {
            throw thr('ArrayIndexOutOfBoundsException', `arraycopy: last source index ${sp + len} out of bounds for length ${src.data.length}`);
          }
          const tmp = src.data.slice(sp, sp + len);
          for (let i = 0; i < len; i++) dst.data[dp + i] = tmp[i];
          return undefined;
        }
        case 'getenv': case 'getProperty': return null;
        default: break;
      }
      break;
    case 'Thread':
      if (name === 'sleep') return undefined;
      break;
    case 'List': case 'Set':
      if (name === 'of' || name === 'copyOf') {
        let items = args;
        if (name === 'copyOf') items = toArrayOf(a0);
        else if (args.length === 1 && a0 instanceof JArray && !['int', 'char', 'double', 'long', 'boolean'].includes(a0.elemType.base)) items = a0.data.slice();
        if (items.some((x) => x === null)) throw rt.npe();
        if (cls === 'List') return new JList('Immutable', items.slice());
        const s = new JSet('Immutable');
        s.immutable = false;
        for (const x of items) if (!s.add(x) && name === 'of') throw thr('IllegalArgumentException', 'duplicate element: ' + str(x));
        s.immutable = true;
        return s;
      }
      break;
    case 'Map':
      if (name === 'of' || name === 'ofEntries' || name === 'copyOf') {
        const m = new JMap('HashMap');
        if (name === 'of') for (let i = 0; i < args.length; i += 2) m.put(args[i], args[i + 1]);
        else if (name === 'copyOf') for (const e of a0.entries()) m.put(e.k, e.v);
        else for (const e of args) m.put(e.k, e.v);
        m.kind = 'Immutable';
        m.jclass = 'ImmutableCollections.MapN';
        return m;
      }
      if (name === 'entry') return new JEntry(a0, a1);
      break;
    case 'Map.Entry': case 'Entry':
      if (name === 'comparingByKey') return fn((ab) => (a0 ? cmpFn(a0) : compareNatural)(ab[0].k, ab[1].k));
      if (name === 'comparingByValue') return fn((ab) => (a0 ? cmpFn(a0) : compareNatural)(ab[0].v, ab[1].v));
      break;
    case 'Objects':
      switch (name) {
        case 'equals': return javaEquals(a0, a1);
        case 'hash': { let h = 1; for (const x of args) h = (Math.imul(31, h) + javaHash(x)) | 0; return h; }
        case 'hashCode': return javaHash(a0);
        case 'isNull': return a0 === null;
        case 'nonNull': return a0 !== null;
        case 'toString': return a0 === null && args.length > 1 ? a1 : str(a0);
        case 'requireNonNull': if (a0 === null) throw rt.npe(a1 ?? null); return a0;
        case 'requireNonNullElse': return a0 === null ? a1 : a0;
        default: break;
      }
      break;
    case 'Comparator':
      switch (name) {
        case 'naturalOrder': return ORDER_NATURAL();
        case 'reverseOrder': return ORDER_REVERSE();
        case 'comparing': {
          const c2 = a1 ? cmpFn(a1) : compareNatural;
          return fn((ab) => c2(call(a0, ab[0]), call(a0, ab[1])));
        }
        case 'comparingInt': case 'comparingDouble': case 'comparingLong':
          return fn((ab) => compareNatural(call(a0, ab[0]), call(a0, ab[1])));
        default: break;
      }
      break;
    case 'Function': case 'UnaryOperator':
      if (name === 'identity') return fn((a) => a[0]);
      break;
    case 'IntStream': case 'LongStream': case 'DoubleStream': case 'Stream': {
      const kind = { IntStream: 'int', LongStream: 'long', DoubleStream: 'double', Stream: 'obj' }[cls];
      switch (name) {
        case 'range': case 'rangeClosed': {
          const out = [];
          const end = name === 'range' ? toInt(a1) : toInt(a1) + 1;
          if (end - toInt(a0) > 20_000_000) throw thr('OutOfMemoryError', 'Java heap space');
          for (let i = toInt(a0); i < end; i++) out.push(i);
          return new JStream(out, kind);
        }
        case 'of':
          if (args.length === 1 && a0 instanceof JArray) return new JStream(a0.data.slice(), kind);
          return new JStream(args.slice(), kind);
        case 'empty': return new JStream([], kind);
        case 'iterate': {
          if (args.length === 3) {
            const out = [];
            for (let x = a0; bool(call(a1, x)); x = call(args[2], x)) { out.push(x); rt.tick(); }
            return new JStream(out, kind);
          }
          break;
        }
        case 'concat': return new JStream([...a0.a, ...a1.a], a0.kind);
        default: break;
      }
      break;
    }
    case 'Collectors':
      switch (name) {
        case 'toList': case 'toUnmodifiableList': return new JCollector((a) => new JList('ArrayList', a.slice()));
        case 'toSet': case 'toUnmodifiableSet': return new JCollector((a) => { const s = new JSet('HashSet'); a.forEach((x) => s.add(x)); return s; });
        case 'joining': return new JCollector((a) => (args[1] ?? '') + a.map(str).join(a0 ?? '') + (args[2] ?? ''));
        case 'counting': return new JCollector((a) => mkLong(a.length));
        case 'summingInt': return new JCollector((a) => a.reduce((s, x) => (s + toInt(call(a0, x))) | 0, 0));
        case 'averagingInt': case 'averagingDouble': return new JCollector((a) => mkDouble(a.length ? a.reduce((s, x) => s + toNumber(call(a0, x)), 0) / a.length : 0));
        case 'toMap': return new JCollector((a) => {
          const m = new JMap('HashMap');
          for (const x of a) {
            const k = call(a0, x), v = call(a1, x);
            const ex = m.findEntry(k);
            if (ex) {
              if (args[2]) ex.v = call(args[2], ex.v, v);
              else throw thr('IllegalStateException', `Duplicate key ${str(k)} (attempted merging values ${str(ex.v)} and ${str(v)})`);
            } else m.put(k, v);
          }
          return m;
        });
        case 'groupingBy': return new JCollector((a) => {
          const m = new JMap(args.length === 3 ? 'TreeMap' : 'HashMap');
          const groups = new Map();
          const keys = [];
          for (const x of a) {
            const k = call(a0, x);
            const hk = hashKey(k) ?? str(k);
            if (!groups.has(hk)) { groups.set(hk, []); keys.push(k); }
            groups.get(hk).push(x);
          }
          const down = args.length === 3 ? args[2] : a1;
          for (const k of keys) {
            const items = groups.get(hashKey(k) ?? str(k));
            m.put(k, down ? down.fn(items) : new JList('ArrayList', items));
          }
          return m;
        });
        default: break;
      }
      break;
    case 'Optional':
      if (name === 'of' || name === 'ofNullable') return new JOptional(a0 === null ? undefined : a0);
      if (name === 'empty') return new JOptional(undefined);
      break;
    default: break;
  }
  throw compileError(`cannot find symbol: method ${name}(${args.map(typeNameOf).join(',')}) in class ${cls}`, line);
}

function arraysStatic(name, args) {
  const [a0, a1, a2] = args;
  const needArr = () => { if (a0 === null) throw RT.npe(); if (!(a0 instanceof JArray)) throw compileError(`no suitable method found for Arrays.${name}(${typeNameOf(a0)})`); };
  switch (name) {
    case 'toString': return arraysToString(a0);
    case 'deepToString': return deepToString(a0);
    case 'sort': case 'parallelSort': {
      needArr();
      const isPrim = ['int', 'long', 'double', 'char', 'short', 'byte', 'float'].includes(a0.elemType.base) && !a0.elemType.dims;
      if (args.length === 1) sortArrayData(a0.data, 0, a0.data.length, null, isPrim);
      else if (args.length === 2) {
        if (isPrim) throw compileError('no suitable method found for sort(int[], Comparator) - comparators only work on object arrays like Integer[] or int[][]');
        sortArrayData(a0.data, 0, a0.data.length, a1, false);
      } else {
        if (a1 < 0 || a2 > a0.data.length || a1 > a2) throw RT.makeThrow('ArrayIndexOutOfBoundsException', `Array index out of range: ${a2}`);
        sortArrayData(a0.data, a1, a2, args[3] ?? null, isPrim);
      }
      return undefined;
    }
    case 'fill': {
      needArr();
      if (args.length === 2) { const v = coerce(a1, a0.elemType); a0.data.fill(v); }
      else { const v = coerce(args[3], a0.elemType); for (let i = a1; i < a2; i++) a0.data[i] = v; }
      return undefined;
    }
    case 'copyOf': {
      needArr();
      if (a1 < 0) throw RT.makeThrow('NegativeArraySizeException', String(a1));
      const d = a0.data.slice(0, a1);
      while (d.length < a1) d.push(defaultValue(a0.elemType));
      return new JArray(a0.elemType, d);
    }
    case 'copyOfRange': {
      needArr();
      if (a1 > a2) throw thr('IllegalArgumentException', `${a1} > ${a2}`);
      if (a1 < 0 || a1 > a0.data.length) throw RT.makeThrow('ArrayIndexOutOfBoundsException', `Array index out of range: ${a1}`);
      const d = a0.data.slice(a1, a2);
      while (d.length < a2 - a1) d.push(defaultValue(a0.elemType));
      return new JArray(a0.elemType, d);
    }
    case 'equals':
      if (a0 === null || a1 === null) return a0 === a1;
      return a0.data.length === a1.data.length && a0.data.every((x, i) => javaEquals(x, a1.data[i]) || (isNumeric(x) && isNumeric(a1.data[i]) && toNumber(x) === toNumber(a1.data[i])));
    case 'deepEquals': {
      const de = (x, y) => {
        if (x instanceof JArray && y instanceof JArray) return x.data.length === y.data.length && x.data.every((v, i) => de(v, y.data[i]));
        return javaEquals(x, y);
      };
      return de(a0, a1);
    }
    case 'hashCode': {
      if (a0 === null) return 0;
      let h = 1;
      for (const x of a0.data) h = (Math.imul(31, h) + javaHash(x)) | 0;
      return h;
    }
    case 'asList':
      if (args.length === 1 && a0 instanceof JArray && !['int', 'char', 'double', 'long', 'boolean'].includes(a0.elemType.base)) {
        const l = new JList('AsList', a0.data);
        return l;
      }
      return new JList('AsList', args.slice());
    case 'stream': {
      needArr();
      const kind = { int: 'int', long: 'long', double: 'double' }[a0.elemType.base] && !a0.elemType.dims ? a0.elemType.base : 'obj';
      const d = args.length === 3 ? a0.data.slice(a1, a2) : a0.data.slice();
      return new JStream(d, kind);
    }
    case 'binarySearch': {
      needArr();
      let lo = 0, hi = a0.data.length - 1;
      const key = args.length >= 4 ? args[3] : a1;
      if (args.length >= 4) { lo = a1; hi = a2 - 1; }
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const d = compareNatural(a0.data[mid], key);
        if (d < 0) lo = mid + 1; else if (d > 0) hi = mid - 1; else return mid;
      }
      return -(lo + 1);
    }
    case 'setAll': needArr(); for (let i = 0; i < a0.data.length; i++) a0.data[i] = coerce(call(a1, i), a0.elemType); return undefined;
    default: throw compileError(`cannot find symbol: method ${name} in class Arrays`);
  }
}

function collectionsStatic(name, args) {
  const [a0, a1] = args;
  switch (name) {
    case 'sort': {
      if (!(a0 instanceof JList)) throw compileError('Collections.sort needs a List');
      a0.mutate();
      a0.a.sort(a1 ? cmpFn(a1) : compareNatural);
      return undefined;
    }
    case 'reverse': if (a0.kind === 'Immutable') throw thr('UnsupportedOperationException', null); a0.a.reverse(); return undefined;
    case 'max': case 'min': {
      const items = toArrayOf(a0);
      if (!items.length) throw thr('NoSuchElementException', null);
      const c = a1 ? cmpFn(a1) : compareNatural;
      return items.reduce((m, x) => (name === 'max' ? (c(x, m) > 0 ? x : m) : (c(x, m) < 0 ? x : m)));
    }
    case 'swap': {
      const n = a0.a.length;
      checkIndex(a1, n); checkIndex(args[2], n);
      [a0.a[a1], a0.a[args[2]]] = [a0.a[args[2]], a0.a[a1]];
      return undefined;
    }
    case 'frequency': return toArrayOf(a0).filter((x) => javaEquals(x, a1) || (x === null && a1 === null)).length;
    case 'reverseOrder':
      if (a0) return fn((ab) => -toInt(call(a0, ab[0], ab[1])) | 0);
      return ORDER_REVERSE();
    case 'emptyList': return new JList('Immutable', []);
    case 'emptySet': { const s = new JSet('Immutable'); return s; }
    case 'emptyMap': { const m = new JMap('HashMap'); m.kind = 'Immutable'; return m; }
    case 'singletonList': return new JList('Immutable', [a0]);
    case 'unmodifiableList': return new JList('Immutable', a0.a);
    case 'unmodifiableSet': case 'unmodifiableMap': case 'synchronizedList': case 'synchronizedMap': return a0;
    case 'nCopies': return new JList('Immutable', new Array(a0).fill(a1));
    case 'addAll': { let ch = false; for (const x of args.slice(1)) ch = collAdd(a0, x) || ch; return ch; }
    case 'shuffle': {
      for (let i = a0.a.length - 1; i > 0; i--) {
        const j = a1 ? a1.nextInt(i + 1) : Math.floor(Math.random() * (i + 1));
        [a0.a[i], a0.a[j]] = [a0.a[j], a0.a[i]];
      }
      return undefined;
    }
    case 'fill': a0.a.fill(a1); return undefined;
    case 'binarySearch': {
      let lo = 0, hi = a0.a.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const d = compareNatural(a0.a[mid], a1);
        if (d < 0) lo = mid + 1; else if (d > 0) hi = mid - 1; else return mid;
      }
      return -(lo + 1);
    }
    default: throw compileError(`cannot find symbol: method ${name} in class Collections`);
  }
}

function collAdd(c, x) {
  if (c instanceof JList) { c.mutate(); c.a.push(x); return true; }
  if (c instanceof JSet) return c.add(x);
  if (c instanceof JPQ) return c.offer(x);
  throw compileError('cannot add to ' + typeNameOf(c));
}

// ======================= constructors =======================
export function newBuiltin(rt, type, args, line) {
  RT = rt;
  const a0 = args[0];
  const base = type.base.split('.').pop();
  const isColl = (v) => v instanceof JList || v instanceof JSet || v instanceof JMapView || v instanceof JPQ;
  switch (base) {
    case 'ArrayList': case 'LinkedList': case 'Vector': case 'CopyOnWriteArrayList': {
      const kind = base === 'LinkedList' ? 'LinkedList' : 'ArrayList';
      if (a0 !== undefined && isColl(a0)) return new JList(kind, toArrayOf(a0));
      if (typeof a0 === 'number' && a0 < 0) throw thr('IllegalArgumentException', 'Illegal Capacity: ' + a0);
      return new JList(kind, []);
    }
    case 'ArrayDeque': {
      if (a0 !== undefined && isColl(a0)) return new JList('ArrayDeque', toArrayOf(a0));
      return new JList('ArrayDeque', []);
    }
    case 'Stack': return new JList('Stack', []);
    case 'HashMap': case 'LinkedHashMap': case 'TreeMap': case 'Hashtable': case 'ConcurrentHashMap': {
      const kind = base === 'Hashtable' || base === 'ConcurrentHashMap' ? 'HashMap' : base;
      if (a0 instanceof JMap) {
        const m = new JMap(kind, kind === 'TreeMap' && a0.kind === 'TreeMap' ? a0.cmp : null, kind === 'HashMap' ? tableSizeFor(Math.floor(a0.size / 0.75 + 1)) : 0);
        for (const e of a0.entries()) m.put(e.k, e.v);
        return m;
      }
      if (kind === 'TreeMap') return new JMap('TreeMap', a0 ?? null);
      return new JMap(kind, null, typeof a0 === 'number' ? tableSizeFor(a0) : 0);
    }
    case 'HashSet': case 'LinkedHashSet': case 'TreeSet': {
      if (a0 !== undefined && (isColl(a0))) {
        const s = new JSet(base, base === 'TreeSet' && a0 instanceof JSet && a0.kind === 'TreeSet' ? a0.map.cmp : null,
          base === 'HashSet' ? tableSizeFor(Math.max(Math.floor(a0.size / 0.75) + 1, 16)) : 0);
        for (const x of toArrayOf(a0)) s.add(x);
        return s;
      }
      if (base === 'TreeSet') return new JSet('TreeSet', a0 ?? null);
      return new JSet(base, null, typeof a0 === 'number' ? tableSizeFor(a0) : 0);
    }
    case 'PriorityQueue': {
      let cmp = null, init = [];
      for (const a of args) {
        if (a === null || typeof a === 'number') continue;
        if (isColl(a)) init = toArrayOf(a);
        else cmp = a;
      }
      const pq = new JPQ(cmp);
      if (init.length) { pq.q = init.slice(); pq.heapify(); }
      return pq;
    }
    case 'StringBuilder': case 'StringBuffer':
      if (a0 === undefined || typeof a0 === 'number') return new JStringBuilder('');
      return new JStringBuilder(seqArg(a0));
    case 'String':
      if (a0 === undefined) return '';
      if (a0 instanceof JArray) {
        const d = args.length === 3 ? a0.data.slice(args[1], args[1] + args[2]) : a0.data;
        return d.map((x) => String.fromCharCode(x.c)).join('');
      }
      return seqArg(a0);
    case 'Random': return new JRandom(a0 !== undefined ? toBig(a0) : BigInt(Math.floor(Math.random() * 2 ** 48)));
    case 'Scanner': return new JScanner(rt);
    case 'Object': {
      const o = { jclass: 'Object', toJavaString() { return 'java.lang.Object@' + identityHash(this).toString(16); } };
      return o;
    }
    case 'Integer': return typeof a0 === 'string' ? parseIntJava(a0) : toInt(a0);
    case 'Double': return mkDouble(typeof a0 === 'string' ? parseDoubleJava(a0).v : toNumber(a0));
    case 'Long': return typeof a0 === 'string' ? parseIntJava(a0, 10, true) : mkLong(toBig(a0));
    case 'Character': return a0;
    case 'Boolean': return a0;
    case 'int': case 'double': case 'char': case 'long': case 'boolean':
      throw compileError(`'[' expected after new ${base}`, line);
    default: return undefined;
  }
}

export function builtinInstanceOf(v, base) {
  if (v instanceof JList) {
    if (['List', 'Collection', 'Iterable', 'AbstractList'].includes(base)) return v.kind !== 'ArrayDeque';
    if (['Deque', 'Queue'].includes(base)) return v.kind === 'ArrayDeque' || v.kind === 'LinkedList';
    return v.kind === base || (base === 'Vector' && v.kind === 'Stack');
  }
  if (v instanceof JMap) return base === 'Map' || v.kind === base || (base === 'HashMap' && v.kind === 'LinkedHashMap');
  if (v instanceof JSet) return ['Set', 'Collection', 'Iterable'].includes(base) || v.kind === base || (base === 'HashSet' && v.kind === 'LinkedHashSet');
  if (v instanceof JPQ) return ['Queue', 'Collection', 'Iterable', 'PriorityQueue'].includes(base);
  if (v instanceof JStringBuilder) return base === 'StringBuilder' || base === 'CharSequence';
  if (v instanceof JArray) return false;
  return v && v.jclass === base;
}

// ======================= functional interface helpers =======================
export function functionalMethod(rt, f, name, args) {
  RT = rt;
  const a0 = args[0];
  switch (name) {
    case 'reversed': return fn((ab) => -toInt(call(f, ab[0], ab[1])) | 0);
    case 'thenComparing': case 'thenComparingInt': case 'thenComparingDouble': case 'thenComparingLong': {
      // argument is either a Comparator (2 args) or a key extractor (1 arg)
      const isKeyFn = name !== 'thenComparing' || isKeyExtractor(a0);
      const second = isKeyFn
        ? (x, y) => (args[1] ? cmpFn(args[1]) : compareNatural)(call(a0, x), call(a0, y))
        : (x, y) => toInt(call(a0, x, y));
      return fn((ab) => {
        const d = toInt(call(f, ab[0], ab[1]));
        return d !== 0 ? d : second(ab[0], ab[1]);
      });
    }
    case 'negate': return fn((a) => !call(f, ...a));
    case 'and': return fn((a) => call(f, ...a) && call(a0, ...a));
    case 'or': return fn((a) => call(f, ...a) || call(a0, ...a));
    case 'andThen': return fn((a) => { const r = call(f, ...a); if (r === undefined) { call(a0, ...a); return undefined; } return call(a0, r); });
    case 'compose': return fn((a) => call(f, call(a0, ...a)));
    case 'equals': return f === a0;
    case 'hashCode': return identityHash(f);
    case 'toString': return str(f);
    default: return NO_METHOD;
  }
}
function isKeyExtractor(f) {
  // Lambdas built by the interpreter remember their arity; method refs are ambiguous so default to comparator.
  if (f && f.arity !== undefined) return f.arity === 1;
  if (f && f.jclass === 'Lambda' && f.invoke.length === 1 && f.keyHint) return true;
  return !!(f && f.isKeyFn);
}

// ======================= instance methods =======================
export function callInstance(rt, obj, name, args, argNodes) {
  RT = rt;
  if (typeof obj === 'string') return stringMethod(obj, name, args);
  if (obj instanceof JStringBuilder) return sbMethod(obj, name, args);
  if (obj instanceof JList) return listMethod(obj, name, args, argNodes);
  if (obj instanceof JMap) return mapMethod(obj, name, args);
  if (obj instanceof JSet) return setMethod(obj, name, args);
  if (obj instanceof JMapView) return viewMethod(obj, name, args);
  if (obj instanceof JPQ) return pqMethod(obj, name, args);
  if (obj instanceof JEntry) {
    switch (name) {
      case 'getKey': return obj.k;
      case 'getValue': return obj.v;
      case 'setValue': { const old = obj.v; obj.v = args[0]; return old; }
      case 'toString': return obj.toJavaString();
      case 'equals': return obj.javaEquals(args[0]);
      case 'hashCode': return obj.javaHashCode();
      default: throw fail(name, args, 'Map.Entry');
    }
  }
  if (obj instanceof PrintStream) return printMethod(rt, obj, name, args);
  if (obj instanceof JArray) {
    switch (name) {
      case 'clone': return new JArray(obj.elemType, obj.data.slice());
      case 'equals': return obj === args[0];
      case 'hashCode': return identityHash(obj);
      case 'toString': return str(obj);
      case 'getClass': return classObject(typeStr(obj.elemType) + '[]');
      case 'length': throw compileError('cannot find symbol: method length() - for arrays use .length without brackets');
      default: throw fail(name, args, typeNameOf(obj));
    }
  }
  if (obj instanceof JIterator) {
    switch (name) {
      case 'hasNext': return obj.hasNext();
      case 'next': return obj.next();
      case 'remove': if (!obj.remove) throw thr('UnsupportedOperationException', 'remove'); obj.remove(); return undefined;
      default: throw fail(name, args, 'Iterator');
    }
  }
  if (obj instanceof JStream) return streamMethod(obj, name, args);
  if (obj instanceof JOptional) return optionalMethod(obj, name, args);
  if (obj instanceof JRandom) {
    switch (name) {
      case 'nextInt':
        if (args.length === 2) return args[0] + obj.nextInt(args[1] - args[0]);
        return obj.nextInt(args[0]);
      case 'nextDouble': return mkDouble(obj.nextDouble());
      case 'nextBoolean': return obj.nextBoolean();
      default: throw fail(name, args, 'Random');
    }
  }
  if (obj instanceof JScanner) return scannerMethod(obj, name, args);
  if (obj && obj.jclass === 'Class') {
    if (name === 'getSimpleName') return obj.name;
    if (name === 'getName') return obj.name.includes('.') || /\[\]$/.test(obj.name) ? obj.name : ({ String: 'java.lang.String', Integer: 'java.lang.Integer' }[obj.name] || obj.name);
    if (name === 'toString') return obj.toJavaString();
    if (name === 'equals') return args[0] && args[0].name === obj.name;
  }
  // functional objects
  if (obj && typeof obj.invoke === 'function') {
    const r = functionalMethod(rt, obj, name, args);
    if (r !== NO_METHOD) return r;
    return obj.invoke(args);
  }
  // boxed primitives
  const k = kindOf(obj);
  if (k || typeof obj === 'boolean') return boxedMethod(obj, k, name, args);
  if (obj && obj.jclass === 'Object') {
    switch (name) {
      case 'toString': return obj.toJavaString();
      case 'hashCode': return identityHash(obj);
      case 'equals': return obj === args[0];
      case 'getClass': return classObject('Object');
      default: break;
    }
  }
  throw fail(name, args, typeNameOf(obj));
}

function boxedMethod(obj, k, name, args) {
  switch (name) {
    case 'intValue': return castTo(T('int'), obj);
    case 'longValue': return castTo(T('long'), obj);
    case 'doubleValue': case 'floatValue': return castTo(T('double'), obj);
    case 'charValue': return obj;
    case 'booleanValue': return obj;
    case 'shortValue': return castTo(T('short'), obj);
    case 'byteValue': return castTo(T('byte'), obj);
    case 'toString': return str(obj);
    case 'hashCode': return javaHash(obj);
    case 'equals': return javaEquals(obj, args[0]) || (typeof obj === 'number' && obj === args[0]) || (typeof obj === 'boolean' && obj === args[0]);
    case 'compareTo': case 'compare':
      if (args[0] === null) throw RT.npe();
      return compareNatural(obj, args[0]);
    case 'isNaN': return Number.isNaN(toNumber(obj));
    case 'isInfinite': return Math.abs(toNumber(obj)) === Infinity;
    case 'getClass': return classObject(javaClassName(obj).split('.').pop());
    default: throw fail(name, args, typeNameOf(obj));
  }
}

function printMethod(rt, ps, name, args) {
  const write = (s) => { if (ps.isErr) rt.writeErr ? rt.writeErr(s) : rt.write(s); else rt.write(s); };
  switch (name) {
    case 'println':
      if (args.length === 0) { write('\n'); return undefined; }
      write(printStr(args[0]) + '\n');
      return undefined;
    case 'print':
      if (args.length !== 1) throw compileError('no suitable method found for print()');
      write(printStr(args[0]));
      return undefined;
    case 'printf': case 'format': {
      if (args[0] === null) throw rt.npe();
      let rest = args.slice(1);
      if (rest.length === 1 && rest[0] instanceof JArray && rest[0].elemType.base === 'Object') rest = rest[0].data;
      write(javaFormat(args[0], rest));
      return ps;
    }
    case 'flush': case 'close': return undefined;
    case 'write': write(String.fromCharCode(toInt(args[0]))); return undefined;
    default: throw fail(name, args, 'PrintStream');
  }
}

function scannerMethod(sc, name, args) {
  const rt = sc.rt;
  switch (name) {
    case 'nextInt': {
      const t = sc.token();
      if (!/^[+-]?\d+$/.test(t)) throw thr('InputMismatchException', `For input string: "${t}"`);
      return parseIntJava(t);
    }
    case 'nextLong': return parseIntJava(sc.token(), 10, true);
    case 'nextDouble': return parseDoubleJava(sc.token());
    case 'next': return sc.token();
    case 'nextBoolean': return sc.token().toLowerCase() === 'true';
    case 'nextLine': {
      const s = rt.stdin;
      if (rt.stdinPos >= s.length) throw thr('NoSuchElementException', 'No line found');
      let e = s.indexOf('\n', rt.stdinPos);
      if (e < 0) e = s.length;
      const line = s.slice(rt.stdinPos, e).replace(/\r$/, '');
      rt.stdinPos = e + 1;
      return line;
    }
    case 'hasNext': return sc.peekToken() !== null;
    case 'hasNextInt': { const t = sc.peekToken(); return !!t && /^[+-]?\d+$/.test(t.tok); }
    case 'hasNextLine': return rt.stdinPos < rt.stdin.length;
    case 'close': return undefined;
    default: throw fail(name, args, 'Scanner');
  }
}

function stringMethod(s, name, args) {
  const [a0, a1] = args;
  switch (name) {
    case 'length': return s.length;
    case 'charAt': {
      const i = toInt(a0);
      if (i < 0 || i >= s.length) throw thr('StringIndexOutOfBoundsException', `Index ${i} out of bounds for length ${s.length}`);
      return mkChar(s.charCodeAt(i));
    }
    case 'codePointAt': return s.codePointAt(toInt(a0));
    case 'isEmpty': return s.length === 0;
    case 'isBlank': return s.trim().length === 0;
    case 'substring': case 'subSequence': {
      const b = toInt(a0), e = a1 === undefined ? s.length : toInt(a1);
      if (b < 0 || e > s.length || b > e) throw thr('StringIndexOutOfBoundsException', `begin ${b}, end ${e}, length ${s.length}`);
      return s.slice(b, e);
    }
    case 'indexOf': {
      const target = charArg(a0);
      return s.indexOf(target, a1 === undefined ? 0 : Math.max(0, toInt(a1)));
    }
    case 'lastIndexOf': {
      const target = charArg(a0);
      return a1 === undefined ? s.lastIndexOf(target) : (toInt(a1) < 0 ? -1 : s.lastIndexOf(target, toInt(a1)));
    }
    case 'contains': return s.includes(seqArg(a0));
    case 'startsWith': return s.startsWith(seqArg(a0), a1 ?? 0);
    case 'endsWith': return s.endsWith(seqArg(a0));
    case 'equals': return typeof a0 === 'string' && a0 === s;
    case 'equalsIgnoreCase': return typeof a0 === 'string' && a0.toLowerCase() === s.toLowerCase();
    case 'contentEquals': return seqArg(a0) === s;
    case 'compareTo':
      if (a0 === null) throw RT.npe();
      if (typeof a0 !== 'string') throw compileError(`incompatible types: ${typeNameOf(a0)} cannot be converted to String`);
      return stringCompare(s, a0);
    case 'compareToIgnoreCase': return stringCompare(s.toUpperCase().toLowerCase(), a0.toUpperCase().toLowerCase());
    case 'toUpperCase': return s.toUpperCase();
    case 'toLowerCase': return s.toLowerCase();
    case 'trim': return s.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '');
    case 'strip': return s.trim();
    case 'stripLeading': return s.replace(/^\s+/, '');
    case 'stripTrailing': return s.replace(/\s+$/, '');
    case 'split': return strArray(javaSplit(s, a0, a1 ?? 0));
    case 'replace': {
      const from = charArg(a0), to = charArg(a1);
      return s.split(from).join(to);
    }
    case 'replaceAll': return s.replace(regex(a0), a1.replace(/\\\$/g, '$$$$'));
    case 'replaceFirst': return s.replace(regex(a0, ''), a1);
    case 'matches': return regex('^(?:' + a0 + ')$', '').test(s);
    case 'toCharArray': return charArray(s);
    case 'chars': return new JStream(Array.from({ length: s.length }, (_, i) => s.charCodeAt(i)), 'int');
    case 'hashCode': return stringHash(s);
    case 'concat': if (a0 === null) throw RT.npe(); return s + a0;
    case 'repeat': if (a0 < 0) throw thr('IllegalArgumentException', 'count is negative: ' + a0); return s.repeat(a0);
    case 'intern': case 'toString': return s;
    case 'lines': return new JStream(s.split(/\r?\n/), 'obj');
    case 'formatted': return javaFormat(s, args);
    case 'getClass': return classObject('String');
    case 'describeConstable': return s;
    case 'indent': return s.split('\n').map((l) => ' '.repeat(a0) + l).join('\n') + '\n';
    default: throw fail(name, args, 'String');
  }
}

function sbMethod(sb, name, args) {
  const [a0, a1, a2] = args;
  const n = sb.s.length;
  switch (name) {
    case 'append':
      if (args.length === 3 && a0 instanceof JArray) sb.s += a0.data.slice(a1, a1 + a2).map((c) => String.fromCharCode(c.c)).join('');
      else if (args.length === 3) sb.s += str(a0).slice(a1, a2);
      else sb.s += printStr(a0);
      return sb;
    case 'insert': {
      if (a0 < 0 || a0 > n) throw thr('StringIndexOutOfBoundsException', `offset ${a0}, length ${n}`);
      sb.s = sb.s.slice(0, a0) + printStr(a1) + sb.s.slice(a0);
      return sb;
    }
    case 'reverse': sb.s = [...sb.s].reverse().join(''); return sb;
    case 'toString': return sb.s;
    case 'length': return n;
    case 'charAt':
      if (a0 < 0 || a0 >= n) throw thr('StringIndexOutOfBoundsException', `index ${a0},length ${n}`);
      return mkChar(sb.s.charCodeAt(a0));
    case 'setCharAt':
      if (a0 < 0 || a0 >= n) throw thr('StringIndexOutOfBoundsException', `index ${a0},length ${n}`);
      sb.s = sb.s.slice(0, a0) + charArg(a1) + sb.s.slice(a0 + 1);
      return undefined;
    case 'deleteCharAt':
      if (a0 < 0 || a0 >= n) throw thr('StringIndexOutOfBoundsException', `index ${a0},length ${n}`);
      sb.s = sb.s.slice(0, a0) + sb.s.slice(a0 + 1);
      return sb;
    case 'delete': {
      const end = Math.min(a1, n);
      if (a0 < 0 || a0 > end) throw thr('StringIndexOutOfBoundsException', `start ${a0}, end ${a1}, length ${n}`);
      sb.s = sb.s.slice(0, a0) + sb.s.slice(end);
      return sb;
    }
    case 'replace': {
      const end = Math.min(a1, n);
      sb.s = sb.s.slice(0, a0) + a2 + sb.s.slice(end);
      return sb;
    }
    case 'setLength':
      if (a0 < n) sb.s = sb.s.slice(0, a0);
      else sb.s = sb.s + '\0'.repeat(a0 - n);
      return undefined;
    case 'indexOf': return sb.s.indexOf(a0, a1 ?? 0);
    case 'lastIndexOf': return a1 === undefined ? sb.s.lastIndexOf(a0) : sb.s.lastIndexOf(a0, a1);
    case 'isEmpty': return n === 0;
    case 'substring': {
      const e = a1 === undefined ? n : a1;
      if (a0 < 0 || e > n || a0 > e) throw thr('StringIndexOutOfBoundsException', `start ${a0}, end ${e}, length ${n}`);
      return sb.s.slice(a0, e);
    }
    case 'chars': return new JStream(Array.from({ length: n }, (_, i) => sb.s.charCodeAt(i)), 'int');
    case 'compareTo': return stringCompare(sb.s, a0.s);
    case 'equals': return sb === a0;
    case 'hashCode': return identityHash(sb);
    case 'capacity': return Math.max(16, n);
    default: throw fail(name, args, 'StringBuilder');
  }
}

function listMethod(l, name, args, argNodes) {
  const [a0, a1] = args;
  const a = l.a;
  const isStack = l.kind === 'Stack';
  const isDequeish = l.kind === 'ArrayDeque' || l.kind === 'LinkedList';
  const noElem = () => thr(isStack ? 'EmptyStackException' : 'NoSuchElementException', null);
  switch (name) {
    case 'size': return a.length;
    case 'isEmpty': case 'empty': return a.length === 0;
    case 'get': checkIndex(toInt(a0), a.length); return a[a0];
    case 'set': {
      if (l.kind === 'Immutable') throw thr('UnsupportedOperationException', null);
      checkIndex(toInt(a0), a.length);
      const old = a[a0];
      a[a0] = a1;
      return old;
    }
    case 'add': case 'addLast': case 'offer': case 'offerLast':
      if (args.length === 2) {
        if (a0 < 0 || a0 > a.length) throw thr('IndexOutOfBoundsException', `Index: ${a0}, Size: ${a.length}`);
        l.mutate();
        a.splice(a0, 0, a1);
        return undefined;
      }
      if (l.kind === 'AsList') throw thr('UnsupportedOperationException', null);
      if (l.kind === 'ArrayDeque' && a0 === null) throw RT.npe();
      l.mutate();
      a.push(a0);
      return name === 'addLast' ? undefined : true;
    case 'addFirst': case 'offerFirst':
      if (l.kind === 'ArrayDeque' && a0 === null) throw RT.npe();
      l.mutate();
      a.unshift(a0);
      return name === 'offerFirst' ? true : undefined;
    case 'push':
      if (l.kind === 'ArrayDeque' && a0 === null) throw RT.npe();
      l.mutate();
      if (isStack) { a.push(a0); return a0; }
      a.unshift(a0);
      return undefined;
    case 'pop':
      if (!a.length) throw noElem();
      l.mutate();
      return isStack ? a.pop() : a.shift();
    case 'peek':
      if (!a.length) { if (isStack) throw noElem(); return null; }
      return isStack ? a[a.length - 1] : a[0];
    case 'peekFirst': return a.length ? a[0] : null;
    case 'peekLast': return a.length ? a[a.length - 1] : null;
    case 'element': case 'getFirst': case 'firstElement':
      if (!a.length) throw noElem();
      return a[0];
    case 'getLast': case 'lastElement':
      if (!a.length) throw noElem();
      return a[a.length - 1];
    case 'poll': case 'pollFirst':
      if (!a.length) return null;
      l.mutate();
      return a.shift();
    case 'pollLast':
      if (!a.length) return null;
      l.mutate();
      return a.pop();
    case 'removeFirst':
      if (!a.length) throw noElem();
      l.mutate();
      return a.shift();
    case 'removeLast':
      if (!a.length) throw noElem();
      l.mutate();
      return a.pop();
    case 'remove': {
      if (args.length === 0) {
        if (!a.length) throw noElem();
        l.mutate();
        return a.shift();
      }
      // remove(int index) vs remove(Object o): decided by the static type of the argument
      const argNode = argNodes && argNodes[0];
      const objectOverload = isDequeish && l.kind === 'ArrayDeque' ? true : !(typeof a0 === 'number') || isBoxedExpr(argNode);
      if (!objectOverload) {
        if (l.kind === 'AsList' || l.kind === 'Immutable') throw thr('UnsupportedOperationException', null);
        checkIndex(a0, a.length);
        l.mutate();
        return a.splice(a0, 1)[0];
      }
      const i = a.findIndex((x) => javaEquals(x, a0) || (x === null && a0 === null) || (typeof x === 'number' && x === a0));
      if (i < 0) return false;
      if (l.kind === 'AsList' || l.kind === 'Immutable') throw thr('UnsupportedOperationException', null);
      l.mutate();
      a.splice(i, 1);
      return true;
    }
    case 'removeFirstOccurrence': {
      const i = a.findIndex((x) => javaEquals(x, a0) || x === a0);
      if (i < 0) return false;
      l.mutate(); a.splice(i, 1); return true;
    }
    case 'contains': return a.some((x) => x === a0 || javaEquals(x, a0));
    case 'indexOf': return a.findIndex((x) => x === a0 || javaEquals(x, a0));
    case 'lastIndexOf': { for (let i = a.length - 1; i >= 0; i--) if (a[i] === a0 || javaEquals(a[i], a0)) return i; return -1; }
    case 'search': { for (let i = a.length - 1; i >= 0; i--) if (javaEquals(a[i], a0) || a[i] === a0) return a.length - i; return -1; }
    case 'clear': if (l.kind === 'Immutable' || l.kind === 'AsList') throw thr('UnsupportedOperationException', null); l.mutate(); a.length = 0; return undefined;
    case 'addAll': {
      if (l.kind === 'Immutable' || l.kind === 'AsList') throw thr('UnsupportedOperationException', null);
      if (args.length === 2) { const items = toArrayOf(a1); l.mutate(); a.splice(a0, 0, ...items); return items.length > 0; }
      const items = toArrayOf(a0);
      l.mutate();
      a.push(...items);
      return items.length > 0;
    }
    case 'removeAll': case 'retainAll': {
      const other = toArrayOf(a0);
      const keep = a.filter((x) => (name === 'removeAll') !== other.some((y) => javaEquals(x, y) || x === y));
      const changed = keep.length !== a.length;
      if (changed) { l.mutate(); l.a = keep; }
      return changed;
    }
    case 'containsAll': return toArrayOf(a0).every((y) => a.some((x) => javaEquals(x, y) || x === y));
    case 'removeIf': {
      const keep = a.filter((x) => !bool(call(a0, x)));
      const changed = keep.length !== a.length;
      if (changed) { l.mutate(); a.length = 0; a.push(...keep); }
      return changed;
    }
    case 'forEach': {
      const exp = l.modCount;
      for (const x of a.slice()) { call(a0, x); if (l.modCount !== exp) throw thr('ConcurrentModificationException', null); }
      return undefined;
    }
    case 'replaceAll': for (let i = 0; i < a.length; i++) a[i] = call(a0, a[i]); return undefined;
    case 'sort': if (l.kind === 'Immutable') throw thr('UnsupportedOperationException', null); l.mutate(); a.sort(a0 ? cmpFn(a0) : compareNatural); return undefined;
    case 'subList': {
      if (a0 < 0 || a1 > a.length || a0 > a1) throw thr('IndexOutOfBoundsException', `fromIndex: ${a0}, toIndex: ${a1}, size: ${a.length}`);
      return new JList('ArrayList', a.slice(a0, a1));
    }
    case 'toArray': {
      if (a0 instanceof JArray) return new JArray(a0.elemType, a.slice());
      return new JArray(T('Object'), a.slice());
    }
    case 'iterator': case 'listIterator': return listIterator(l);
    case 'descendingIterator': { const r = a.slice().reverse(); return snapshotIterator(l, r, (x) => { const i = a.lastIndexOf(x); l.mutate(); a.splice(i, 1); }); }
    case 'stream': return new JStream(a.slice(), 'obj');
    case 'equals': return l.javaEquals(a0);
    case 'hashCode': return l.javaHashCode();
    case 'toString': return l.toJavaString();
    case 'reversed': return new JList('ArrayList', a.slice().reverse());
    case 'getClass': return classObject(l.kind);
    case 'ensureCapacity': case 'trimToSize': return undefined;
    default: throw fail(name, args, l.jclass);
  }
}
function isBoxedExpr(node) {
  if (!node) return false;
  if (node.k === 'cast' && /^(Integer|Object)$/.test(node.type.base)) return true;
  if (node.k === 'call' && node.name === 'valueOf' && node.target && node.target.k === 'name' && node.target.name === 'Integer') return true;
  return false;
}

function mapMethod(m, name, args) {
  const [a0, a1] = args;
  switch (name) {
    case 'put': return m.put(a0, a1);
    case 'get': return m.get(a0);
    case 'getOrDefault': { const e = m.findEntry(a0); return e ? e.v : a1; }
    case 'containsKey': return !!m.findEntry(a0);
    case 'containsValue': return m.entries().some((e) => javaEquals(e.v, a0) || e.v === a0);
    case 'remove': return m.remove(a0);
    case 'size': return m.size;
    case 'isEmpty': return m.size === 0;
    case 'clear': if (m.kind === 'Immutable') throw thr('UnsupportedOperationException', null); m.clear(); return undefined;
    case 'keySet': case 'navigableKeySet': return new JMapView(m, 'keys');
    case 'values': return new JMapView(m, 'values');
    case 'entrySet': return new JMapView(m, 'entries');
    case 'putIfAbsent': { const e = m.findEntry(a0); if (e && e.v !== null) return e.v; m.put(a0, a1); return null; }
    case 'merge': {
      const e = m.findEntry(a0);
      if (!e || e.v === null) { m.put(a0, a1); return a1; }
      const nv = call(args[2], e.v, a1);
      if (nv === null) { m.remove(a0); return null; }
      e.v = nv;
      return nv;
    }
    case 'computeIfAbsent': {
      const e = m.findEntry(a0);
      if (e && e.v !== null) return e.v;
      const v = call(a1, a0);
      if (v !== null) m.put(a0, v);
      return v;
    }
    case 'computeIfPresent': {
      const e = m.findEntry(a0);
      if (!e || e.v === null) return null;
      const v = call(a1, a0, e.v);
      if (v === null) m.remove(a0); else e.v = v;
      return v;
    }
    case 'compute': {
      const e = m.findEntry(a0);
      const v = call(a1, a0, e ? e.v : null);
      if (v === null) { if (e) m.remove(a0); } else m.put(a0, v);
      return v;
    }
    case 'putAll': for (const e of a0.entries()) m.put(e.k, e.v); return undefined;
    case 'forEach': {
      const exp = m.modCount;
      for (const e of m.entries()) { call(a0, e.k, e.v); if (m.modCount !== exp) throw thr('ConcurrentModificationException', null); }
      return undefined;
    }
    case 'replaceAll': for (const e of m.entries()) e.v = call(a0, e.k, e.v); return undefined;
    case 'replace': { const e = m.findEntry(a0); if (!e) return null; const old = e.v; e.v = a1; return old; }
    case 'equals': return m.javaEquals(a0);
    case 'hashCode': return m.javaHashCode();
    case 'toString': return m.toJavaString();
    // TreeMap navigation
    case 'firstKey': case 'lastKey': {
      if (!m.size) throw thr('NoSuchElementException', null);
      const es = m.entries();
      return name === 'firstKey' ? es[0].k : es[es.length - 1].k;
    }
    case 'firstEntry': case 'lastEntry': {
      const es = m.entries();
      if (!es.length) return null;
      return name === 'firstEntry' ? es[0] : es[es.length - 1];
    }
    case 'pollFirstEntry': case 'pollLastEntry': {
      const es = m.entries();
      if (!es.length) return null;
      const e = name === 'pollFirstEntry' ? es[0] : es[es.length - 1];
      m.remove(e.k);
      return e;
    }
    case 'floorKey': case 'lowerKey': case 'ceilingKey': case 'higherKey':
    case 'floorEntry': case 'lowerEntry': case 'ceilingEntry': case 'higherEntry': {
      const c = cmpFn(m.cmp);
      const es = m.entries();
      let found = null;
      const op = name.replace(/Key|Entry/, '');
      for (const e of es) {
        const d = c(e.k, a0);
        if (op === 'floor' && d <= 0) found = e;
        if (op === 'lower' && d < 0) found = e;
        if (op === 'ceiling' && d >= 0 && !found) found = e;
        if (op === 'higher' && d > 0 && !found) found = e;
      }
      if (!found) return null;
      return name.endsWith('Key') ? found.k : found;
    }
    case 'headMap': case 'tailMap': {
      const c = cmpFn(m.cmp);
      const out = new JMap('TreeMap', m.cmp);
      const incl = args.length > 1 ? args[1] : name === 'tailMap';
      for (const e of m.entries()) {
        const d = c(e.k, a0);
        if (name === 'headMap' ? (d < 0 || (incl && d === 0)) : (d > 0 || (incl && d === 0))) out.put(e.k, e.v);
      }
      return out;
    }
    case 'descendingMap': { const out = new JMap('LinkedHashMap'); for (const e of m.entries().reverse()) out.put(e.k, e.v); return out; }
    case 'descendingKeySet': return new JList('ArrayList', m.keys().reverse());
    case 'getClass': return classObject(m.kind);
    default: throw fail(name, args, m.jclass);
  }
}

function setMethod(s, name, args) {
  const [a0] = args;
  switch (name) {
    case 'add': return s.add(a0);
    case 'contains': return s.has(a0);
    case 'remove': return s.remove(a0);
    case 'size': return s.size;
    case 'isEmpty': return s.size === 0;
    case 'clear': if (s.immutable) throw thr('UnsupportedOperationException', null); s.map.clear(); return undefined;
    case 'addAll': { let ch = false; for (const x of toArrayOf(a0)) ch = s.add(x) || ch; return ch; }
    case 'removeAll': { let ch = false; for (const x of toArrayOf(a0)) ch = s.remove(x) || ch; return ch; }
    case 'retainAll': {
      const other = a0 instanceof JSet ? a0 : null;
      const items = other ? null : toArrayOf(a0);
      let ch = false;
      for (const k of s.keys()) {
        const keep = other ? other.has(k) : items.some((y) => javaEquals(k, y) || k === y);
        if (!keep) { s.remove(k); ch = true; }
      }
      return ch;
    }
    case 'containsAll': return toArrayOf(a0).every((x) => s.has(x));
    case 'removeIf': { let ch = false; for (const k of s.keys()) if (bool(call(a0, k))) { s.remove(k); ch = true; } return ch; }
    case 'forEach': for (const k of s.keys()) call(a0, k); return undefined;
    case 'iterator': return iteratorOf(RT, s);
    case 'stream': return new JStream(s.keys(), 'obj');
    case 'toArray': return new JArray(a0 instanceof JArray ? a0.elemType : T('Object'), s.keys());
    case 'equals': return s.javaEquals(a0);
    case 'hashCode': return s.javaHashCode();
    case 'toString': return s.toJavaString();
    case 'first': case 'last': {
      const ks = s.keys();
      if (!ks.length) throw thr('NoSuchElementException', null);
      return name === 'first' ? ks[0] : ks[ks.length - 1];
    }
    case 'pollFirst': case 'pollLast': {
      const ks = s.keys();
      if (!ks.length) return null;
      const k = name === 'pollFirst' ? ks[0] : ks[ks.length - 1];
      s.remove(k);
      return k;
    }
    case 'floor': case 'lower': case 'ceiling': case 'higher': {
      const c = cmpFn(s.map.cmp);
      let found;
      for (const k of s.keys()) {
        const d = c(k, a0);
        if (name === 'floor' && d <= 0) found = k;
        if (name === 'lower' && d < 0) found = k;
        if (name === 'ceiling' && d >= 0 && found === undefined) found = k;
        if (name === 'higher' && d > 0 && found === undefined) found = k;
      }
      return found === undefined ? null : found;
    }
    case 'headSet': case 'tailSet': case 'subSet': {
      const c = cmpFn(s.map.cmp);
      const out = new JSet('TreeSet', s.map.cmp);
      for (const k of s.keys()) {
        let ok;
        if (name === 'headSet') ok = c(k, a0) < 0 || (args[1] === true && c(k, a0) === 0);
        else if (name === 'tailSet') ok = c(k, a0) >= 0 && !(args[1] === false && c(k, a0) === 0);
        else ok = c(k, a0) >= 0 && c(k, args[1]) < 0;
        if (ok) out.add(k);
      }
      return out;
    }
    case 'descendingSet': { const out = new JSet('LinkedHashSet'); for (const k of s.keys().reverse()) out.add(k); return out; }
    case 'descendingIterator': return snapshotIterator(s.map, s.keys().reverse(), (k) => s.remove(k));
    case 'getClass': return classObject(s.kind);
    default: throw fail(name, args, s.jclass);
  }
}

function viewMethod(v, name, args) {
  const [a0] = args;
  switch (name) {
    case 'size': return v.size;
    case 'isEmpty': return v.size === 0;
    case 'contains': return viewContains(v, a0);
    case 'iterator': return iteratorOf(RT, v);
    case 'stream': return new JStream(v.items(), 'obj');
    case 'toString': return v.toJavaString();
    case 'remove':
      if (v.which === 'keys') { const had = !!v.map.findEntry(a0); v.map.remove(a0); return had; }
      break;
    case 'removeIf': {
      let ch = false;
      for (const e of v.map.entries()) {
        const x = v.which === 'keys' ? e.k : v.which === 'values' ? e.v : e;
        if (bool(call(a0, x))) { v.map.remove(e.k); ch = true; }
      }
      return ch;
    }
    case 'forEach': for (const x of v.items()) call(a0, x); return undefined;
    case 'toArray': return new JArray(a0 instanceof JArray ? a0.elemType : T('Object'), v.items());
    case 'containsAll': return toArrayOf(a0).every((x) => viewContains(v, x));
    case 'equals': return v.javaEquals(a0);
    case 'hashCode': return v.javaHashCode();
    case 'retainAll': case 'removeAll': {
      const other = toArrayOf(a0);
      let ch = false;
      for (const e of v.map.entries()) {
        const x = v.which === 'keys' ? e.k : v.which === 'values' ? e.v : e;
        const inOther = other.some((y) => javaEquals(x, y) || x === y);
        if ((name === 'retainAll') !== inOther) { v.map.remove(e.k); ch = true; }
      }
      return ch;
    }
    case 'add': throw thr('UnsupportedOperationException', null);
    default: break;
  }
  throw fail(name, args, v.jclass);
}

function pqMethod(pq, name, args) {
  const [a0] = args;
  switch (name) {
    case 'add': case 'offer': return pq.offer(a0);
    case 'poll': return pq.poll();
    case 'remove':
      if (args.length === 0) { if (!pq.q.length) throw thr('NoSuchElementException', null); return pq.poll(); }
      {
        const i = pq.q.findIndex((x) => javaEquals(x, a0) || x === a0);
        if (i < 0) return false;
        pq.removeAt(i);
        return true;
      }
    case 'peek': return pq.q.length ? pq.q[0] : null;
    case 'element': if (!pq.q.length) throw thr('NoSuchElementException', null); return pq.q[0];
    case 'size': return pq.q.length;
    case 'isEmpty': return pq.q.length === 0;
    case 'clear': pq.q = []; pq.modCount++; return undefined;
    case 'contains': return pq.q.some((x) => javaEquals(x, a0) || x === a0);
    case 'addAll': for (const x of toArrayOf(a0)) pq.offer(x); return true;
    case 'iterator': return iteratorOf(RT, pq);
    case 'stream': return new JStream(pq.q.slice(), 'obj');
    case 'toArray': return new JArray(T('Object'), pq.q.slice());
    case 'toString': return pq.toJavaString();
    case 'comparator': return pq.cmp;
    default: throw fail(name, args, 'PriorityQueue');
  }
}

export { JRandom, JScanner, JOptional, JStream as Stream, PrintStream, toArrayOf, hashKey };

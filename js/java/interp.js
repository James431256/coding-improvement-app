// Tree-walking interpreter for the Java subset.
import { parse } from './parser.js';
import {
  R, JChar, JLong, JDouble, JArray, JObject, JavaThrow, InterpError, compileError,
  mkChar, mkLong, mkDouble, mkFloat, T, PRIMS, defaultValue, kindOf, typeNameOf, typeStr,
  castTo, coerce, matchScore, str, javaHash, javaEquals, compareNatural, identityHash,
  binaryOp, unaryOp, resetHashes, toInt, isNumeric,
} from './values.js';
import * as lib from './stdlib.js';

// ---- completion signals ----
class Signal { constructor(type, label, value) { this.type = type; this.label = label; this.value = value; } }
const BREAK = new Signal('break', null);
const CONTINUE = new Signal('continue', null);

class Scope {
  constructor(parent, boundary = false) {
    this.parent = parent;
    this.vars = new Map();
    this.boundary = boundary;
  }
  declare(name, type, value) {
    for (let s = this; s; s = s.parent) {
      if (s.vars.has(name)) throw compileError(`variable ${name} is already defined in this method`);
      if (s.boundary) break;
    }
    const cell = { t: type, v: value };
    this.vars.set(name, cell);
    return cell;
  }
  find(name) {
    for (let s = this; s; s = s.parent) {
      const c = s.vars.get(name);
      if (c) return c;
    }
    return null;
  }
}

export class ClassRef {
  constructor(name, rclass = null) { this.name = name; this.rclass = rclass; }
}

export class RClass {
  constructor(name) {
    this.name = name;
    this.decl = null;
    this.superclass = null;
    this.interfaces = [];
    this.allInterfaces = new Set();
    this.methods = new Map();
    this.ctors = [];
    this.instFields = [];
    this.staticFieldDecls = [];
    this.statics = Object.create(null);
    this.staticTypes = Object.create(null);
    this.outer = null;
    this.closure = null;
    this.isInterface = false;
    this.isEnum = false;
    this.isRecord = false;
    this.isAbstract = false;
    this.nativeKind = null; // 'throwable' for built-in exceptions
    this.initialized = false;
    this.qualified = name;
  }
  isSubclassOf(name) {
    for (let c = this; c; c = c.superclass) {
      if (c.name === name || c.allInterfaces.has(name)) return true;
    }
    return false;
  }
  fieldType(name) {
    for (let c = this; c; c = c.superclass) {
      const f = c.instFields.find((x) => x.name === name);
      if (f) return f.type;
    }
    return undefined;
  }
}

export class JFunc {
  constructor(invoke, label = 'Lambda') {
    this.invoke = invoke; // (args[]) => value
    this.jclass = label;
  }
  toJavaString() { return `Main$$Lambda@${identityHash(this).toString(16)}`; }
}

const EXCEPTIONS = [
  ['Throwable', null, 'java.lang'],
  ['Exception', 'Throwable', 'java.lang'],
  ['Error', 'Throwable', 'java.lang'],
  ['RuntimeException', 'Exception', 'java.lang'],
  ['ArithmeticException', 'RuntimeException', 'java.lang'],
  ['IndexOutOfBoundsException', 'RuntimeException', 'java.lang'],
  ['ArrayIndexOutOfBoundsException', 'IndexOutOfBoundsException', 'java.lang'],
  ['StringIndexOutOfBoundsException', 'IndexOutOfBoundsException', 'java.lang'],
  ['NullPointerException', 'RuntimeException', 'java.lang'],
  ['IllegalArgumentException', 'RuntimeException', 'java.lang'],
  ['NumberFormatException', 'IllegalArgumentException', 'java.lang'],
  ['IllegalStateException', 'RuntimeException', 'java.lang'],
  ['ClassCastException', 'RuntimeException', 'java.lang'],
  ['UnsupportedOperationException', 'RuntimeException', 'java.lang'],
  ['NegativeArraySizeException', 'RuntimeException', 'java.lang'],
  ['ArrayStoreException', 'RuntimeException', 'java.lang'],
  ['ConcurrentModificationException', 'RuntimeException', 'java.util'],
  ['NoSuchElementException', 'RuntimeException', 'java.util'],
  ['InputMismatchException', 'NoSuchElementException', 'java.util'],
  ['EmptyStackException', 'RuntimeException', 'java.util'],
  ['IOException', 'Exception', 'java.io'],
  ['FileNotFoundException', 'IOException', 'java.io'],
  ['InterruptedException', 'Exception', 'java.lang'],
  ['CloneNotSupportedException', 'Exception', 'java.lang'],
  ['StackOverflowError', 'Error', 'java.lang'],
  ['OutOfMemoryError', 'Error', 'java.lang'],
  ['AssertionError', 'Error', 'java.lang'],
];

const MAX_DEPTH = 1800;

export class Interpreter {
  constructor(opts = {}) {
    this.maxSteps = opts.maxSteps ?? 30_000_000;
    this.maxMillis = opts.maxMillis ?? 8000;
    this.maxOutput = opts.maxOutput ?? 200_000;
    this.stdin = opts.stdin ?? '';
    this.stdinPos = 0;
    this.out = '';
    this.outTruncated = false;
    this.steps = 0;
    this.depth = 0;
    this.line = 0;
    this.started = Date.now();
    this.classes = new Map();
    this.loose = null;
    R.rt = this;
    resetHashes();
    for (const [name, sup, pkg] of EXCEPTIONS) {
      const c = new RClass(name);
      c.nativeKind = 'throwable';
      c.superclass = sup ? this.classes.get(sup) : null;
      c.qualified = pkg + '.' + name;
      c.initialized = true;
      c.instFields = [{ name: 'message', type: T('String') }, { name: 'cause', type: T('Throwable') }];
      this.classes.set(name, c);
    }
  }

  // ---------- loading ----------
  load(src) {
    const ast = parse(src);
    this.userClassNames = [];
    for (const d of ast.classes) this.declareClass(d, null, null);
    for (const d of ast.classes) this.linkClass(d);
    if (ast.statements.length) {
      // snippet mode: loose statements + loose methods go into a synthetic class
      const decl = {
        kind: 'class', name: 'Main', superclass: null, interfaces: [], fields: [], methods: [], ctors: [],
        inner: [], staticInits: [], instanceInits: [], enumConstants: [], typeParams: [],
      };
      const body = [];
      for (const s of ast.statements) {
        if (s.k === 'loosemethod') {
          const m = s.decl;
          if (m.kind === 'method') { m.isStatic = true; decl.methods.push(m); }
          else if (m.kind === 'fields') decl.fields.push(...m.fields.map((f) => ({ ...f, isStatic: true })));
        } else body.push(s);
      }
      if (this.classes.has('Main') && !this.classes.get('Main').nativeKind) {
        decl.name = '__Snippet';
      }
      decl.methods.push({
        kind: 'method', name: '__snippet_main', params: [], returnType: T('void'),
        body: { k: 'block', body, line: body[0] ? body[0].line : 1 }, isStatic: true, line: 1,
      });
      this.declareClass(decl, null, null);
      this.linkClass(decl);
      this.loose = this.classes.get(decl.name);
    }
    return ast;
  }

  declareClass(d, outer, closure) {
    if (this.classes.has(d.name) && !d.anonymous && !closure) {
      const existing = this.classes.get(d.name);
      if (!existing.nativeKind) throw compileError(`duplicate class: ${d.name}`, d.line);
    }
    const c = new RClass(d.name);
    c.decl = d;
    c.outer = outer;
    c.closure = closure;
    c.isInterface = d.kind === 'interface';
    c.isEnum = d.kind === 'enum';
    c.isRecord = d.kind === 'record';
    c.isAbstract = !!d.isAbstract;
    for (const m of d.methods) {
      if (!c.methods.has(m.name)) c.methods.set(m.name, []);
      c.methods.get(m.name).push(m);
    }
    c.ctors = d.ctors;
    c.instFields = d.fields.filter((f) => !f.isStatic);
    c.staticFieldDecls = d.fields.filter((f) => f.isStatic);
    if (!d.anonymous) this.classes.set(d.name, c);
    d.rclass = c;
    if (this.userClassNames) this.userClassNames.push(d.name);
    for (const inner of d.inner) this.declareClass(inner, c, closure);
    for (const ec of d.enumConstants) if (ec.body) this.declareClass(ec.body, c, closure);
    return c;
  }

  linkClass(d) {
    const c = d.rclass;
    if (d.superclass) {
      const sup = this.classes.get(d.superclass.base) || this.classes.get(d.superclass.base.split('.').pop());
      if (sup) {
        if (sup.isInterface && !d.anonymous) throw compileError(`no interface expected here`, d.line);
        if (sup.isInterface) c.interfaces.push(sup.name);
        else c.superclass = sup;
      } else if (d.anonymous) {
        c.interfaces.push(d.superclass.base);
      } else if (d.superclass.base !== 'Object') {
        throw compileError(`cannot find symbol: class ${d.superclass.base}`, d.line);
      }
    } else if (c.isEnum) {
      c.allInterfaces.add('Comparable');
    }
    for (const i of d.interfaces) c.interfaces.push(i.base);
    for (const inner of d.inner) this.linkClass(inner);
    for (const ec of d.enumConstants) if (ec.body) this.linkClass(ec.body);
    // gather all interface names (incl. inherited ones from user interfaces)
    const visit = (name) => {
      if (c.allInterfaces.has(name)) return;
      c.allInterfaces.add(name);
      const ic = this.classes.get(name);
      if (ic) for (const n of ic.interfaces) visit(n);
    };
    for (const i of c.interfaces) visit(i);
    if (c.superclass) for (const i of c.superclass.allInterfaces) c.allInterfaces.add(i);
  }

  ensureInit(c) {
    if (c.initialized) return;
    c.initialized = true;
    if (c.superclass) this.ensureInit(c.superclass);
    const ctx = { cls: c, self: null };
    const scope = new Scope(c.closure, true);
    if (c.isEnum) {
      let ordinal = 0;
      const values = [];
      for (const ec of c.decl.enumConstants) {
        const args = ec.args.map((a) => this.eval(a, scope, ctx));
        const cls = ec.body ? ec.body.rclass : c;
        const obj = this.instantiate(cls, args, null, { name: ec.name, ordinal: ordinal++ });
        c.statics[ec.name] = obj;
        c.staticTypes[ec.name] = T(c.name);
        values.push(obj);
      }
      c.enumValues = values;
    }
    for (const f of c.staticFieldDecls) {
      c.staticTypes[f.name] = f.type;
      c.statics[f.name] = defaultValue(f.type);
    }
    for (const f of c.staticFieldDecls) {
      if (f.init) {
        this.line = f.line;
        c.statics[f.name] = coerce(this.evalInit(f.init, f.type, scope, ctx), f.type);
      }
    }
    for (const b of c.decl.staticInits) this.execBlock(b, scope, ctx);
  }

  // ---------- running ----------
  runMain() {
    let main = null;
    if (this.loose) {
      main = this.loose.methods.get('__snippet_main')[0];
      this.ensureInit(this.loose);
      return this.invoke(this.loose, main, null, []);
    }
    for (const name of this.userClassNames) {
      const c = this.classes.get(name);
      const ms = c.methods.get('main');
      if (ms) {
        const m = ms.find((x) => x.isStatic);
        if (m) {
          this.ensureInit(c);
          const args = m.params.length ? [new JArray(T('String'), [])] : [];
          return this.invoke(c, m, null, args);
        }
      }
    }
    throw compileError('No `public static void main(String[] args)` method found. Add one, or just write statements directly.', 1);
  }

  write(s) {
    if (this.out.length + s.length > this.maxOutput) {
      this.out += s.slice(0, Math.max(0, this.maxOutput - this.out.length));
      this.outTruncated = true;
      throw new InterpError('output', 'Output limit exceeded (too much printing - is there an infinite loop?)', this.line);
    }
    this.out += s;
  }

  tick() {
    if (++this.steps > this.maxSteps || ((this.steps & 0xffff) === 0 && Date.now() - this.started > this.maxMillis)) {
      throw new InterpError('timeout', 'Time limit exceeded - your code ran too long. Check for an infinite loop.', this.line);
    }
  }

  // ---------- exceptions ----------
  makeThrow(className, message = null) {
    const c = this.classes.get(className) || this.classes.get('RuntimeException');
    const obj = new JObject(c);
    obj.fields.message = message;
    obj.fields.cause = null;
    obj.line = this.line;
    return new JavaThrow(obj);
  }
  npe(message = null) { return this.makeThrow('NullPointerException', message); }

  // ---------- object protocol (used by values.js / stdlib) ----------
  findUserMethod(cls, name, nargs) {
    for (let c = cls; c; c = c.superclass) {
      const ms = c.methods.get(name);
      if (ms) {
        const m = ms.find((x) => x.params.length === nargs && x.body);
        if (m) return { cls: c, m };
      }
    }
    // default methods in interfaces
    for (const iname of cls.allInterfaces) {
      const ic = this.classes.get(iname);
      if (!ic) continue;
      const ms = ic.methods.get(name);
      if (ms) {
        const m = ms.find((x) => x.params.length === nargs && x.body && !x.isStatic);
        if (m) return { cls: ic, m };
      }
    }
    return null;
  }

  objToString(o) {
    const f = this.findUserMethod(o.cls, 'toString', 0);
    if (f) return str(this.invoke(f.cls, f.m, o, []));
    if (o.enumName !== undefined) return o.enumName;
    if (o.cls.nativeKind === 'throwable' || o.cls.isSubclassOf('Throwable')) {
      const msg = this.callMethod(o, 'getMessage', []);
      let c = o.cls;
      while (c && !c.nativeKind) c = c.superclass;
      const qn = o.cls.nativeKind ? o.cls.qualified : o.cls.name;
      void c;
      return msg === null ? qn : `${qn}: ${str(msg)}`;
    }
    if (o.cls.isRecord) {
      return `${o.cls.name}[${o.cls.decl.recordComponents.map((rc) => `${rc.name}=${str(o.fields[rc.name])}`).join(', ')}]`;
    }
    const name = o.cls.decl && o.cls.decl.anonymous ? 'Main$1' : o.cls.name;
    return `${name}@${this.objHashCode(o).toString(16)}`;
  }
  objHashCode(o) {
    const f = this.findUserMethod(o.cls, 'hashCode', 0);
    if (f) return toInt(this.invoke(f.cls, f.m, o, []));
    if (o.cls.isRecord) {
      let h = 0;
      for (const rc of o.cls.decl.recordComponents) h = (Math.imul(31, h) + javaHash(o.fields[rc.name])) | 0;
      return h;
    }
    return identityHash(o);
  }
  objEquals(a, b) {
    const f = this.findUserMethod(a.cls, 'equals', 1);
    if (f) return this.invoke(f.cls, f.m, a, [b]) === true;
    if (a.cls.isRecord && b instanceof JObject && b.cls === a.cls) {
      return a.cls.decl.recordComponents.every((rc) => javaEquals(a.fields[rc.name], b.fields[rc.name]));
    }
    return a === b;
  }
  hasUserEquals(o) {
    return !!this.findUserMethod(o.cls, 'equals', 1) || o.cls.isRecord;
  }
  objCompareTo(a, b) {
    if (a.enumOrdinal !== undefined && b instanceof JObject && b.enumOrdinal !== undefined) return a.enumOrdinal - b.enumOrdinal;
    const f = this.findUserMethod(a.cls, 'compareTo', 1);
    if (!f) throw this.makeThrow('ClassCastException', `class ${a.cls.name} cannot be cast to class java.lang.Comparable`);
    return toInt(this.invoke(f.cls, f.m, a, [b]));
  }

  // Call a functional-interface value (lambda, method ref, or object implementing the interface)
  callFunctional(f, args) {
    if (f instanceof JFunc || (f && typeof f.invoke === 'function')) return f.invoke(args);
    if (f instanceof JObject) {
      const preferred = ['compare', 'apply', 'accept', 'test', 'get', 'run', 'applyAsInt', 'applyAsLong', 'applyAsDouble', 'call'];
      for (const n of preferred) {
        const m = this.findUserMethod(f.cls, n, args.length);
        if (m) return this.invoke(m.cls, m.m, f, args);
      }
      for (let c = f.cls; c; c = c.superclass) {
        for (const [, ms] of c.methods) {
          const m = ms.find((x) => !x.isStatic && x.params.length === args.length && x.body);
          if (m) return this.invoke(c, m, f, args);
        }
      }
    }
    if (f === null) throw this.npe();
    throw compileError(`${typeNameOf(f)} is not a functional interface`);
  }

  // ---------- invocation ----------
  invoke(cls, m, self, args, closureOverride) {
    if (++this.depth > MAX_DEPTH) {
      this.depth = 0;
      throw this.makeThrow('StackOverflowError');
    }
    const savedLine = this.line;
    const closure = closureOverride !== undefined ? closureOverride : (self && self.closure) || cls.closure;
    const scope = new Scope(closure, true);
    const ctx = { cls, self, method: m };
    const params = m.params;
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      let v;
      if (p.varargs) {
        const rest = args.slice(i);
        if (rest.length === 1 && (rest[0] instanceof JArray || rest[0] === null) && p.type.dims === (rest[0] ? rest[0].elemType.dims + 1 : 1)) v = rest[0];
        else v = new JArray({ ...p.type, dims: p.type.dims - 1 }, rest.map((x) => coerce(x, { ...p.type, dims: p.type.dims - 1 })));
      } else v = coerce(args[i], p.type);
      scope.declare(p.name, p.type, v);
    }
    try {
      const r = this.execBlockBody(m.body.body, scope, ctx);
      if (r instanceof Signal && r.type === 'return') {
        if (m.returnType && m.returnType.base !== 'void') return coerce(r.value, m.returnType);
        return undefined;
      }
      if (m.returnType && m.returnType.base !== 'void' && m.name !== '<init>') {
        throw compileError(`missing return statement in method ${m.name}()`, m.line);
      }
      return undefined;
    } catch (e) {
      if (e instanceof RangeError) {
        this.depth = 0;
        throw this.makeThrow('StackOverflowError');
      }
      throw e;
    } finally {
      this.depth--;
      this.line = savedLine;
    }
  }

  selectMethod(cands, args, name) {
    let best = null, bestScore = -Infinity;
    for (const c of cands) {
      const { m } = c;
      const ps = m.params;
      const hasVar = ps.length && ps[ps.length - 1].varargs;
      if (!hasVar && ps.length !== args.length) continue;
      if (hasVar && args.length < ps.length - 1) continue;
      let score = 0, ok = true;
      for (let i = 0; i < args.length; i++) {
        let pt;
        if (hasVar && i >= ps.length - 1) {
          const vt = ps[ps.length - 1].type;
          const s1 = matchScore(args[i], { ...vt, dims: vt.dims - 1 });
          const s2 = args.length === ps.length ? matchScore(args[i], vt) : -1;
          const s = Math.max(s1, s2);
          if (s < 0) { ok = false; break; }
          score += s - 0.5;
          continue;
        }
        pt = ps[i].type;
        if (c.typeParams && c.typeParams.includes(pt.base) && !pt.dims) { score += 1; continue; }
        const s = matchScore(args[i], pt);
        if (s < 0) { ok = false; break; }
        score += s;
      }
      if (!ok) continue;
      if (hasVar) score -= 1;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best) {
      const sig = args.map(typeNameOf).join(',');
      if (cands.length) throw compileError(`method ${name} cannot be applied to given types (${sig})`);
      throw compileError(`cannot find symbol: method ${name}(${sig})`);
    }
    return best;
  }

  methodCandidates(cls, name, wantStatic) {
    const out = [];
    const seen = new Set();
    const add = (c, ms) => {
      for (const m of ms) {
        if (wantStatic && !m.isStatic) continue;
        const key = m.params.map((p) => typeStr(p.type)).join(',');
        if (seen.has(key)) continue; // overridden
        if (!m.body && !wantStatic) { seen.add(key); continue; }
        seen.add(key);
        out.push({ cls: c, m, typeParams: [...(m.typeParams || []), ...((c.decl && c.decl.typeParams) || [])] });
      }
    };
    for (let c = cls; c; c = c.superclass) {
      const ms = c.methods.get(name);
      if (ms) add(c, ms);
    }
    for (const iname of cls.allInterfaces) {
      const ic = this.classes.get(iname);
      if (ic && ic.methods.get(name)) add(ic, ic.methods.get(name).filter((m) => m.body));
    }
    return out;
  }

  callMethod(obj, name, args, argNodes = null) {
    if (obj instanceof JObject) {
      const cands = this.methodCandidates(obj.cls, name, false);
      if (cands.length) {
        const c = this.selectMethod(cands, args, name);
        if (c.m.isStatic) return this.invoke(c.cls, c.m, null, args);
        return this.invoke(c.cls, c.m, obj, args);
      }
      return this.objectNative(obj, name, args);
    }
    if (obj === null || obj === undefined) {
      throw this.npe(`Cannot invoke "${name}()" because value is null`);
    }
    return lib.callInstance(this, obj, name, args, argNodes);
  }

  objectNative(obj, name, args) {
    const c = obj.cls;
    if (c.isSubclassOf('Throwable')) {
      switch (name) {
        case 'getMessage': case 'getLocalizedMessage': return obj.fields.message ?? null;
        case 'getCause': return obj.fields.cause ?? null;
        case 'printStackTrace': this.write(this.objToString(obj) + '\n'); return undefined;
        case 'initCause': obj.fields.cause = args[0]; return obj;
        default: break;
      }
    }
    if (obj.enumName !== undefined) {
      switch (name) {
        case 'name': return obj.enumName;
        case 'ordinal': return obj.enumOrdinal;
        case 'compareTo': return obj.enumOrdinal - args[0].enumOrdinal;
        case 'getDeclaringClass': return new ClassRef(c.name, c);
        default: break;
      }
    }
    if (c.isRecord && args.length === 0 && c.decl.recordComponents.some((rc) => rc.name === name)) {
      return obj.fields[name];
    }
    switch (name) {
      case 'toString': if (args.length === 0) return this.objToString(obj); break;
      case 'equals': if (args.length === 1) return this.objEquals(obj, args[0]); break;
      case 'hashCode': if (args.length === 0) return this.objHashCode(obj); break;
      case 'getClass': return lib.classObject(c.name);
      case 'compareTo': if (args.length === 1) return this.objCompareTo(obj, args[0]); break;
      default: break;
    }
    if (obj.closure !== null || c.allInterfaces.size) {
      // functional interface default methods (e.g. comparator.reversed()) on user objects
      const r = lib.functionalMethod(this, obj, name, args);
      if (r !== lib.NO_METHOD) return r;
    }
    throw compileError(`cannot find symbol: method ${name}(${args.map(typeNameOf).join(',')}) in class ${c.name}`);
  }

  instantiate(cls, args, closure = null, enumInfo = null) {
    if (cls.nativeKind === 'throwable') {
      const obj = new JObject(cls);
      obj.fields.message = null;
      obj.fields.cause = null;
      if (args.length >= 1) {
        if (args[0] instanceof JObject && args[0].cls.isSubclassOf('Throwable')) {
          obj.fields.cause = args[0];
          obj.fields.message = this.objToString(args[0]);
        } else obj.fields.message = args[0] === null ? null : str(args[0]);
      }
      if (args.length >= 2) obj.fields.cause = args[1];
      obj.line = this.line;
      return obj;
    }
    if (cls.isAbstract && !enumInfo && !(cls.decl && cls.decl.anonymous)) {
      throw compileError(`${cls.name} is abstract; cannot be instantiated`);
    }
    this.ensureInit(cls);
    const obj = new JObject(cls);
    obj.closure = closure;
    if (enumInfo) { obj.enumName = enumInfo.name; obj.enumOrdinal = enumInfo.ordinal; }
    // default values for every field in the hierarchy
    for (let c = cls; c; c = c.superclass) {
      for (const f of c.instFields) if (!(f.name in obj.fields)) obj.fields[f.name] = defaultValue(f.type);
    }
    this.construct(cls, obj, args);
    return obj;
  }

  construct(cls, obj, args) {
    if (cls.nativeKind === 'throwable') {
      if (args.length >= 1) {
        if (args[0] instanceof JObject && args[0].cls.isSubclassOf('Throwable')) {
          obj.fields.cause = args[0];
          obj.fields.message = this.objToString(args[0]);
        } else obj.fields.message = args[0] === null ? null : str(args[0]);
      }
      if (args.length >= 2) obj.fields.cause = args[1];
      return;
    }
    const ctx = { cls, self: obj };
    const runFieldInits = () => {
      const scope = new Scope(obj.closure || cls.closure, true);
      for (const f of cls.instFields) {
        if (f.init) { this.line = f.line; obj.fields[f.name] = coerce(this.evalInit(f.init, f.type, scope, ctx), f.type); }
      }
      for (const b of cls.decl.instanceInits) this.execBlock(b, scope, ctx);
    };
    if (!cls.ctors.length) {
      if (cls.isRecord) {
        if (cls.superclass) this.construct(cls.superclass, obj, []);
        cls.decl.recordComponents.forEach((rc, i) => { obj.fields[rc.name] = coerce(args[i], rc.type); });
        return;
      }
      if (args.length && !(cls.decl && cls.decl.anonymous)) {
        throw compileError(`constructor ${cls.name} in class ${cls.name} cannot be applied to given types (no constructor takes ${args.length} argument${args.length > 1 ? 's' : ''})`);
      }
      if (cls.superclass) this.construct(cls.superclass, obj, cls.decl && cls.decl.anonymous ? args : []);
      runFieldInits();
      return;
    }
    const chosen = this.selectMethod(cls.ctors.map((m) => ({ cls, m })), args, cls.name);
    const m = chosen.m;
    if (++this.depth > MAX_DEPTH) { this.depth = 0; throw this.makeThrow('StackOverflowError'); }
    const scope = new Scope(obj.closure || cls.closure, true);
    try {
      m.params.forEach((p, i) => {
        let v;
        if (p.varargs) v = new JArray({ ...p.type, dims: p.type.dims - 1 }, args.slice(i));
        else v = coerce(args[i], p.type);
        scope.declare(p.name, p.type, v);
      });
      const body = m.body.body;
      let start = 0;
      const first = body[0];
      if (first && first.k === 'expr' && first.expr.k === 'ctorcall') {
        start = 1;
        const cargs = first.expr.args.map((a) => this.eval(a, scope, ctx));
        if (first.expr.which === 'this') {
          const c2 = this.selectMethod(cls.ctors.map((mm) => ({ cls, m: mm })), cargs, cls.name);
          void c2;
          this.construct(cls, obj, cargs);
          const r = this.execBlockBody(body.slice(1), scope, ctx);
          void r;
          return;
        }
        if (cls.superclass) this.construct(cls.superclass, obj, cargs);
      } else if (cls.superclass) {
        this.construct(cls.superclass, obj, []);
      }
      runFieldInits();
      this.execBlockBody(start ? body.slice(start) : body, scope, ctx);
      if (m.compact) {
        for (const rc of cls.decl.recordComponents) obj.fields[rc.name] = scope.find(rc.name).v;
      }
    } finally {
      this.depth--;
    }
  }

  // ---------- statements ----------
  execBlock(block, scope, ctx) {
    return this.execBlockBody(block.body, new Scope(scope), ctx);
  }

  execBlockBody(stmts, scope, ctx) {
    for (let i = 0; i < stmts.length; i++) {
      const r = this.exec(stmts[i], scope, ctx);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  exec(s, scope, ctx, label = null) {
    this.tick();
    this.line = s.line || this.line;
    const h = EX[s.k];
    if (h === undefined) throw compileError(`unsupported statement: ${s.k}`, s.line);
    return h(this, s, scope, ctx, label);
  }

  execExprStmt(s, scope, ctx) {
    const e = s.expr;
    if (!STATEMENT_EXPRS.has(e.k)) throw compileError('not a statement', s.line);
    this.eval(e, scope, ctx);
    return undefined;
  }

  execLocal(s, scope, ctx) {
    for (const d of s.decls) {
      let t = s.type;
      if (d.dims) t = { ...t, dims: t.dims + d.dims };
      let v;
      if (d.init) {
        v = this.evalInit(d.init, t, scope, ctx);
        if (t.base === 'var') t = varTypeOf(v);
        else v = coerce(v, t);
      } else {
        if (t.base === 'var') throw compileError('cannot infer type for local variable (var needs an initializer)', s.line);
        v = undefined; // uninitialized
      }
      scope.declare(d.name, t, v);
    }
    return undefined;
  }

  execIf(s, scope, ctx) {
    if (this.cond(s.cond, scope, ctx)) return this.exec(s.then, scope, ctx);
    if (s.else) return this.exec(s.else, scope, ctx);
    return undefined;
  }

  execWhile(s, scope, ctx, label) {
    while (this.cond(s.cond, scope, ctx)) {
      const r = this.exec(s.body, scope, ctx);
      if (r !== undefined) {
        if (r.type === 'break' && (r.label === null || r.label === label)) break;
        if (r.type === 'continue' && (r.label === null || r.label === label)) continue;
        return r;
      }
    }
    return undefined;
  }

  execDo(s, scope, ctx, label) {
    do {
      const r = this.exec(s.body, scope, ctx);
      if (r !== undefined) {
        if (r.type === 'break' && (r.label === null || r.label === label)) break;
        if (r.type === 'continue' && (r.label === null || r.label === label)) continue;
        return r;
      }
    } while (this.cond(s.cond, scope, ctx));
    return undefined;
  }

  execFor(s, scope, ctx, label) {
    const fs = new Scope(scope);
    for (const i of s.init) this.exec(i, fs, ctx);
    for (;;) {
      if (s.cond && !this.cond(s.cond, fs, ctx)) break;
      const r = this.exec(s.body, fs, ctx);
      if (r !== undefined) {
        if (r.type === 'break' && (r.label === null || r.label === label)) break;
        if (!(r.type === 'continue' && (r.label === null || r.label === label))) return r;
      }
      for (const u of s.update) this.eval(u, fs, ctx);
      this.tick();
    }
    return undefined;
  }

  execForeach(s, scope, ctx, label) {
    const iterable = this.eval(s.iter, scope, ctx);
    if (iterable === null) throw this.npe('Cannot iterate over null');
    const t = s.type;
    const it = lib.iteratorOf(this, iterable);
    while (it.hasNext()) {
      const raw = it.next();
      const ls = new Scope(scope);
      ls.declare(s.name, t.base === 'var' ? varTypeOf(raw) : t, t.base === 'var' ? raw : coerce(raw, t));
      const r = this.exec(s.body, ls, ctx);
      if (r !== undefined) {
        if (r.type === 'break' && (r.label === null || r.label === label)) break;
        if (r.type === 'continue' && (r.label === null || r.label === label)) continue;
        return r;
      }
    }
    return undefined;
  }

  execThrow(s, scope, ctx) {
    const v = this.eval(s.expr, scope, ctx);
    if (v === null) throw this.npe();
    if (!(v instanceof JObject) || !v.cls.isSubclassOf('Throwable')) throw compileError('incompatible types: not a Throwable', s.line);
    v.line = s.line;
    throw new JavaThrow(v);
  }

  cond(e, scope, ctx) {
    const v = this.eval(e, scope, ctx);
    if (typeof v !== 'boolean') {
      if (v === null) throw this.npe();
      throw compileError(`incompatible types: ${typeNameOf(v)} cannot be converted to boolean`, e.line);
    }
    return v;
  }

  execTry(s, scope, ctx) {
    let result;
    const ts = new Scope(scope);
    try {
      for (const r of s.resources) this.exec(r, ts, ctx);
      result = this.execBlock(s.block, ts, ctx);
    } catch (e) {
      let err = e;
      if (e instanceof RangeError) err = this.makeThrow('StackOverflowError');
      if (!(err instanceof JavaThrow)) throw e;
      const h = s.catches.find((c) => c.types.some((t) => err.obj.cls.isSubclassOf(t)));
      if (!h) {
        if (s.fin) {
          const fr = this.execBlock(s.fin, scope, ctx);
          if (fr !== undefined) return fr;
        }
        throw err;
      }
      const cs = new Scope(scope);
      cs.declare(h.name, T(h.types[0]), err.obj);
      try {
        result = this.execBlock(h.body, cs, ctx);
      } catch (e2) {
        if (s.fin) {
          const fr = this.execBlock(s.fin, scope, ctx);
          if (fr !== undefined) return fr;
        }
        throw e2;
      }
    }
    if (s.fin) {
      const fr = this.execBlock(s.fin, scope, ctx);
      if (fr !== undefined) return fr;
    }
    return result;
  }

  switchMatches(disc, label, scope, ctx) {
    if (disc instanceof JObject && disc.enumName !== undefined && label.k === 'name') return disc.enumName === label.name;
    if (disc instanceof JObject && disc.enumName !== undefined && label.k === 'field') return disc.enumName === label.name;
    const lv = this.eval(label, scope, ctx);
    if (typeof disc === 'string') return disc === lv;
    if (lv === null) return disc === null;
    return binaryOp('==', disc, lv);
  }

  execSwitch(s, scope, ctx, isExpr) {
    const disc = this.eval(s.disc, scope, ctx);
    if (disc === null) throw this.npe();
    if (disc instanceof JDouble || disc instanceof JLong || typeof disc === 'boolean') {
      throw compileError(`switch on ${typeNameOf(disc)} is not allowed`, s.line);
    }
    let start = -1;
    for (let i = 0; i < s.cases.length && start < 0; i++) {
      const c = s.cases[i];
      if (c.labels && c.labels.some((l) => this.switchMatches(disc, l, scope, ctx))) start = i;
    }
    if (start < 0) start = s.cases.findIndex((c) => c.labels === null);
    if (start < 0) {
      if (isExpr) throw this.makeThrow('IncompatibleClassChangeError');
      return undefined;
    }
    const ss = new Scope(scope);
    if (s.arrow) {
      const c = s.cases[start];
      const body = c.body[0];
      if (body.k === 'arrowexpr') {
        const v = this.eval(body.expr, ss, ctx);
        return isExpr ? new Signal('yield', null, v) : undefined;
      }
      const r = this.exec(body, ss, ctx);
      if (r !== undefined && r.type === 'break' && r.label === null && !isExpr) return undefined;
      return r;
    }
    for (let i = start; i < s.cases.length; i++) {
      for (const st of s.cases[i].body) {
        const r = this.exec(st, ss, ctx);
        if (r !== undefined) {
          if (r.type === 'break' && r.label === null) return undefined;
          return r;
        }
      }
    }
    return undefined;
  }

  // ---------- expressions ----------
  evalInit(init, t, scope, ctx) {
    if (init.k === 'arrayinit') {
      if (!t.dims && t.base !== 'var') throw compileError(`illegal initializer for ${t.base}`, init.line);
      return this.buildArrayInit(init, { ...t, dims: t.dims - 1 }, scope, ctx);
    }
    if (init.k === 'lambda' || init.k === 'methodref') return this.eval(init, scope, ctx);
    return this.eval(init, scope, ctx);
  }

  buildArrayInit(init, elemType, scope, ctx) {
    const data = init.elems.map((e) => {
      if (e.k === 'arrayinit') return this.buildArrayInit(e, { ...elemType, dims: elemType.dims - 1 }, scope, ctx);
      return coerce(this.eval(e, scope, ctx), elemType);
    });
    return new JArray(elemType, data);
  }

  lookupName(name, scope, ctx, line) {
    const cell = scope.find(name);
    if (cell) {
      if (cell.v === undefined) throw compileError(`variable ${name} might not have been initialized`, line);
      return cell.v;
    }
    if (ctx.self && name in ctx.self.fields) {
      if (ctx.cls.fieldType(name) !== undefined || ctx.self.cls.fieldType(name) !== undefined) return ctx.self.fields[name];
    }
    for (let c = ctx.cls; c; c = c.outer || null) {
      for (let k = c; k; k = k.superclass) {
        if (k.staticFieldDecls.some((f) => f.name === name) || (k.isEnum && k.decl.enumConstants.some((e) => e.name === name))) {
          this.ensureInit(k);
          return k.statics[name];
        }
        for (const iname of k.allInterfaces) {
          const ic = this.classes.get(iname);
          if (ic && ic.staticFieldDecls.some((f) => f.name === name)) { this.ensureInit(ic); return ic.statics[name]; }
        }
      }
      if (c.outer === undefined) break;
    }
    if (this.classes.has(name)) return new ClassRef(name, this.classes.get(name));
    if (lib.isStaticClass(name)) return new ClassRef(name);
    if (ctx.self && name in ctx.self.fields) return ctx.self.fields[name];
    if (!ctx.self && ctx.cls && ctx.cls.fieldType(name) !== undefined) {
      throw compileError(`non-static variable ${name} cannot be referenced from a static context`, line);
    }
    throw compileError(`cannot find symbol: variable ${name}`, line);
  }

  // returns {get(), set(v), type}
  ref(e, scope, ctx) {
    switch (e.k) {
      case 'name': {
        const cell = scope.find(e.name);
        if (cell) {
          return {
            get: () => { if (cell.v === undefined) throw compileError(`variable ${e.name} might not have been initialized`, e.line); return cell.v; },
            set: (v) => { cell.v = v; },
            type: cell.t,
          };
        }
        if (ctx.self) {
          const ft = ctx.self.cls.fieldType(e.name);
          if (ft !== undefined) {
            const obj = ctx.self;
            return { get: () => obj.fields[e.name], set: (v) => { obj.fields[e.name] = v; }, type: ft };
          }
        }
        for (let c = ctx.cls; c; c = c.outer) {
          for (let k = c; k; k = k.superclass) {
            if (k.staticFieldDecls.some((f) => f.name === e.name)) {
              this.ensureInit(k);
              const kk = k;
              return { get: () => kk.statics[e.name], set: (v) => { kk.statics[e.name] = v; }, type: kk.staticTypes[e.name] };
            }
          }
        }
        if (ctx.cls && ctx.cls.fieldType(e.name) !== undefined) {
          throw compileError(`non-static variable ${e.name} cannot be referenced from a static context`, e.line);
        }
        throw compileError(`cannot find symbol: variable ${e.name}`, e.line);
      }
      case 'field': {
        const target = this.eval(e.target, scope, ctx);
        if (target instanceof ClassRef) {
          const c = target.rclass;
          if (!c) throw compileError(`cannot assign a value to final variable ${e.name}`, e.line);
          this.ensureInit(c);
          for (let k = c; k; k = k.superclass) {
            if (e.name in k.statics) {
              const kk = k;
              return { get: () => kk.statics[e.name], set: (v) => { kk.statics[e.name] = v; }, type: kk.staticTypes[e.name] };
            }
          }
          throw compileError(`cannot find symbol: variable ${e.name}`, e.line);
        }
        if (target === null) throw this.npe(`Cannot assign field "${e.name}" because value is null`);
        if (target instanceof JArray) throw compileError('cannot assign a value to final variable length', e.line);
        if (!(target instanceof JObject)) throw compileError(`cannot find symbol: variable ${e.name}`, e.line);
        const ft = target.cls.fieldType(e.name);
        if (ft === undefined) throw compileError(`cannot find symbol: variable ${e.name}`, e.line);
        return { get: () => target.fields[e.name], set: (v) => { target.fields[e.name] = v; }, type: ft };
      }
      case 'index': {
        const arr = this.eval(e.target, scope, ctx);
        const idx = toInt(this.eval(e.index, scope, ctx));
        if (arr === null) throw this.npe('Cannot store to array because it is null');
        if (!(arr instanceof JArray)) throw compileError(`array required, but ${typeNameOf(arr)} found`, e.line);
        if (idx < 0 || idx >= arr.data.length) throw this.makeThrow('ArrayIndexOutOfBoundsException', `Index ${idx} out of bounds for length ${arr.data.length}`);
        return { get: () => arr.data[idx], set: (v) => { arr.data[idx] = v; }, type: arr.elemType };
      }
      case 'paren': return this.ref(e.expr, scope, ctx);
      default:
        throw compileError('unexpected type: required variable, found value', e.line);
    }
  }

  eval(e, scope, ctx) {
    const h = EV[e.k];
    if (h === undefined) throw compileError(`unsupported expression: ${e.k}`, e.line);
    return h(this, e, scope, ctx);
  }

  evalIncDec(e, scope, ctx) {
    const r = this.ref(e.expr, scope, ctx);
    const old = r.get();
    if (old === null) throw this.npe();
    const t = r.type && r.type.base !== 'var' ? r.type : varTypeOf(old);
    const nv = castTo(primitiveOf(t, old), binaryOp(e.op === '++' ? '+' : '-', old, 1));
    r.set(coerce(nv, t));
    return e.k === 'preinc' ? nv : old;
  }

  evalCond(e, scope, ctx) {
    const c = this.cond(e.cond, scope, ctx);
    const a = this.eval(c ? e.a : e.b, scope, ctx);
    // numeric promotion for mixed int/double ternaries
    if (isNumeric(a) && (e.a.k === 'lit' || e.b.k === 'lit')) {
      const other = c ? e.b : e.a;
      if (other.k === 'lit' && other.jt === 'double' && kindOf(a) !== 'double') return castTo(T('double'), a);
    }
    return a;
  }

  evalCast(e, scope, ctx) {
    const v = this.eval(e.expr, scope, ctx);
    if (!e.type.dims && !PRIMS.has(e.type.base)) {
      if (v instanceof JObject && this.classes.has(e.type.base) && !v.cls.isSubclassOf(e.type.base)) {
        throw this.makeThrow('ClassCastException', `class ${v.cls.name} cannot be cast to class ${e.type.base}`);
      }
    }
    return castTo(e.type, v);
  }

  evalIndex(e, scope, ctx) {
    const arr = this.eval(e.target, scope, ctx);
    const idx = toInt(this.eval(e.index, scope, ctx));
    if (arr === null) throw this.npe('Cannot load from array because it is null');
    if (!(arr instanceof JArray)) throw compileError(`array required, but ${typeNameOf(arr)} found`, e.line);
    if (idx < 0 || idx >= arr.data.length) throw this.makeThrow('ArrayIndexOutOfBoundsException', `Index ${idx} out of bounds for length ${arr.data.length}`);
    return arr.data[idx];
  }

  evalSwitchExpr(e, scope, ctx) {
    const r = this.execSwitch(e, scope, ctx, true);
    if (r instanceof Signal && r.type === 'yield') return r.value;
    throw compileError('switch expression does not yield a value', e.line);
  }

  instanceOf(v, t) {
    if (v === null) return false;
    if (t.dims) return v instanceof JArray;
    switch (t.base) {
      case 'Object': return true;
      case 'String': case 'CharSequence': return typeof v === 'string';
      case 'Integer': return typeof v === 'number';
      case 'Long': return v instanceof JLong;
      case 'Double': return v instanceof JDouble;
      case 'Character': return v instanceof JChar;
      case 'Boolean': return typeof v === 'boolean';
      case 'Number': return typeof v === 'number' || v instanceof JLong || v instanceof JDouble;
      case 'Comparable': return typeof v === 'string' || isNumeric(v) || (v instanceof JObject && v.cls.isSubclassOf('Comparable'));
      default:
        if (v instanceof JObject) return v.cls.isSubclassOf(t.base);
        return lib.builtinInstanceOf(v, t.base);
    }
  }

  evalBinary(e, scope, ctx) {
    const op = e.op;
    if (op === '&&') {
      if (!this.cond(e.left, scope, ctx)) return false;
      return this.cond(e.right, scope, ctx);
    }
    if (op === '||') {
      if (this.cond(e.left, scope, ctx)) return true;
      return this.cond(e.right, scope, ctx);
    }
    const a = this.eval(e.left, scope, ctx);
    const b = this.eval(e.right, scope, ctx);
    if (op === '+' || op === '==' || op === '!=') {
      if (a === undefined || b === undefined) throw compileError("'void' type not allowed here", e.line);
    }
    if ((op === '==' || op === '!=') && typeof a === 'string' && typeof b === 'string') {
      // Model Java reference semantics loosely: identical literals are interned, runtime strings are not.
      return binaryOp(op, a, b);
    }
    return binaryOp(op, a, b);
  }

  evalAssign(e, scope, ctx) {
    const r = this.ref(e.target, scope, ctx);
    let v;
    if (e.op === '=') {
      if (e.value.k === 'arrayinit') v = this.buildArrayInit(e.value, { ...r.type, dims: r.type.dims - 1 }, scope, ctx);
      else v = this.eval(e.value, scope, ctx);
      if (v === undefined) throw compileError("'void' type not allowed here", e.line);
      v = coerce(v, r.type);
    } else {
      const old = r.get();
      const rhs = this.eval(e.value, scope, ctx);
      const op = e.op.slice(0, -1);
      if (typeof old === 'string' && op === '+') v = old + str(rhs);
      else {
        if (old === null) throw this.npe();
        const res = binaryOp(op, old, rhs);
        const t = r.type && r.type.base !== 'var' ? r.type : varTypeOf(old);
        v = coerce(castTo(primitiveOf(t, old), res), t);
      }
    }
    r.set(v);
    return v;
  }

  evalField(e, scope, ctx) {
    // qualified names like java.util.List
    const target = this.eval(e.target, scope, ctx);
    if (target instanceof ClassRef) {
      if (target.rclass) {
        const c = target.rclass;
        this.ensureInit(c);
        for (let k = c; k; k = k.superclass) {
          if (e.name in k.statics) return k.statics[e.name];
        }
        if (c.classes && c.classes.has(e.name)) return new ClassRef(e.name, c.classes.get(e.name));
        const inner = this.classes.get(e.name);
        if (inner && inner.outer === c) return new ClassRef(e.name, inner);
        if (e.name === 'length') throw compileError('cannot find symbol: variable length', e.line);
        throw compileError(`cannot find symbol: variable ${e.name} in class ${c.name}`, e.line);
      }
      return lib.getStaticField(this, target.name, e.name, e.line);
    }
    if (target === null) throw this.npe(`Cannot read field "${e.name}" because value is null`);
    if (target instanceof JArray) {
      if (e.name === 'length') return target.data.length;
      throw compileError(`cannot find symbol: variable ${e.name}`, e.line);
    }
    if (target instanceof JObject) {
      if (target.cls.fieldType(e.name) !== undefined || e.name in target.fields) return target.fields[e.name];
      // static via instance
      for (let k = target.cls; k; k = k.superclass) if (e.name in k.statics) return k.statics[e.name];
      throw compileError(`cannot find symbol: variable ${e.name}`, e.line);
    }
    if (typeof target === 'string' && e.name === 'length') throw compileError('cannot find symbol: variable length (for Strings use length())', e.line);
    throw compileError(`cannot find symbol: variable ${e.name} on ${typeNameOf(target)}`, e.line);
  }

  evalArgs(args, scope, ctx) {
    const out = new Array(args.length);
    for (let i = 0; i < args.length; i++) {
      const v = this.eval(args[i], scope, ctx);
      if (v === undefined) throw compileError("'void' type not allowed here", args[i].line);
      out[i] = v;
    }
    return out;
  }

  evalCall(e, scope, ctx) {
    this.line = e.line || this.line;
    if (e.target === null) {
      // unqualified: local functional var? no - Java doesn't allow calling vars. Look for methods in class chain + outer classes.
      const args = this.evalArgs(e.args, scope, ctx);
      for (let c = ctx.cls; c; c = c.outer) {
        const self = c === ctx.cls ? ctx.self : null;
        const cands = this.methodCandidates(self ? self.cls : c, e.name, false);
        if (cands.length) {
          const chosen = this.selectMethod(cands, args, e.name);
          if (!chosen.m.isStatic && !self) {
            throw compileError(`non-static method ${e.name}(${chosen.m.params.map((p) => typeStr(p.type)).join(',')}) cannot be referenced from a static context`, e.line);
          }
          return this.invoke(chosen.cls, chosen.m, chosen.m.isStatic ? null : self, args);
        }
        if (self) {
          const r = this.tryObjectNativeUnqualified(self, e.name, args);
          if (r !== lib.NO_METHOD) return r;
        } else if (c.isEnum && e.name === 'values' && !args.length) {
          this.ensureInit(c);
          return new JArray(T(c.name), c.enumValues.slice());
        }
      }
      throw compileError(`cannot find symbol: method ${e.name}(${args.map(typeNameOf).join(',')})`, e.line);
    }
    if (e.target.k === 'super') {
      const args = this.evalArgs(e.args, scope, ctx);
      const sup = ctx.cls.superclass;
      if (sup) {
        const cands = this.methodCandidates(sup, e.name, false);
        if (cands.length) {
          const chosen = this.selectMethod(cands, args, e.name);
          return this.invoke(chosen.cls, chosen.m, ctx.self, args);
        }
      }
      // Object methods
      const self = ctx.self;
      switch (e.name) {
        case 'toString': {
          if (sup && sup.isSubclassOf('Throwable')) return this.objectNative(self, 'toString', []);
          return `${self.cls.name}@${identityHash(self).toString(16)}`;
        }
        case 'hashCode': return identityHash(self);
        case 'equals': return self === args[0];
        default: return this.objectNative(self, e.name, args);
      }
    }
    const target = this.eval(e.target, scope, ctx);
    const args = this.evalArgs(e.args, scope, ctx);
    if (e.name === 'remove' && args.length === 1 && typeof args[0] === 'number' && this.isBoxedExpr(e.args[0], scope, ctx)) {
      // remove(Object) overload: the argument's static type is Integer, not int
      return this.callMethod(target, e.name, args, [{ k: 'cast', type: T('Integer') }]);
    }
    if (target instanceof ClassRef) {
      if (target.rclass) {
        const c = target.rclass;
        this.ensureInit(c);
        if (c.isEnum) {
          if (e.name === 'values' && !args.length) return new JArray(T(c.name), c.enumValues.slice());
          if (e.name === 'valueOf' && args.length === 1) {
            const v = c.enumValues.find((x) => x.enumName === args[0]);
            if (!v) throw this.makeThrow('IllegalArgumentException', `No enum constant ${c.name}.${args[0]}`);
            return v;
          }
        }
        const cands = this.methodCandidates(c, e.name, false);
        if (!cands.length) throw compileError(`cannot find symbol: method ${e.name} in class ${c.name}`, e.line);
        const chosen = this.selectMethod(cands, args, e.name);
        if (!chosen.m.isStatic) {
          throw compileError(`non-static method ${e.name}() cannot be referenced from a static context`, e.line);
        }
        return this.invoke(chosen.cls, chosen.m, null, args);
      }
      return lib.callStatic(this, target.name, e.name, args, e.args, e.line);
    }
    return this.callMethod(target, e.name, args, e.args);
  }

  // Best-effort static typing: does this expression have a boxed (Integer/Object) type?
  isBoxedExpr(node, scope, ctx) {
    switch (node.k) {
      case 'paren': return this.isBoxedExpr(node.expr, scope, ctx);
      case 'cast': return !PRIMS.has(node.type.base);
      case 'name': {
        const cell = scope.find(node.name);
        let t = cell ? cell.t : undefined;
        if (!cell && ctx.self) t = ctx.self.cls.fieldType(node.name);
        return !!t && !t.dims && !PRIMS.has(t.base) && t.base !== 'var';
      }
      case 'field': {
        const obj = node.target.k === 'this' ? ctx.self : null;
        const t = obj ? obj.cls.fieldType(node.name) : undefined;
        return !!t && !t.dims && !PRIMS.has(t.base);
      }
      case 'call':
        return ['valueOf', 'get', 'getKey', 'getValue', 'peek', 'poll', 'pop', 'getFirst', 'getLast', 'peekFirst', 'peekLast', 'next'].includes(node.name);
      default: return false;
    }
  }

  tryObjectNativeUnqualified(self, name, args) {
    if (self.cls.isEnum || (self.cls.superclass && self.cls.superclass.isEnum)) {
      const ec = self.cls.isEnum ? self.cls : self.cls.superclass;
      if (name === 'values' && !args.length) return new JArray(T(ec.name), ec.enumValues.slice());
    }
    if (['toString', 'hashCode', 'equals', 'getMessage', 'getClass', 'name', 'ordinal'].includes(name)) {
      return this.objectNative(self, name, args);
    }
    return lib.NO_METHOD;
  }

  evalNew(e, scope, ctx) {
    const args = this.evalArgs(e.args, scope, ctx);
    const base = e.type.base;
    if (e.body) {
      // anonymous class
      let c = e.body.rclass;
      if (!c) {
        c = this.declareClass(e.body, ctx.cls, null);
        this.linkClass(e.body);
      }
      const obj = this.instantiate(c, this.classes.has(base) && !this.classes.get(base).isInterface ? args : [], scope);
      return obj;
    }
    const uc = this.classes.get(base) || this.classes.get(base.split('.').pop());
    if (uc) {
      if (uc.isInterface) throw compileError(`${base} is abstract; cannot be instantiated`, e.line);
      if (uc.isEnum) throw compileError('enum classes may not be instantiated', e.line);
      return this.instantiate(uc, args, uc.closure ? null : null);
    }
    const r = lib.newBuiltin(this, e.type, args, e.line);
    if (r === undefined) throw compileError(`cannot find symbol: class ${base}`, e.line);
    return r;
  }

  evalNewArray(e, scope, ctx) {
    const elemBase = { base: e.type.base, args: e.type.args, dims: 0 };
    if (e.init) return this.buildArrayInit(e.init, { ...elemBase, dims: e.type.dims - 1 }, scope, ctx);
    const sizes = [];
    for (const d of e.dims) {
      if (d === null) break;
      const n = toInt(this.eval(d, scope, ctx));
      if (n < 0) throw this.makeThrow('NegativeArraySizeException', String(n));
      sizes.push(n);
    }
    const total = e.type.dims;
    const build = (level) => {
      const et = { ...elemBase, dims: total - level - 1 };
      const n = sizes[level];
      const data = new Array(n);
      if (level + 1 < sizes.length) for (let i = 0; i < n; i++) data[i] = build(level + 1);
      else { const dv = defaultValue(et); for (let i = 0; i < n; i++) data[i] = dv; }
      return new JArray(et, data);
    };
    if (sizes.length > 0 && sizes.reduce((a, b) => a * b, 1) > 20_000_000) {
      throw this.makeThrow('OutOfMemoryError', 'Java heap space');
    }
    return build(0);
  }

  makeLambda(e, scope, ctx) {
    const rt = this;
    const f = new JFunc((args) => {
      if (++rt.depth > MAX_DEPTH) { rt.depth = 0; throw rt.makeThrow('StackOverflowError'); }
      try {
        const ls = new Scope(scope);
        e.params.forEach((p, i) => ls.declare(p, null, args[i]));
        if (e.body.k === 'block') {
          const r = rt.execBlockBody(e.body.body, ls, ctx);
          if (r instanceof Signal && r.type === 'return') return r.value;
          return undefined;
        }
        return rt.eval(e.body, ls, ctx);
      } finally {
        rt.depth--;
      }
    });
    f.arity = e.params.length;
    return f;
  }

  makeMethodRef(e, scope, ctx) {
    const name = e.name;
    const rt = this;
    if (e.target.k === 'typeref') {
      const t = e.target.type;
      return new JFunc((args) => new JArray({ base: t.base, args: [], dims: t.dims - 1 }, new Array(toInt(args[0])).fill(defaultValue({ base: t.base, dims: t.dims - 1 }))));
    }
    const target = e.target.k === 'super' ? ctx.self : this.eval(e.target, scope, ctx);
    if (target instanceof ClassRef) {
      if (name === 'new') {
        if (target.rclass) return new JFunc((args) => rt.instantiate(target.rclass, args));
        return new JFunc((args) => lib.newBuiltin(rt, T(target.name), args, e.line));
      }
      if (target.rclass) {
        const c = target.rclass;
        const ms = c.methods.get(name) || [];
        const rf = new JFunc((args) => {
          const statics = rt.methodCandidates(c, name, true);
          if (statics.length) {
            try {
              const chosen = rt.selectMethod(statics, args, name);
              return rt.invoke(chosen.cls, chosen.m, null, args);
            } catch (err) { if (!(err instanceof InterpError)) throw err; }
          }
          return rt.callMethod(args[0], name, args.slice(1));
        });
        if (ms.length === 1) rf.arity = ms[0].isStatic ? ms[0].params.length : ms[0].params.length + 1;
        return rf;
      }
      const bf = new JFunc((args) => {
        if (lib.hasStatic(target.name, name, args.length)) return lib.callStatic(rt, target.name, name, args, null, e.line);
        return rt.callMethod(args[0], name, args.slice(1));
      });
      if (!lib.hasStatic(target.name, name, 1) && ['length', 'size', 'toLowerCase', 'toUpperCase', 'trim', 'intValue', 'getKey', 'getValue', 'isEmpty', 'hashCode'].includes(name)) bf.arity = 1;
      return bf;
    }
    return new JFunc((args) => rt.callMethod(target, name, args));
  }
}

const STATEMENT_EXPRS = new Set(['assign', 'preinc', 'postinc', 'call', 'new', 'ctorcall', 'lambda', 'switchexpr']);

function lit(rt, e) {
  switch (e.jt) {
    case 'int': return e.value;
    case 'long': return mkLong(e.value);
    case 'double': return mkDouble(e.value);
    case 'float': return mkFloat(e.value);
    case 'char': return mkChar(e.value);
    default: return e.value;
  }
}

const EV = {
  lit,
  name: (rt, e, scope, ctx) => rt.lookupName(e.name, scope, ctx, e.line),
  paren: (rt, e, scope, ctx) => rt.eval(e.expr, scope, ctx),
  this: (rt, e, scope, ctx) => {
    if (!ctx.self) throw compileError('non-static variable this cannot be referenced from a static context', e.line);
    return ctx.self;
  },
  binary: (rt, e, scope, ctx) => rt.evalBinary(e, scope, ctx),
  unary: (rt, e, scope, ctx) => unaryOp(e.op, rt.eval(e.expr, scope, ctx)),
  assign: (rt, e, scope, ctx) => rt.evalAssign(e, scope, ctx),
  preinc: (rt, e, scope, ctx) => rt.evalIncDec(e, scope, ctx),
  postinc: (rt, e, scope, ctx) => rt.evalIncDec(e, scope, ctx),
  cond: (rt, e, scope, ctx) => rt.evalCond(e, scope, ctx),
  cast: (rt, e, scope, ctx) => rt.evalCast(e, scope, ctx),
  instanceof: (rt, e, scope, ctx) => {
    const v = rt.eval(e.expr, scope, ctx);
    const ok = rt.instanceOf(v, e.type);
    if (ok && e.bind) scope.declare(e.bind, e.type, v);
    return ok;
  },
  index: (rt, e, scope, ctx) => rt.evalIndex(e, scope, ctx),
  field: (rt, e, scope, ctx) => rt.evalField(e, scope, ctx),
  call: (rt, e, scope, ctx) => rt.evalCall(e, scope, ctx),
  new: (rt, e, scope, ctx) => rt.evalNew(e, scope, ctx),
  newarray: (rt, e, scope, ctx) => rt.evalNewArray(e, scope, ctx),
  arrayinit: (rt, e) => { throw compileError('array initializer is only allowed in a declaration (use new int[]{...})', e.line); },
  lambda: (rt, e, scope, ctx) => rt.makeLambda(e, scope, ctx),
  methodref: (rt, e, scope, ctx) => rt.makeMethodRef(e, scope, ctx),
  switchexpr: (rt, e, scope, ctx) => rt.evalSwitchExpr(e, scope, ctx),
  classlit: (rt, e) => lib.classObject(e.target.name || 'Object'),
  ctorcall: (rt, e) => { throw compileError('call to this/super must be first statement in constructor', e.line); },
  super: (rt, e, scope, ctx) => ctx.self,
};

const EX = {
  expr: (rt, s, scope, ctx) => rt.execExprStmt(s, scope, ctx),
  local: (rt, s, scope, ctx) => rt.execLocal(s, scope, ctx),
  block: (rt, s, scope, ctx) => rt.execBlockBody(s.body, new Scope(scope), ctx),
  if: (rt, s, scope, ctx) => rt.execIf(s, scope, ctx),
  while: (rt, s, scope, ctx, label) => rt.execWhile(s, scope, ctx, label),
  do: (rt, s, scope, ctx, label) => rt.execDo(s, scope, ctx, label),
  for: (rt, s, scope, ctx, label) => rt.execFor(s, scope, ctx, label),
  foreach: (rt, s, scope, ctx, label) => rt.execForeach(s, scope, ctx, label),
  return: (rt, s, scope, ctx) => new Signal('return', null, s.expr ? rt.eval(s.expr, scope, ctx) : undefined),
  break: (rt, s) => (s.label ? new Signal('break', s.label) : BREAK),
  continue: (rt, s) => (s.label ? new Signal('continue', s.label) : CONTINUE),
  labeled: (rt, s, scope, ctx) => {
    const r = rt.exec(s.body, scope, ctx, s.label);
    if (r !== undefined && r.type === 'break' && r.label === s.label) return undefined;
    return r;
  },
  switch: (rt, s, scope, ctx) => rt.execSwitch(s, scope, ctx, false),
  yield: (rt, s, scope, ctx) => new Signal('yield', null, rt.eval(s.expr, scope, ctx)),
  arrowexpr: (rt, s, scope, ctx) => { rt.eval(s.expr, scope, ctx); return undefined; },
  throw: (rt, s, scope, ctx) => rt.execThrow(s, scope, ctx),
  try: (rt, s, scope, ctx) => rt.execTry(s, scope, ctx),
  empty: () => undefined,
  assert: () => undefined,
  localclass: (rt, s, scope, ctx) => {
    rt.declareClass(s.decl, ctx.cls, scope);
    rt.linkClass(s.decl);
    return undefined;
  },
};

function varTypeOf(v) {
  if (typeof v === 'number') return T('int');
  if (typeof v === 'boolean') return T('boolean');
  if (typeof v === 'string') return T('String');
  if (v instanceof JDouble) return T('double');
  if (v instanceof JChar) return T('char');
  if (v instanceof JLong) return T('long');
  if (v instanceof JArray) return { ...v.elemType, dims: (v.elemType.dims || 0) + 1 };
  return T('var');
}

// The primitive type used for the implicit narrowing cast in compound assignment / ++.
function primitiveOf(t, old) {
  if (t && PRIMS.has(t.base) && !t.dims) return t;
  const k = kindOf(old);
  return k ? T(k) : T('var');
}

Interpreter.JFuncClass = JFunc;
Interpreter.ClassRefClass = ClassRef;

export { Scope, Signal };

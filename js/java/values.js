// Runtime value representation + Java semantics helpers.
//
//   int/short/byte -> JS number (always an int32)
//   long           -> JLong   (BigInt payload)
//   double/float   -> JDouble
//   char           -> JChar
//   boolean        -> JS boolean
//   String         -> JS string
//   null           -> null
//   arrays         -> JArray
//   user objects   -> JObject
//   library types  -> classes in stdlib.js

export const R = { rt: null }; // current interpreter (set while running)

export class JChar {
  constructor(c) { this.c = c; }
}
const CHAR_CACHE = [];
for (let i = 0; i < 256; i++) CHAR_CACHE.push(new JChar(i));
export function mkChar(c) {
  c &= 0xffff;
  return c < 256 ? CHAR_CACHE[c] : new JChar(c);
}

export class JLong {
  constructor(v) { this.v = BigInt.asIntN(64, v); }
}
export function mkLong(v) { return new JLong(typeof v === 'bigint' ? v : BigInt(v)); }

export class JDouble {
  constructor(v, f = false) { this.v = v; this.f = f; }
}
export function mkDouble(v) { return new JDouble(v); }
export function mkFloat(v) { return new JDouble(Math.fround(v), true); }

let nextHash = 0x1b6d3586;
export function identityHash(o) {
  if (o.__hash === undefined) {
    Object.defineProperty(o, '__hash', { value: nextHash, enumerable: false, writable: true });
    nextHash = (Math.imul(nextHash ^ (nextHash >>> 13), 0x5bd1e995) >>> 0) & 0x7fffffff;
  }
  return o.__hash;
}
export function resetHashes() { nextHash = 0x1b6d3586; }

export class JArray {
  constructor(elemType, data) {
    this.elemType = elemType; // type object {base, args, dims}
    this.data = data;
  }
}

export class JObject {
  constructor(cls) {
    this.cls = cls;
    this.fields = Object.create(null);
    this.closure = null;
  }
}

// A thrown Java exception travelling through JS.
export class JavaThrow {
  constructor(obj) { this.obj = obj; }
}

// Errors that are not catchable from Java code: "compile" errors, timeouts.
export class InterpError extends Error {
  constructor(kind, message, line) {
    super(message);
    this.kind = kind; // 'compile' | 'timeout' | 'internal'
    this.line = line;
  }
}

export function compileError(msg, line) {
  return new InterpError('compile', msg, line ?? (R.rt ? R.rt.line : undefined));
}

export const PRIMS = new Set(['int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short']);

export function T(base, dims = 0, args = []) { return { base, args, dims }; }

export function defaultValue(t) {
  if (!t || t.dims) return null;
  switch (t.base) {
    case 'int': case 'short': case 'byte': return 0;
    case 'long': return mkLong(0n);
    case 'double': case 'float': return mkDouble(0);
    case 'char': return mkChar(0);
    case 'boolean': return false;
    default: return null;
  }
}

export function kindOf(v) {
  if (typeof v === 'number') return 'int';
  if (v instanceof JDouble) return 'double';
  if (v instanceof JChar) return 'char';
  if (v instanceof JLong) return 'long';
  return null;
}

export function typeNameOf(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return 'int';
  if (typeof v === 'string') return 'String';
  if (typeof v === 'boolean') return 'boolean';
  if (v instanceof JDouble) return 'double';
  if (v instanceof JChar) return 'char';
  if (v instanceof JLong) return 'long';
  if (v instanceof JArray) return typeStr(v.elemType) + '[]';
  if (v instanceof JObject) return v.cls.name;
  if (v.jclass) return v.jclass;
  return 'Object';
}

export function typeStr(t) {
  if (!t) return 'Object';
  return t.base + '[]'.repeat(t.dims || 0);
}

export function isNumeric(v) {
  return typeof v === 'number' || v instanceof JDouble || v instanceof JChar || v instanceof JLong;
}

export function toNumber(v) {
  if (typeof v === 'number') return v;
  if (v instanceof JDouble) return v.v;
  if (v instanceof JChar) return v.c;
  if (v instanceof JLong) return Number(v.v);
  if (v === null) throw R.rt.npe('Cannot unbox null value');
  throw compileError(`bad operand type ${typeNameOf(v)} for numeric operation`);
}
export function toBig(v) {
  if (v instanceof JLong) return v.v;
  if (typeof v === 'number') return BigInt(v);
  if (v instanceof JChar) return BigInt(v.c);
  if (v === null) throw R.rt.npe('Cannot unbox null value');
  throw compileError(`bad operand type ${typeNameOf(v)}`);
}
export function toInt(v) {
  if (typeof v === 'number') return v;
  if (v instanceof JChar) return v.c;
  if (v === null) throw R.rt.npe('Cannot unbox null value');
  if (v instanceof JLong || v instanceof JDouble) throw compileError(`incompatible types: possible lossy conversion from ${typeNameOf(v)} to int`);
  throw compileError(`incompatible types: ${typeNameOf(v)} cannot be converted to int`);
}

// ---- casting / coercion ----
export function d2i(x) {
  if (Number.isNaN(x)) return 0;
  if (x >= 2147483647) return 2147483647;
  if (x <= -2147483648) return -2147483648;
  return Math.trunc(x) | 0;
}
export function d2l(x) {
  if (Number.isNaN(x)) return 0n;
  if (x >= 9223372036854775807) return 9223372036854775807n;
  if (x <= -9223372036854775808) return -9223372036854775808n;
  return BigInt(Math.trunc(x));
}

// Explicit cast `(T) v`.
export function castTo(t, v) {
  if (t.dims) return v;
  const k = kindOf(v);
  switch (t.base) {
    case 'int':
      if (k === 'int') return v;
      if (k === 'char') return v.c;
      if (k === 'long') return Number(BigInt.asIntN(32, v.v));
      if (k === 'double') return d2i(v.v);
      break;
    case 'short':
      if (k === 'double') return (d2i(v.v) << 16) >> 16;
      if (k === 'long') return Number(BigInt.asIntN(16, v.v));
      if (k) return (toInt(v) << 16) >> 16;
      break;
    case 'byte':
      if (k === 'double') return (d2i(v.v) << 24) >> 24;
      if (k === 'long') return Number(BigInt.asIntN(8, v.v));
      if (k) return (toInt(v) << 24) >> 24;
      break;
    case 'long':
      if (k === 'double') return mkLong(d2l(v.v));
      if (k) return mkLong(toBig(v));
      break;
    case 'double':
      if (k) return mkDouble(toNumber(v));
      break;
    case 'float':
      if (k) return mkFloat(toNumber(v));
      break;
    case 'char':
      if (k === 'double') return mkChar(d2i(v.v));
      if (k === 'long') return mkChar(Number(BigInt.asIntN(32, v.v)));
      if (k) return mkChar(toInt(v));
      break;
    case 'boolean':
      if (typeof v === 'boolean') return v;
      break;
    case 'Integer': case 'Long': case 'Double': case 'Character': case 'Boolean': case 'String':
    case 'Float': case 'Short': case 'Byte':
      if (v === null) return null;
      if (boxMatches(t.base, v)) return v;
      throw R.rt.makeThrow('ClassCastException', `class ${javaClassName(v)} cannot be cast to class java.lang.${t.base}`);
    default:
      return v;
  }
  if (v === null) throw R.rt.npe('Cannot unbox null value');
  throw compileError(`incompatible types: ${typeNameOf(v)} cannot be converted to ${t.base}`);
}

function boxMatches(base, v) {
  switch (base) {
    case 'Integer': case 'Short': case 'Byte': return typeof v === 'number';
    case 'Long': return v instanceof JLong;
    case 'Double': case 'Float': return v instanceof JDouble;
    case 'Character': return v instanceof JChar;
    case 'Boolean': return typeof v === 'boolean';
    case 'String': return typeof v === 'string';
    default: return true;
  }
}

export function javaClassName(v) {
  if (typeof v === 'number') return 'java.lang.Integer';
  if (typeof v === 'string') return 'java.lang.String';
  if (typeof v === 'boolean') return 'java.lang.Boolean';
  if (v instanceof JDouble) return 'java.lang.Double';
  if (v instanceof JChar) return 'java.lang.Character';
  if (v instanceof JLong) return 'java.lang.Long';
  return typeNameOf(v);
}

// Assignment conversion (declared type <- value). Lenient about boxing, strict about lossy narrowing.
export function coerce(v, t) {
  if (!t || t.base === 'var') return v;
  if (t.dims) {
    if (v === null || v instanceof JArray) return v;
    throw compileError(`incompatible types: ${typeNameOf(v)} cannot be converted to ${typeStr(t)}`);
  }
  const k = kindOf(v);
  switch (t.base) {
    case 'int':
      if (k === 'int') return v;
      if (k === 'char') return v.c;
      break;
    case 'short': case 'byte':
      if (k === 'int') return castTo(t, v);
      if (k === 'char') return castTo(t, v);
      break;
    case 'long':
      if (k === 'long') return v;
      if (k === 'int' || k === 'char') return mkLong(toBig(v));
      break;
    case 'double':
      if (k === 'double') return v.f ? mkDouble(v.v) : v;
      if (k) return mkDouble(toNumber(v));
      break;
    case 'float':
      if (k === 'double' && !v.f) throw compileError('incompatible types: possible lossy conversion from double to float');
      if (k) return mkFloat(toNumber(v));
      break;
    case 'char':
      if (k === 'char') return v;
      if (k === 'int') return mkChar(v);
      break;
    case 'boolean':
      if (typeof v === 'boolean') return v;
      break;
    case 'Integer': case 'Short': case 'Byte':
      if (v === null || k === 'int') return v;
      if (k === 'char') return v.c;
      break;
    case 'Long':
      if (v === null || k === 'long') return v;
      if (k === 'int') return mkLong(BigInt(v));
      break;
    case 'Double': case 'Float':
      if (v === null || k === 'double') return v;
      if (k === 'int' || k === 'long') return mkDouble(toNumber(v));
      break;
    case 'Character':
      if (v === null || k === 'char') return v;
      if (k === 'int') return mkChar(v);
      break;
    case 'Boolean':
      if (v === null || typeof v === 'boolean') return v;
      break;
    case 'String': case 'CharSequence':
      if (v === null || typeof v === 'string') return v;
      break;
    default:
      return v;
  }
  if (v === null && PRIMS.has(t.base)) throw R.rt.npe('Cannot unbox null value');
  if (v === undefined) throw compileError('variable might not have been initialized');
  const from = typeNameOf(v);
  if ((k === 'double' || k === 'long') && ['int', 'short', 'byte', 'char', 'long'].includes(t.base)) {
    throw compileError(`incompatible types: possible lossy conversion from ${from} to ${t.base}`);
  }
  throw compileError(`incompatible types: ${from} cannot be converted to ${t.base}`);
}

// How well does value v fit parameter type t?  -1 = not at all.
export function matchScore(v, t) {
  if (!t) return 1;
  if (t.dims) {
    if (v === null) return 2;
    if (v instanceof JArray) {
      const et = v.elemType;
      if ((et.dims || 0) + 1 === t.dims && et.base === t.base) return 4;
      if ((et.dims || 0) + 1 === t.dims && !PRIMS.has(t.base) && !PRIMS.has(et.base)) return 2;
      return -1;
    }
    return -1;
  }
  const k = kindOf(v);
  switch (t.base) {
    case 'int': return k === 'int' ? 4 : k === 'char' ? 2 : -1;
    case 'short': case 'byte': return k === 'int' ? 3 : -1;
    case 'long': return k === 'long' ? 4 : (k === 'int' || k === 'char') ? 2 : -1;
    case 'double': case 'float': return k === 'double' ? 4 : k ? 1 : -1;
    case 'char': return k === 'char' ? 4 : -1;
    case 'boolean': return typeof v === 'boolean' ? 4 : -1;
    case 'Integer': return k === 'int' ? 3 : v === null ? 2 : -1;
    case 'Long': return k === 'long' ? 3 : v === null ? 2 : -1;
    case 'Double': return k === 'double' ? 3 : v === null ? 2 : -1;
    case 'Character': return k === 'char' ? 3 : v === null ? 2 : -1;
    case 'Boolean': return typeof v === 'boolean' ? 3 : v === null ? 2 : -1;
    case 'String': return typeof v === 'string' ? 4 : v === null ? 2 : -1;
    case 'Object': return 1;
    default:
      if (v instanceof JObject) {
        for (let c = v.cls; c; c = c.superclass) {
          if (c.name === t.base) return 3;
          if (c.allInterfaces && c.allInterfaces.has(t.base)) return 3;
        }
        return R.rt && R.rt.classes.has(t.base) ? -1 : 1;
      }
      if (k || typeof v === 'boolean' || typeof v === 'string') {
        return R.rt && R.rt.classes.has(t.base) ? -1 : (t.base.length === 1 ? 1 : 0);
      }
      return 1;
  }
}

// ---- formatting ----
export function fmtDouble(x) {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return 'Infinity';
  if (x === -Infinity) return '-Infinity';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const ax = Math.abs(x);
  if (ax >= 1e-3 && ax < 1e7) {
    const s = String(x);
    return s.includes('.') ? s : s + '.0';
  }
  // scientific: Java uses e.g. 1.0E10, 1.234E-5
  let [mant, exp] = x.toExponential().split('e');
  if (!mant.includes('.')) mant += '.0';
  return mant + 'E' + (exp.startsWith('+') ? exp.slice(1) : exp);
}

export function fmtFloat(x) {
  if (!Number.isFinite(x) || x === 0) return fmtDouble(x);
  // shortest decimal that round-trips through float32
  let digits = 1;
  let s;
  for (; digits <= 9; digits++) {
    s = x.toPrecision(digits);
    if (Math.fround(parseFloat(s)) === x) break;
  }
  const y = parseFloat(s);
  const ax = Math.abs(y);
  if (ax >= 1e-3 && ax < 1e7) {
    const t = String(y);
    return t.includes('.') ? t : t + '.0';
  }
  return fmtDouble(y);
}

export function str(v) {
  if (v === null || v === undefined) return 'null';
  switch (typeof v) {
    case 'string': return v;
    case 'number': return String(v);
    case 'boolean': return v ? 'true' : 'false';
    default: break;
  }
  if (v instanceof JChar) return String.fromCharCode(v.c);
  if (v instanceof JDouble) return v.f ? fmtFloat(v.v) : fmtDouble(v.v);
  if (v instanceof JLong) return v.v.toString();
  if (v instanceof JArray) return arrayTypeCode(v) + '@' + identityHash(v).toString(16);
  if (v instanceof JObject) return R.rt.objToString(v);
  if (typeof v.toJavaString === 'function') return v.toJavaString();
  return String(v);
}

export function arrayTypeCode(a) {
  const codes = { int: 'I', long: 'J', double: 'D', float: 'F', char: 'C', boolean: 'Z', byte: 'B', short: 'S' };
  const et = a.elemType;
  let s = '[' + '['.repeat(et.dims || 0);
  if (codes[et.base]) s += codes[et.base];
  else s += 'L' + qualify(et.base) + ';';
  return s;
}

export function qualify(name) {
  if (['String', 'Integer', 'Long', 'Double', 'Character', 'Boolean', 'Object', 'Math', 'StringBuilder'].includes(name)) return 'java.lang.' + name;
  return name;
}

// String.hashCode
export function stringHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
export function doubleHash(x) {
  f64[0] = Number.isNaN(x) ? NaN : x;
  return (u32[0] ^ u32[1]) | 0;
}

export function javaHash(v) {
  if (v === null || v === undefined) return 0;
  switch (typeof v) {
    case 'number': return v;
    case 'string': return stringHash(v);
    case 'boolean': return v ? 1231 : 1237;
    default: break;
  }
  if (v instanceof JChar) return v.c;
  if (v instanceof JLong) return Number(BigInt.asIntN(32, v.v ^ (v.v >> 32n)));
  if (v instanceof JDouble) return doubleHash(v.v);
  if (v instanceof JObject) return R.rt.objHashCode(v);
  if (typeof v.javaHashCode === 'function') return v.javaHashCode();
  return identityHash(v);
}

export function javaEquals(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a instanceof JChar) return b instanceof JChar && a.c === b.c;
  if (a instanceof JLong) return b instanceof JLong && a.v === b.v;
  if (a instanceof JDouble) return b instanceof JDouble && Object.is(a.v, b.v);
  if (a instanceof JObject) return R.rt.objEquals(a, b);
  if (typeof a.javaEquals === 'function') return a.javaEquals(b);
  return false;
}

// Natural ordering (Comparable)
export function compareNatural(a, b) {
  if (a === null || b === null) throw R.rt.npe();
  if (typeof a === 'string' && typeof b === 'string') return stringCompare(a, b);
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean') return a === b ? 0 : a ? 1 : -1;
  if (a instanceof JLong && b instanceof JLong) return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
  if (a instanceof JChar && b instanceof JChar) return a.c - b.c;
  if (a instanceof JDouble && b instanceof JDouble) return doubleCompare(a.v, b.v);
  if (a instanceof JObject) return R.rt.objCompareTo(a, b);
  if (isNumeric(a) && isNumeric(b)) {
    const x = toNumber(a), y = toNumber(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  throw R.rt.makeThrow('ClassCastException', `class ${javaClassName(a)} cannot be cast to class java.lang.Comparable`);
}

export function doubleCompare(x, y) {
  if (x < y) return -1;
  if (x > y) return 1;
  if (x === y) {
    if (x === 0) { const ax = Object.is(x, -0), ay = Object.is(y, -0); return ax === ay ? 0 : ax ? -1 : 1; }
    return 0;
  }
  const nx = Number.isNaN(x), ny = Number.isNaN(y);
  return nx === ny ? 0 : nx ? 1 : -1;
}

export function stringCompare(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a.charCodeAt(i) - b.charCodeAt(i);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

// ---- arithmetic ----
function promoteKind(a, b) {
  const ka = kindOf(a), kb = kindOf(b);
  if (!ka || !kb) {
    if (a === null || b === null) throw R.rt.npe('Cannot unbox null value');
    return null;
  }
  if (ka === 'double' || kb === 'double') return 'double';
  if (ka === 'long' || kb === 'long') return 'long';
  return 'int';
}

export function binaryOp(op, a, b) {
  if (op === '+' && (typeof a === 'string' || typeof b === 'string')) return str(a) + str(b);
  if (op === '==' || op === '!=') {
    let eq;
    if (isNumeric(a) && isNumeric(b)) {
      const k = promoteKind(a, b);
      if (k === 'long') eq = toBig(a) === toBig(b);
      else eq = toNumber(a) === toNumber(b);
    } else if ((isNumeric(a) && b === null) || (a === null && isNumeric(b))) {
      eq = false;
    } else eq = a === b;
    return op === '==' ? eq : !eq;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    if (typeof a !== 'boolean' || typeof b !== 'boolean') {
      if (a === null || b === null) throw R.rt.npe();
      throw compileError(`bad operand types for binary operator '${op}': ${typeNameOf(a)} and ${typeNameOf(b)}`);
    }
    switch (op) {
      case '&': return a && b;
      case '|': return a || b;
      case '^': return a !== b;
      default: throw compileError(`bad operand types for binary operator '${op}': boolean and boolean`);
    }
  }
  if (op === '<<' || op === '>>' || op === '>>>') {
    const ka = kindOf(a);
    if (!ka || ka === 'double') throw compileError(`bad operand type ${typeNameOf(a)} for shift operator`);
    if (ka === 'long') {
      const s = BigInt(Number(toBig(b) & 63n));
      if (op === '<<') return mkLong(a.v << s);
      if (op === '>>') return mkLong(a.v >> s);
      return mkLong(BigInt.asUintN(64, a.v) >> s);
    }
    const x = toInt(a), s = Number(toBig(b) & 31n);
    if (op === '<<') return x << s;
    if (op === '>>') return x >> s;
    return (x >>> s) | 0;
  }
  const k = promoteKind(a, b);
  if (!k) throw compileError(`bad operand types for binary operator '${op}': ${typeNameOf(a)} and ${typeNameOf(b)}`);
  if (k === 'double') {
    const x = toNumber(a), y = toNumber(b);
    const isF = (a instanceof JDouble ? a.f : true) && (b instanceof JDouble ? b.f : true);
    const mk = isF ? mkFloat : mkDouble;
    switch (op) {
      case '+': return mk(x + y);
      case '-': return mk(x - y);
      case '*': return mk(x * y);
      case '/': return mk(x / y);
      case '%': return mk(x % y);
      case '<': return x < y;
      case '>': return x > y;
      case '<=': return x <= y;
      case '>=': return x >= y;
      default: throw compileError(`bad operand types for binary operator '${op}': double`);
    }
  }
  if (k === 'long') {
    const x = toBig(a), y = toBig(b);
    switch (op) {
      case '+': return mkLong(x + y);
      case '-': return mkLong(x - y);
      case '*': return mkLong(x * y);
      case '/': if (y === 0n) throw R.rt.makeThrow('ArithmeticException', '/ by zero'); return mkLong(x / y);
      case '%': if (y === 0n) throw R.rt.makeThrow('ArithmeticException', '/ by zero'); return mkLong(x % y);
      case '&': return mkLong(x & y);
      case '|': return mkLong(x | y);
      case '^': return mkLong(x ^ y);
      case '<': return x < y;
      case '>': return x > y;
      case '<=': return x <= y;
      case '>=': return x >= y;
      default: throw compileError(`bad operator ${op}`);
    }
  }
  const x = toInt(a), y = toInt(b);
  switch (op) {
    case '+': return (x + y) | 0;
    case '-': return (x - y) | 0;
    case '*': return Math.imul(x, y);
    case '/': if (y === 0) throw R.rt.makeThrow('ArithmeticException', '/ by zero'); return (x / y) | 0;
    case '%': if (y === 0) throw R.rt.makeThrow('ArithmeticException', '/ by zero'); return (x % y) | 0;
    case '&': return x & y;
    case '|': return x | y;
    case '^': return x ^ y;
    case '<': return x < y;
    case '>': return x > y;
    case '<=': return x <= y;
    case '>=': return x >= y;
    default: throw compileError(`bad operator ${op}`);
  }
}

export function unaryOp(op, v) {
  if (op === '!') {
    if (typeof v !== 'boolean') throw compileError(`bad operand type ${typeNameOf(v)} for unary operator '!'`);
    return !v;
  }
  const k = kindOf(v);
  if (!k) {
    if (v === null) throw R.rt.npe();
    throw compileError(`bad operand type ${typeNameOf(v)} for unary operator '${op}'`);
  }
  if (op === '+') return k === 'char' ? v.c : v;
  if (op === '-') {
    if (k === 'double') return new JDouble(-v.v, v.f);
    if (k === 'long') return mkLong(-v.v);
    return (-toInt(v)) | 0;
  }
  if (op === '~') {
    if (k === 'long') return mkLong(~v.v);
    if (k === 'double') throw compileError("bad operand type double for unary operator '~'");
    return ~toInt(v);
  }
  throw compileError('bad unary operator ' + op);
}

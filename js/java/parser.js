// Recursive-descent parser producing a small AST for the Java subset.
import { tokenize, JavaSyntaxError } from './lexer.js';

const PRIMITIVES = new Set(['int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'void']);
const MODIFIERS = new Set(['public', 'private', 'protected', 'static', 'final', 'abstract',
  'synchronized', 'transient', 'volatile', 'strictfp', 'native', 'default']);

const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>=']);
const BINARY_PREC = [
  ['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>=', 'instanceof'],
  ['<<', '>>', '>>>'], ['+', '-'], ['*', '/', '%'],
];

class Backtrack extends Error {}

export function parse(src) {
  return new Parser(tokenize(src)).parseCompilationUnit();
}

export function parseType(src) {
  const p = new Parser(tokenize(src));
  return p.type();
}

export class Parser {
  constructor(tokens) {
    this.t = tokens;
    this.p = 0;
  }

  get tok() { return this.t[this.p]; }
  peek(k = 1) { return this.t[Math.min(this.p + k, this.t.length - 1)]; }
  is(value, k = 0) {
    const t = this.peek(k);
    return (t.type === 'op' || t.type === 'kw') && t.value === value;
  }
  accept(value) {
    if (this.is(value)) { this.p++; return true; }
    return false;
  }
  fail(msg, tok = this.tok) {
    throw new JavaSyntaxError(msg, tok.line, tok.col);
  }
  expect(value) {
    if (!this.is(value)) {
      // Splitting of '>>' style tokens when closing generics.
      if (value === '>' && this.tok.type === 'op' && /^>>/.test(this.tok.value)) {
        const t = this.tok;
        this.t.splice(this.p, 1, { ...t, value: '>' }, { ...t, value: t.value.slice(1), col: t.col + 1 });
        this.p++;
        return t;
      }
      const shown = this.tok.type === 'eof' ? 'end of file' : `'${this.tok.value}'`;
      this.fail(`'${value}' expected but found ${shown}`);
    }
    return this.t[this.p++];
  }
  ident() {
    const t = this.tok;
    if (t.type !== 'id') {
      const shown = t.type === 'eof' ? 'end of file' : `'${t.value}'`;
      this.fail(`<identifier> expected but found ${shown}`);
    }
    this.p++;
    return t.value;
  }

  // ---------- declarations ----------
  parseCompilationUnit() {
    const classes = [];
    const statements = [];
    if (this.accept('package')) { this.qualifiedName(); this.expect(';'); }
    while (this.is('import')) {
      this.p++;
      this.accept('static');
      this.ident();
      while (this.accept('.')) {
        if (this.accept('*')) break;
        this.ident();
      }
      this.expect(';');
    }
    while (this.tok.type !== 'eof') {
      if (this.accept(';')) continue;
      const save = this.p;
      const mods = this.modifiers();
      if (this.is('class') || this.is('interface') || this.is('enum') || (this.tok.type === 'id' && this.tok.value === 'record')) {
        classes.push(this.classDecl(mods));
      } else {
        // Loose statements / methods (snippet mode).
        this.p = save;
        if (this.looksLikeMethod()) {
          const m = this.modifiers();
          statements.push({ k: 'loosemethod', decl: this.member(m, '__Snippet') });
        } else {
          statements.push(this.statement());
        }
      }
    }
    return { classes, statements };
  }

  looksLikeMethod() {
    const save = this.p;
    try {
      this.modifiers();
      if (this.is('<')) this.typeParams();
      this.type();
      if (this.tok.type !== 'id') return false;
      this.p++;
      return this.is('(');
    } catch (e) {
      return false;
    } finally {
      this.p = save;
    }
  }

  qualifiedName() {
    let name = this.ident();
    while (this.is('.') && this.peek().type === 'id') { this.p++; name += '.' + this.ident(); }
    return name;
  }

  modifiers() {
    const mods = new Set();
    for (;;) {
      if (this.is('@') && this.peek().type === 'id' && this.peek().value !== 'interface') {
        this.p += 2;
        while (this.accept('.')) this.ident();
        if (this.is('(')) this.skipParens();
        continue;
      }
      if ((this.tok.type === 'kw') && MODIFIERS.has(this.tok.value)) {
        // 'default' is only a modifier inside interfaces before a method
        if (this.tok.value === 'default' && (this.is(':', 1) || this.is('->', 1))) break;
        mods.add(this.tok.value);
        this.p++;
        continue;
      }
      if (this.tok.type === 'id' && (this.tok.value === 'sealed' || this.tok.value === 'non') && this.peek().type !== 'op') {
        this.p++;
        continue;
      }
      break;
    }
    return mods;
  }

  skipParens() {
    let depth = 0;
    do {
      if (this.is('(')) depth++;
      else if (this.is(')')) depth--;
      this.p++;
    } while (depth > 0 && this.tok.type !== 'eof');
  }

  typeParams() {
    this.expect('<');
    const names = [];
    do {
      names.push(this.ident());
      if (this.accept('extends')) {
        this.type();
        while (this.accept('&')) this.type();
      }
    } while (this.accept(','));
    this.expect('>');
    return names;
  }

  classDecl(mods) {
    const line = this.tok.line;
    let kind = this.tok.value;
    this.p++;
    const name = this.ident();
    const decl = {
      kind, name, line, superclass: null, interfaces: [], fields: [], methods: [], ctors: [],
      inner: [], staticInits: [], instanceInits: [], enumConstants: [],
      isStatic: mods.has('static'), isAbstract: mods.has('abstract') || kind === 'interface',
      typeParams: [],
    };
    if (this.is('<')) decl.typeParams = this.typeParams();
    if (kind === 'record') {
      this.expect('(');
      decl.recordComponents = [];
      if (!this.is(')')) {
        do {
          this.modifiers();
          const type = this.type();
          const fname = this.ident();
          decl.recordComponents.push({ name: fname, type });
          decl.fields.push({ name: fname, type, init: null, isStatic: false, isFinal: true, line });
        } while (this.accept(','));
      }
      this.expect(')');
    }
    if (this.accept('extends')) {
      if (kind === 'interface') {
        decl.interfaces.push(this.type());
        while (this.accept(',')) decl.interfaces.push(this.type());
      } else decl.superclass = this.type();
    }
    if (this.accept('implements')) {
      do decl.interfaces.push(this.type()); while (this.accept(','));
    }
    if (this.tok.type === 'id' && this.tok.value === 'permits') {
      this.p++;
      do this.type(); while (this.accept(','));
    }
    this.classBody(decl);
    return decl;
  }

  classBody(decl) {
    this.expect('{');
    if (decl.kind === 'enum') {
      while (this.tok.type === 'id') {
        const cline = this.tok.line;
        const cname = this.ident();
        let args = [];
        if (this.is('(')) args = this.args();
        let body = null;
        if (this.is('{')) {
          body = { kind: 'class', name: decl.name + '$' + cname, superclass: { base: decl.name, args: [], dims: 0 }, interfaces: [], fields: [], methods: [], ctors: [], inner: [], staticInits: [], instanceInits: [], enumConstants: [], typeParams: [] };
          this.classBody(body);
        }
        decl.enumConstants.push({ name: cname, args, body, line: cline });
        if (!this.accept(',')) break;
      }
      this.accept(';');
    }
    while (!this.accept('}')) {
      if (this.tok.type === 'eof') this.fail("reached end of file while parsing - missing '}'");
      if (this.accept(';')) continue;
      if (this.is('{')) { decl.instanceInits.push(this.block()); continue; }
      if (this.is('static') && this.is('{', 1)) { this.p++; decl.staticInits.push(this.block()); continue; }
      const mods = this.modifiers();
      if (this.is('class') || this.is('interface') || this.is('enum') || (this.tok.type === 'id' && this.tok.value === 'record' && this.peek().type === 'id')) {
        const inner = this.classDecl(mods);
        decl.inner.push(inner);
        continue;
      }
      const m = this.member(mods, decl.name, decl);
      if (m.kind === 'ctor') decl.ctors.push(m);
      else if (m.kind === 'method') decl.methods.push(m);
      else decl.fields.push(...m.fields);
    }
  }

  member(mods, className, decl = null) {
    const line = this.tok.line;
    let typeParams = [];
    if (this.is('<')) typeParams = this.typeParams();
    // constructor
    if (this.tok.type === 'id' && this.tok.value === className && this.is('(', 1)) {
      this.p++;
      const params = this.params();
      this.throwsClause();
      const body = this.block();
      return { kind: 'ctor', name: '<init>', params, body, line, isStatic: false };
    }
    // compact record constructor
    if (decl && decl.kind === 'record' && this.tok.type === 'id' && this.tok.value === className && this.is('{', 1)) {
      this.p++;
      const body = this.block();
      return { kind: 'ctor', name: '<init>', compact: true, params: decl.recordComponents.map((c) => ({ ...c })), body, line, isStatic: false };
    }
    const type = this.type();
    const name = this.ident();
    if (this.is('(')) {
      const params = this.params();
      let dims = 0;
      while (this.accept('[')) { this.expect(']'); dims++; }
      this.throwsClause();
      let body = null;
      if (this.is('{')) body = this.block();
      else if (this.accept('default')) { this.expr(); this.expect(';'); }
      else this.expect(';');
      const isInterface = decl && decl.kind === 'interface';
      return {
        kind: 'method', name, params, returnType: dims ? { ...type, dims: type.dims + dims } : type, body, line,
        isStatic: mods.has('static'), isAbstract: !body, isPrivate: mods.has('private'), typeParams,
        isDefault: isInterface && mods.has('default'),
      };
    }
    // field(s)
    const fields = [];
    let first = true;
    let fname = name;
    for (;;) {
      if (!first) fname = this.ident();
      first = false;
      let ftype = type;
      let dims = 0;
      while (this.accept('[')) { this.expect(']'); dims++; }
      if (dims) ftype = { ...type, dims: type.dims + dims };
      let init = null;
      if (this.accept('=')) init = this.is('{') ? this.arrayInit() : this.expr();
      const isInterface = decl && decl.kind === 'interface';
      fields.push({ name: fname, type: ftype, init, isStatic: mods.has('static') || isInterface, isFinal: mods.has('final'), line });
      if (!this.accept(',')) break;
    }
    this.expect(';');
    return { kind: 'fields', fields };
  }

  throwsClause() {
    if (this.accept('throws')) {
      do this.type(); while (this.accept(','));
    }
  }

  params() {
    this.expect('(');
    const params = [];
    if (!this.is(')')) {
      do {
        this.modifiers();
        let type = this.type();
        let varargs = false;
        if (this.accept('...')) { varargs = true; type = { ...type, dims: type.dims + 1 }; }
        const name = this.ident();
        let dims = 0;
        while (this.accept('[')) { this.expect(']'); dims++; }
        if (dims) type = { ...type, dims: type.dims + dims };
        params.push({ name, type, varargs });
      } while (this.accept(','));
    }
    this.expect(')');
    return params;
  }

  type() {
    const t = this.tok;
    let base;
    let args = [];
    if (t.type === 'kw' && PRIMITIVES.has(t.value)) {
      base = t.value;
      this.p++;
    } else if (t.type === 'id') {
      base = this.ident();
      if (this.is('<')) args = this.typeArgs();
      while (this.is('.') && this.peek().type === 'id') {
        this.p++;
        // Map.Entry -> keep the last segment ("Entry"), but remember the full name
        const seg = this.ident();
        base = base + '.' + seg;
        if (this.is('<')) args = this.typeArgs();
      }
      // java.util.List -> List
      if (/^(java|javax)\./.test(base)) base = base.split('.').pop();
    } else {
      this.fail(`<identifier> expected but found '${t.value}'`);
    }
    let dims = 0;
    while (this.is('[') && this.is(']', 1)) { this.p += 2; dims++; }
    return { base, args, dims };
  }

  typeArgs() {
    this.expect('<');
    const args = [];
    if (this.is('>')) { this.p++; return args; } // diamond
    do {
      if (this.accept('?')) {
        if (this.accept('extends') || this.accept('super')) args.push(this.type());
        else args.push({ base: 'Object', args: [], dims: 0 });
      } else {
        args.push(this.type());
      }
    } while (this.accept(','));
    this.expect('>');
    return args;
  }

  // ---------- statements ----------
  block() {
    const line = this.tok.line;
    this.expect('{');
    const body = [];
    while (!this.accept('}')) {
      if (this.tok.type === 'eof') this.fail("reached end of file while parsing - missing '}'");
      body.push(this.statement());
    }
    return { k: 'block', body, line };
  }

  tryLocalDecl() {
    const save = this.p;
    const t = this.tok;
    let mods = null;
    if (this.is('final') || this.is('@')) mods = this.modifiers();
    if (this.tok.type === 'kw' && PRIMITIVES.has(this.tok.value) && this.tok.value !== 'void') {
      return this.localDecl();
    }
    if (this.tok.type === 'id') {
      try {
        if (this.tok.value === 'var' && this.peek().type === 'id') {
          this.p++;
          this.p = save + (mods ? this.p - save - 1 : 0);
          this.p = save;
          if (mods) this.modifiers();
          return this.localDecl();
        }
        const before = this.p;
        this.type();
        if (this.tok.type === 'id') {
          const nx = this.peek();
          if (nx.type === 'op' && ['=', ';', ',', '[', ':'].includes(nx.value)) {
            this.p = before;
            return this.localDecl();
          }
        }
      } catch (e) {
        if (!(e instanceof JavaSyntaxError)) throw e;
      }
    }
    if ((this.tok.type === 'kw' && (this.tok.value === 'class' || this.tok.value === 'interface' || this.tok.value === 'enum')) ||
      (this.tok.type === 'id' && this.tok.value === 'record' && this.peek().type === 'id' && mods)) {
      return { k: 'localclass', decl: this.classDecl(mods || new Set()), line: t.line };
    }
    this.p = save;
    return null;
  }

  localDecl() {
    const line = this.tok.line;
    let type;
    if (this.tok.type === 'id' && this.tok.value === 'var') { this.p++; type = { base: 'var', args: [], dims: 0 }; }
    else type = this.type();
    const decls = [];
    do {
      const name = this.ident();
      let dims = 0;
      while (this.accept('[')) { this.expect(']'); dims++; }
      let init = null;
      if (this.accept('=')) init = this.is('{') ? this.arrayInit() : this.expr();
      decls.push({ name, dims, init });
    } while (this.accept(','));
    return { k: 'local', type, decls, line };
  }

  arrayInit() {
    const line = this.tok.line;
    this.expect('{');
    const elems = [];
    while (!this.is('}')) {
      elems.push(this.is('{') ? this.arrayInit() : this.expr());
      if (!this.accept(',')) break;
    }
    this.expect('}');
    return { k: 'arrayinit', elems, line };
  }

  statement() {
    const t = this.tok;
    const line = t.line;
    if (t.type === 'op' && t.value === '{') return this.block();
    if (t.type === 'op' && t.value === ';') { this.p++; return { k: 'empty', line }; }
    if (t.type === 'id' && this.is(':', 1)) {
      this.p += 2;
      return { k: 'labeled', label: t.value, body: this.statement(), line };
    }
    if (t.type === 'id' && t.value === 'yield' && !this.is('=', 1) && !this.is('(', 1) && !this.is('.', 1)) {
      this.p++;
      const expr = this.expr();
      this.expect(';');
      return { k: 'yield', expr, line };
    }
    if (t.type === 'kw') {
      switch (t.value) {
        case 'if': {
          this.p++;
          this.expect('(');
          const cond = this.expr();
          this.expect(')');
          const then = this.statement();
          let els = null;
          if (this.accept('else')) els = this.statement();
          return { k: 'if', cond, then, else: els, line };
        }
        case 'while': {
          this.p++;
          this.expect('(');
          const cond = this.expr();
          this.expect(')');
          return { k: 'while', cond, body: this.statement(), line };
        }
        case 'do': {
          this.p++;
          const body = this.statement();
          this.expect('while');
          this.expect('(');
          const cond = this.expr();
          this.expect(')');
          this.expect(';');
          return { k: 'do', body, cond, line };
        }
        case 'for': return this.forStatement();
        case 'return': {
          this.p++;
          let expr = null;
          if (!this.is(';')) expr = this.expr();
          this.expect(';');
          return { k: 'return', expr, line };
        }
        case 'break':
        case 'continue': {
          this.p++;
          let label = null;
          if (this.tok.type === 'id') label = this.ident();
          this.expect(';');
          return { k: t.value, label, line };
        }
        case 'throw': {
          this.p++;
          const expr = this.expr();
          this.expect(';');
          return { k: 'throw', expr, line };
        }
        case 'switch': {
          const sw = this.switchConstruct();
          return { ...sw, k: 'switch', line };
        }
        case 'try': return this.tryStatement();
        case 'assert': {
          this.p++;
          const cond = this.expr();
          let msg = null;
          if (this.accept(':')) msg = this.expr();
          this.expect(';');
          return { k: 'assert', cond, msg, line };
        }
        case 'synchronized': {
          this.p++;
          this.expect('(');
          this.expr();
          this.expect(')');
          return this.block();
        }
        default: break;
      }
    }
    const decl = this.tryLocalDecl();
    if (decl) {
      if (decl.k === 'local') this.expect(';');
      return decl;
    }
    const expr = this.expr();
    this.expect(';');
    return { k: 'expr', expr, line };
  }

  forStatement() {
    const line = this.tok.line;
    this.expect('for');
    this.expect('(');
    // enhanced for?
    const save = this.p;
    try {
      this.modifiers();
      let type;
      if (this.tok.type === 'id' && this.tok.value === 'var' && this.peek().type === 'id') { this.p++; type = { base: 'var', args: [], dims: 0 }; }
      else type = this.type();
      const name = this.ident();
      if (this.accept(':')) {
        const iter = this.expr();
        this.expect(')');
        return { k: 'foreach', type, name, iter, body: this.statement(), line };
      }
    } catch (e) {
      if (!(e instanceof JavaSyntaxError)) throw e;
    }
    this.p = save;
    const init = [];
    if (!this.is(';')) {
      const decl = this.tryLocalDecl();
      if (decl) init.push(decl);
      else {
        do init.push({ k: 'expr', expr: this.expr(), line }); while (this.accept(','));
      }
    }
    this.expect(';');
    let cond = null;
    if (!this.is(';')) cond = this.expr();
    this.expect(';');
    const update = [];
    if (!this.is(')')) {
      do update.push(this.expr()); while (this.accept(','));
    }
    this.expect(')');
    return { k: 'for', init, cond, update, body: this.statement(), line };
  }

  tryStatement() {
    const line = this.tok.line;
    this.expect('try');
    const resources = [];
    if (this.accept('(')) {
      while (!this.accept(')')) {
        const d = this.tryLocalDecl();
        if (d) resources.push(d);
        else resources.push({ k: 'expr', expr: this.expr() });
        this.accept(';');
      }
    }
    const block = this.block();
    const catches = [];
    while (this.accept('catch')) {
      this.expect('(');
      this.modifiers();
      const types = [this.type().base];
      while (this.accept('|')) types.push(this.type().base);
      const name = this.ident();
      this.expect(')');
      catches.push({ types, name, body: this.block() });
    }
    let fin = null;
    if (this.accept('finally')) fin = this.block();
    if (!catches.length && !fin && !resources.length) this.fail("'catch' or 'finally' expected");
    return { k: 'try', resources, block, catches, fin, line };
  }

  switchConstruct() {
    this.expect('switch');
    this.expect('(');
    const disc = this.expr();
    this.expect(')');
    this.expect('{');
    const cases = [];
    let arrow = false;
    while (!this.accept('}')) {
      const cline = this.tok.line;
      let labels;
      if (this.accept('default')) labels = null;
      else {
        this.expect('case');
        labels = [];
        do {
          if (this.is('null')) { this.p++; labels.push({ k: 'lit', value: null, jt: 'null' }); }
          else labels.push(this.ternary());
        } while (this.accept(','));
      }
      if (this.accept('->')) {
        arrow = true;
        let body;
        if (this.is('{')) body = [this.block()];
        else if (this.is('throw')) body = [this.statement()];
        else {
          const e = this.expr();
          this.expect(';');
          body = [{ k: 'arrowexpr', expr: e, line: cline }];
        }
        cases.push({ labels, body, arrow: true, line: cline });
      } else {
        this.expect(':');
        const body = [];
        while (!this.is('case') && !this.is('default') && !this.is('}')) {
          if (this.tok.type === 'eof') this.fail("reached end of file while parsing - missing '}'");
          body.push(this.statement());
        }
        // `default:` immediately followed by `case` etc.
        cases.push({ labels, body, arrow: false, line: cline });
      }
    }
    return { disc, cases, arrow };
  }

  // ---------- expressions ----------
  expr() {
    return this.assignment();
  }

  assignment() {
    if (this.isLambdaStart()) return this.lambda();
    const left = this.ternary();
    const t = this.tok;
    if (t.type === 'op' && ASSIGN_OPS.has(t.value)) {
      if (!['name', 'field', 'index'].includes(left.k)) this.fail('unexpected type: required variable, found value', t);
      this.p++;
      const value = this.is('{') ? this.arrayInit() : this.assignment();
      return { k: 'assign', op: t.value, target: left, value, line: t.line };
    }
    return left;
  }

  isLambdaStart() {
    const t = this.tok;
    if (t.type === 'id' && this.is('->', 1)) return true;
    if (!this.is('(')) return false;
    let depth = 0, j = this.p;
    for (; j < this.t.length; j++) {
      const x = this.t[j];
      if (x.type === 'op' && x.value === '(') depth++;
      else if (x.type === 'op' && x.value === ')') { depth--; if (depth === 0) break; }
      else if (x.type === 'eof') return false;
    }
    const after = this.t[j + 1];
    return after && after.type === 'op' && after.value === '->';
  }

  lambda() {
    const line = this.tok.line;
    const params = [];
    if (this.tok.type === 'id') params.push(this.ident());
    else {
      this.expect('(');
      if (!this.is(')')) {
        do {
          this.modifiers();
          if ((this.tok.type === 'id' || this.tok.type === 'kw') && (this.is(',', 1) || this.is(')', 1))) params.push(this.ident());
          else {
            if (this.tok.type === 'id' && this.tok.value === 'var') this.p++;
            else this.type();
            params.push(this.ident());
          }
        } while (this.accept(','));
      }
      this.expect(')');
    }
    this.expect('->');
    const body = this.is('{') ? this.block() : this.expr();
    return { k: 'lambda', params, body, line };
  }

  ternary() {
    const cond = this.binary(0);
    if (this.is('?')) {
      const line = this.tok.line;
      this.p++;
      const a = this.isLambdaStart() ? this.lambda() : this.ternary();
      this.expect(':');
      const b = this.isLambdaStart() ? this.lambda() : this.ternary();
      return { k: 'cond', cond, a, b, line };
    }
    return cond;
  }

  binary(level) {
    if (level >= BINARY_PREC.length) return this.unary();
    let left = this.binary(level + 1);
    for (;;) {
      const t = this.tok;
      if ((t.type === 'op' || t.type === 'kw') && BINARY_PREC[level].includes(t.value)) {
        this.p++;
        if (t.value === 'instanceof') {
          const final = this.accept('final');
          const type = this.type();
          let bind = null;
          if (this.tok.type === 'id') bind = this.ident();
          void final;
          left = { k: 'instanceof', expr: left, type, bind, line: t.line };
          continue;
        }
        const right = this.binary(level + 1);
        left = { k: 'binary', op: t.value, left, right, line: t.line };
      } else break;
    }
    return left;
  }

  unary() {
    const t = this.tok;
    if (t.type === 'op') {
      if (t.value === '++' || t.value === '--') {
        this.p++;
        const expr = this.unary();
        return { k: 'preinc', op: t.value, expr, line: t.line };
      }
      if (t.value === '+' || t.value === '-' || t.value === '!' || t.value === '~') {
        this.p++;
        // fold negative literals so that -2147483648 works
        if (t.value === '-' && this.tok.type === 'num') {
          const nt = this.tok;
          if (!(this.is('.', 1) || this.is('[', 1))) {
            this.p++;
            const lit = this.literalOf(nt);
            lit.value = nt.kind === 'long' ? BigInt.asIntN(64, -nt.value) : (nt.kind === 'int' ? (-nt.value) | 0 : -nt.value);
            return this.postfix(lit);
          }
        }
        const expr = this.unary();
        return { k: 'unary', op: t.value, expr, line: t.line };
      }
      if (t.value === '(') {
        const cast = this.tryCast();
        if (cast) return cast;
      }
    }
    return this.postfix(this.primary());
  }

  tryCast() {
    const save = this.p;
    const line = this.tok.line;
    this.p++;
    const t = this.tok;
    if (t.type === 'kw' && PRIMITIVES.has(t.value)) {
      const type = this.type();
      if (this.accept(')')) {
        const expr = this.unary();
        return { k: 'cast', type, expr, line };
      }
      this.p = save;
      return null;
    }
    if (t.type === 'id') {
      try {
        const type = this.type();
        while (this.accept('&')) this.type();
        if (this.accept(')')) {
          const n = this.tok;
          const startsOperand = n.type === 'id' || n.type === 'num' || n.type === 'str' || n.type === 'char' ||
            (n.type === 'kw' && ['this', 'new', 'super', 'true', 'false', 'null', 'switch'].includes(n.value)) ||
            (n.type === 'op' && ['(', '!', '~'].includes(n.value));
          if (startsOperand && /^[A-Z]/.test(type.base.split('.').pop())) {
            const expr = this.isLambdaStart() ? this.lambda() : this.unary();
            return { k: 'cast', type, expr, line };
          }
        }
      } catch (e) {
        if (!(e instanceof JavaSyntaxError)) throw e;
      }
    }
    this.p = save;
    return null;
  }

  literalOf(t) {
    if (t.type === 'num') return { k: 'lit', value: t.value, jt: t.kind, line: t.line };
    if (t.type === 'str') return { k: 'lit', value: t.value, jt: 'String', line: t.line };
    if (t.type === 'char') return { k: 'lit', value: t.value, jt: 'char', line: t.line };
    return null;
  }

  args() {
    this.expect('(');
    const args = [];
    if (!this.is(')')) {
      do args.push(this.expr()); while (this.accept(','));
    }
    this.expect(')');
    return args;
  }

  primary() {
    const t = this.tok;
    const line = t.line;
    if (t.type === 'num' || t.type === 'str' || t.type === 'char') {
      this.p++;
      return this.literalOf(t);
    }
    if (t.type === 'kw') {
      switch (t.value) {
        case 'true': this.p++; return { k: 'lit', value: true, jt: 'boolean', line };
        case 'false': this.p++; return { k: 'lit', value: false, jt: 'boolean', line };
        case 'null': this.p++; return { k: 'lit', value: null, jt: 'null', line };
        case 'this':
          this.p++;
          if (this.is('(')) return { k: 'ctorcall', which: 'this', args: this.args(), line };
          return { k: 'this', line };
        case 'super':
          this.p++;
          if (this.is('(')) return { k: 'ctorcall', which: 'super', args: this.args(), line };
          if (this.accept('::')) return { k: 'methodref', target: { k: 'super', line }, name: this.ident(), line };
          this.expect('.');
          {
            const name = this.ident();
            if (this.is('(')) return { k: 'call', target: { k: 'super', line }, name, args: this.args(), line };
            return { k: 'field', target: { k: 'this', line }, name, line };
          }
        case 'new': return this.newExpr();
        case 'switch': {
          const sw = this.switchConstruct();
          return { ...sw, k: 'switchexpr', line };
        }
        default:
          if (PRIMITIVES.has(t.value)) {
            // int[]::new or int.class
            const type = this.type();
            if (this.accept('::')) { this.expect('new'); return { k: 'methodref', target: { k: 'typeref', type }, name: 'new', line }; }
            if (this.accept('.')) { this.ident(); return { k: 'lit', value: type.base, jt: 'String', line }; }
          }
          this.fail(`illegal start of expression: '${t.value}'`);
      }
    }
    if (t.type === 'op' && t.value === '(') {
      this.p++;
      const e = this.expr();
      this.expect(')');
      return { k: 'paren', expr: e, line };
    }
    if (t.type === 'id') {
      // Generic type method ref: List<String>::size  / array ctor ref: int[]::new
      if (this.is('[', 1) && this.is(']', 2)) {
        const type = this.type();
        this.expect('::');
        this.expect('new');
        return { k: 'methodref', target: { k: 'typeref', type }, name: 'new', line };
      }
      this.p++;
      if (this.is('(')) return { k: 'call', target: null, name: t.value, args: this.args(), line };
      return { k: 'name', name: t.value, line };
    }
    if (t.type === 'eof') this.fail('reached end of file while parsing');
    this.fail(`illegal start of expression: '${t.value}'`);
  }

  newExpr() {
    const line = this.tok.line;
    this.expect('new');
    const t = this.tok;
    let base;
    let targs = [];
    if (t.type === 'kw' && PRIMITIVES.has(t.value)) { base = t.value; this.p++; }
    else {
      base = this.ident();
      if (this.is('<')) targs = this.typeArgs();
      while (this.accept('.')) { base += '.' + this.ident(); if (this.is('<')) targs = this.typeArgs(); }
      if (/^(java|javax)\./.test(base)) base = base.split('.').pop();
    }
    if (this.is('[')) {
      const dims = [];
      let total = 0;
      while (this.is('[')) {
        this.p++;
        if (this.is(']')) { this.p++; dims.push(null); total++; continue; }
        dims.push(this.expr());
        this.expect(']');
        total++;
      }
      let init = null;
      if (this.is('{')) init = this.arrayInit();
      return { k: 'newarray', type: { base, args: targs, dims: total }, dims, init, line };
    }
    const args = this.args();
    let body = null;
    if (this.is('{')) {
      body = { kind: 'class', name: '', superclass: { base, args: targs, dims: 0 }, interfaces: [], fields: [], methods: [], ctors: [], inner: [], staticInits: [], instanceInits: [], enumConstants: [], typeParams: [], anonymous: true };
      this.classBody(body);
    }
    return { k: 'new', type: { base, args: targs, dims: 0 }, args, body, line };
  }

  postfix(expr) {
    for (;;) {
      const t = this.tok;
      if (t.type !== 'op') break;
      if (t.value === '.') {
        this.p++;
        if (this.is('<')) this.typeArgs(); // explicit generic method call
        if (this.accept('new')) { // inner class creation outer.new Inner()
          const n = this.newExprAfterNew(line(t));
          expr = n;
          continue;
        }
        if (this.is('class')) { this.p++; expr = { k: 'classlit', target: expr, line: t.line }; continue; }
        if (this.is('this')) { this.p++; expr = { k: 'this', line: t.line }; continue; }
        const name = this.ident();
        if (this.is('(')) expr = { k: 'call', target: expr, name, args: this.args(), line: t.line };
        else expr = { k: 'field', target: expr, name, line: t.line };
      } else if (t.value === '[') {
        this.p++;
        const index = this.expr();
        this.expect(']');
        expr = { k: 'index', target: expr, index, line: t.line };
      } else if (t.value === '++' || t.value === '--') {
        this.p++;
        expr = { k: 'postinc', op: t.value, expr, line: t.line };
      } else if (t.value === '::') {
        this.p++;
        const name = this.accept('new') ? 'new' : this.ident();
        expr = { k: 'methodref', target: expr, name, line: t.line };
      } else if (t.value === '<' && expr.k === 'name' && /^[A-Z]/.test(expr.name) && this.genericMethodRefAhead()) {
        this.typeArgs();
      } else break;
    }
    return expr;

    function line(tok) { return tok.line; }
  }

  genericMethodRefAhead() {
    const save = this.p;
    try {
      this.typeArgs();
      return this.is('::');
    } catch (e) {
      return false;
    } finally {
      this.p = save;
    }
  }

  newExprAfterNew(lineNo) {
    const base = this.ident();
    if (this.is('<')) this.typeArgs();
    const args = this.args();
    return { k: 'new', type: { base, args: [], dims: 0 }, args, body: null, line: lineNo };
  }
}

export function typeToString(t) {
  if (!t) return '?';
  let s = t.base;
  if (t.args && t.args.length) s += '<' + t.args.map(typeToString).join(', ') + '>';
  return s + '[]'.repeat(t.dims || 0);
}

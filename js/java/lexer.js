// Tokenizer for the Java subset understood by the in-browser runner.

export class JavaSyntaxError extends Error {
  constructor(message, line, col) {
    super(message);
    this.line = line;
    this.col = col;
  }
}

const KEYWORDS = new Set([
  'abstract', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'continue',
  'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for',
  'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'new', 'package',
  'private', 'protected', 'public', 'return', 'short', 'static', 'super', 'switch', 'this',
  'throw', 'throws', 'try', 'void', 'while', 'true', 'false', 'null', 'synchronized',
  'transient', 'volatile', 'strictfp', 'native', 'assert',
]);

// Longest operators first so the scanner can match greedily.
const OPERATORS = [
  '>>>=', '<<=', '>>=', '>>>', '...', '->', '::', '++', '--', '&&', '||', '==', '!=', '<=', '>=',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '~', '?', ':', ';', ',', '.', '(', ')', '[', ']',
  '{', '}', '&', '|', '^', '@',
];

const ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', s: ' ', '0': '\0', '\\': '\\', "'": "'", '"': '"' };

export function tokenize(src) {
  const tokens = [];
  let i = 0, line = 1, col = 1;
  const n = src.length;

  function advance(k) {
    for (let j = 0; j < k; j++) {
      if (src[i] === '\n') { line++; col = 1; } else col++;
      i++;
    }
  }
  function readEscape() {
    // assumes src[i] === '\\'
    const c = src[i + 1];
    if (c === 'u') {
      const hex = src.slice(i + 2, i + 6);
      advance(6);
      return String.fromCharCode(parseInt(hex, 16));
    }
    if (c >= '0' && c <= '7') {
      let j = i + 1, s = '';
      while (j < n && s.length < 3 && src[j] >= '0' && src[j] <= '7') s += src[j++];
      advance(1 + s.length);
      return String.fromCharCode(parseInt(s, 8));
    }
    if (!(c in ESCAPES)) throw new JavaSyntaxError(`illegal escape character '\\${c}'`, line, col);
    advance(2);
    return ESCAPES[c];
  }

  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { advance(1); continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') advance(1);
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const sl = line, sc = col;
      advance(2);
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) advance(1);
      if (i >= n) throw new JavaSyntaxError('unclosed comment', sl, sc);
      advance(2);
      continue;
    }
    const tl = line, tc = col;
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      advance(j - i);
      tokens.push({ type: KEYWORDS.has(word) ? 'kw' : 'id', value: word, line: tl, col: tc });
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      let kind = 'int';
      let text;
      if (c === '0' && /[xX]/.test(src[i + 1])) {
        j += 2;
        while (j < n && /[0-9a-fA-F_]/.test(src[j])) j++;
        text = src.slice(i, j).replace(/_/g, '');
        let value = BigInt(text);
        if (/[lL]/.test(src[j] || '')) { j++; kind = 'long'; }
        advance(j - i);
        tokens.push({ type: 'num', kind, value: kind === 'long' ? BigInt.asIntN(64, value) : Number(BigInt.asIntN(32, value)), line: tl, col: tc });
        continue;
      }
      if (c === '0' && /[bB]/.test(src[i + 1])) {
        j += 2;
        while (j < n && /[01_]/.test(src[j])) j++;
        text = src.slice(i, j).replace(/_/g, '');
        let value = BigInt(text);
        if (/[lL]/.test(src[j] || '')) { j++; kind = 'long'; }
        advance(j - i);
        tokens.push({ type: 'num', kind, value: kind === 'long' ? BigInt.asIntN(64, value) : Number(BigInt.asIntN(32, value)), line: tl, col: tc });
        continue;
      }
      while (j < n && /[0-9_]/.test(src[j])) j++;
      if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) {
        kind = 'double'; j++;
        while (j < n && /[0-9_]/.test(src[j])) j++;
      } else if (src[j] === '.' && !/[A-Za-z_]/.test(src[j + 1] || '')) {
        kind = 'double'; j++;
      }
      if (/[eE]/.test(src[j] || '')) {
        kind = 'double'; j++;
        if (/[+-]/.test(src[j])) j++;
        while (j < n && /[0-9]/.test(src[j])) j++;
      }
      text = src.slice(i, j).replace(/_/g, '');
      if (/[lL]/.test(src[j] || '')) { kind = 'long'; j++; }
      else if (/[dD]/.test(src[j] || '')) { kind = 'double'; j++; }
      else if (/[fF]/.test(src[j] || '')) { kind = 'float'; j++; }
      advance(j - i);
      let value;
      if (kind === 'int') {
        const big = BigInt(text);
        if (big > 2147483648n) throw new JavaSyntaxError('integer number too large: ' + text, tl, tc);
        value = Number(big);
      } else if (kind === 'long') value = BigInt.asIntN(64, BigInt(text));
      else value = parseFloat(text);
      tokens.push({ type: 'num', kind, value, line: tl, col: tc });
      continue;
    }
    if (c === '"') {
      if (src.startsWith('"""', i)) {
        // text block
        advance(3);
        while (i < n && src[i] !== '\n') advance(1);
        advance(1);
        let raw = '';
        while (i < n && !src.startsWith('"""', i)) {
          if (src[i] === '\\') raw += readEscape();
          else { raw += src[i]; advance(1); }
        }
        advance(3);
        const lines = raw.split('\n');
        const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
        const lastLine = lines[lines.length - 1];
        if (!lastLine.trim()) indents.push(lastLine.length);
        const strip = indents.length ? Math.min(...indents) : 0;
        const value = lines.map((l) => l.slice(strip).replace(/\s+$/, '')).join('\n');
        tokens.push({ type: 'str', value, line: tl, col: tc });
        continue;
      }
      advance(1);
      let s = '';
      while (i < n && src[i] !== '"') {
        if (src[i] === '\n') throw new JavaSyntaxError('unclosed string literal', tl, tc);
        if (src[i] === '\\') s += readEscape();
        else { s += src[i]; advance(1); }
      }
      if (i >= n) throw new JavaSyntaxError('unclosed string literal', tl, tc);
      advance(1);
      tokens.push({ type: 'str', value: s, line: tl, col: tc });
      continue;
    }
    if (c === "'") {
      advance(1);
      let ch;
      if (src[i] === '\\') ch = readEscape();
      else { ch = src[i]; advance(1); }
      if (src[i] !== "'") throw new JavaSyntaxError('unclosed character literal', tl, tc);
      advance(1);
      tokens.push({ type: 'char', value: ch.charCodeAt(0), line: tl, col: tc });
      continue;
    }
    let op = null;
    for (const o of OPERATORS) {
      if (src.startsWith(o, i)) { op = o; break; }
    }
    if (!op) throw new JavaSyntaxError(`illegal character '${c}'`, tl, tc);
    advance(op.length);
    tokens.push({ type: 'op', value: op, line: tl, col: tc });
  }
  tokens.push({ type: 'eof', value: '<end of file>', line, col });
  return tokens;
}

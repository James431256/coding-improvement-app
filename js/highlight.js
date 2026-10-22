// Tiny Java syntax highlighter producing HTML spans.
const KW = new Set(('abstract assert boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var record yield').split(' '));
const LIT = new Set(['true', 'false', 'null']);

export function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?)|('(?:[^'\\\n]|\\.)*'?)|(@\w+)|(\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?[lLfFdD]?\b|\b0[xX][\da-fA-F_]+\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\s\w])/g;

export function highlight(code) {
  let out = '';
  let m;
  TOKEN.lastIndex = 0;
  let prevWord = '';
  while ((m = TOKEN.exec(code)) !== null) {
    const [tok, comment, string, chr, annot, num, word] = m;
    if (comment) out += `<span class="t-com">${esc(tok)}</span>`;
    else if (string || chr) out += `<span class="t-str">${esc(tok)}</span>`;
    else if (annot) out += `<span class="t-ann">${esc(tok)}</span>`;
    else if (num) out += `<span class="t-num">${esc(tok)}</span>`;
    else if (word) {
      if (KW.has(word)) out += `<span class="t-kw">${word}</span>`;
      else if (LIT.has(word)) out += `<span class="t-lit">${word}</span>`;
      else if (/^[A-Z]/.test(word)) out += `<span class="t-type">${word}</span>`;
      else if (code[TOKEN.lastIndex] === '(' && prevWord !== 'new') out += `<span class="t-fn">${word}</span>`;
      else out += word;
      prevWord = word;
      continue;
    } else out += esc(tok);
    if (!/^\s+$/.test(tok)) prevWord = '';
  }
  return out;
}

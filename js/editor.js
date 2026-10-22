// Lightweight code editor: a <textarea> layered over a highlighted <pre>.
import { highlight } from './highlight.js';

const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
const CLOSERS = new Set([')', ']', '}', '"', "'"]);
const INDENT = '    ';
const KEYS = ['Tab', '{', '}', '(', ')', '[', ']', ';', '=', '<', '>', '"', "'", '+', '-', '*', '/', '%', '!', '&', '|', '.', ','];

export function isTouch() {
  return window.matchMedia('(pointer: coarse)').matches;
}

export function createEditor(host, { value = '', onChange, onRun, minLines = 8, label = 'Code editor' } = {}) {
  host.classList.add('editor');
  host.innerHTML = `
    <div class="ed-body">
      <div class="ed-gutter" aria-hidden="true"></div>
      <div class="ed-scroll">
        <pre class="ed-hl" aria-hidden="true"><code></code></pre>
        <textarea class="ed-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="${label}"></textarea>
      </div>
    </div>
    <div class="ed-keys" role="toolbar" aria-label="Symbol keys">${KEYS.map((k) => `<button type="button" tabindex="-1" data-k="${k === '"' ? '&quot;' : k}">${k === 'Tab' ? '⇥' : k.replace('<', '&lt;').replace('>', '&gt;')}</button>`).join('')}</div>`;
  const ta = host.querySelector('textarea');
  const hl = host.querySelector('.ed-hl code');
  const gutter = host.querySelector('.ed-gutter');
  const scroll = host.querySelector('.ed-scroll');
  ta.value = value;

  function render() {
    const v = ta.value;
    hl.innerHTML = highlight(v) + '\n';
    const n = Math.max(minLines, v.split('\n').length);
    let g = '';
    for (let i = 1; i <= n; i++) g += `<span>${i}</span>`;
    gutter.innerHTML = g;
    ta.style.height = 'auto';
    const lines = Math.max(minLines, v.split('\n').length);
    ta.rows = lines;
  }

  function insert(text, selectOffset = null) {
    ta.focus();
    const ok = document.execCommand && document.execCommand('insertText', false, text);
    if (!ok) {
      const s = ta.selectionStart, e = ta.selectionEnd;
      ta.setRangeText(text, s, e, 'end');
      ta.dispatchEvent(new Event('input'));
    }
    if (selectOffset !== null) {
      const p = ta.selectionStart - text.length + selectOffset;
      ta.setSelectionRange(p, p);
    }
  }

  function lineStart(pos) { return ta.value.lastIndexOf('\n', pos - 1) + 1; }
  function currentIndent(pos) {
    const ls = lineStart(pos);
    return ta.value.slice(ls, pos).match(/^[ \t]*/)[0];
  }

  function indentSelection(dedent) {
    const v = ta.value;
    let s = ta.selectionStart, e = ta.selectionEnd;
    const ls = lineStart(s);
    if (e > s && v[e - 1] === '\n') e--;
    const le = v.indexOf('\n', e) === -1 ? v.length : v.indexOf('\n', e);
    const block = v.slice(ls, le);
    const changed = block.split('\n').map((l) => (dedent ? l.replace(/^ {1,4}|^\t/, '') : INDENT + l)).join('\n');
    ta.setSelectionRange(ls, le);
    insert(changed);
    ta.setSelectionRange(ls, ls + changed.length);
  }

  ta.addEventListener('keydown', (ev) => {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const v = ta.value;
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      ev.preventDefault();
      if (onRun) onRun();
      return;
    }
    if (ev.key === 'Escape') { ta.blur(); return; }
    if (ev.key === 'Tab') {
      ev.preventDefault();
      if (s !== e && v.slice(s, e).includes('\n')) indentSelection(ev.shiftKey);
      else if (ev.shiftKey) indentSelection(true);
      else insert(INDENT);
      return;
    }
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      const indent = currentIndent(s);
      const before = v.slice(lineStart(s), s).trimEnd();
      const opens = /[{([]$/.test(before);
      const next = v[e];
      if (opens && next && '})]'.includes(next)) {
        insert('\n' + indent + INDENT + '\n' + indent, 1 + indent.length + INDENT.length);
      } else {
        insert('\n' + indent + (opens ? INDENT : ''));
      }
      return;
    }
    if (ev.key === 'Backspace' && s === e && s > 0) {
      const prev = v[s - 1], next = v[s];
      if (PAIRS[prev] && PAIRS[prev] === next) {
        ev.preventDefault();
        ta.setSelectionRange(s - 1, s + 1);
        insert('');
        return;
      }
      const ls = lineStart(s);
      const head = v.slice(ls, s);
      if (/^ +$/.test(head) && head.length >= 4 && head.length % 4 === 0) {
        ev.preventDefault();
        ta.setSelectionRange(s - 4, s);
        insert('');
        return;
      }
    }
    if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      if (handleChar(ev.key)) ev.preventDefault();
    }
  });

  // returns true if handled
  function handleChar(ch) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const v = ta.value;
    const next = v[e] || '';
    if (CLOSERS.has(ch) && s === e && next === ch) {
      ta.setSelectionRange(s + 1, s + 1);
      return true;
    }
    if (ch === '}') {
      const ls = lineStart(s);
      const head = v.slice(ls, s);
      if (/^ +$/.test(head) && head.length >= 4) {
        ta.setSelectionRange(s - 4, s);
        insert('}');
        return true;
      }
    }
    if (PAIRS[ch]) {
      const prev = v[s - 1] || '';
      if ((ch === '"' || ch === "'") && /[\w\\]/.test(prev)) return false;
      if (s !== e) {
        const sel = v.slice(s, e);
        insert(ch + sel + PAIRS[ch]);
        return true;
      }
      if (/[\w]/.test(next)) return false;
      insert(ch + PAIRS[ch], 1);
      return true;
    }
    return false;
  }

  host.querySelector('.ed-keys').addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    ev.preventDefault();
    const k = b.dataset.k;
    ta.focus();
    if (k === 'Tab') insert(INDENT);
    else if (!handleChar(k)) insert(k);
  });

  ta.addEventListener('input', () => {
    render();
    if (onChange) onChange(ta.value);
  });
  ta.addEventListener('focus', () => host.classList.add('focused'));
  ta.addEventListener('blur', () => host.classList.remove('focused'));

  render();

  return {
    get value() { return ta.value; },
    set value(v) { ta.value = v; render(); },
    focus() { ta.focus(); },
    textarea: ta,
    markLine(line) {
      host.querySelectorAll('.ed-gutter span.err').forEach((x) => x.classList.remove('err'));
      if (!line) return;
      const span = gutter.children[line - 1];
      if (span) span.classList.add('err');
    },
    scroll,
  };
}

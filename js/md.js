// Minimal markdown for lesson notes and prompts:
// paragraphs, ```java blocks, `code`, **bold**, *italic*, - lists, 1. lists, > tips, ### headings, | tables |
import { highlight, esc } from './highlight.js';

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((#[^)]+)\)/g, '<a href="$2">$1</a>');
}

export function md(src) {
  const lines = src.replace(/^\n+|\s+$/g, '').split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^(```|~~~)/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^(```|~~~)/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html += `<pre class="code"><code>${highlight(buf.join('\n'))}</code></pre>`;
      continue;
    }
    if (/^#{2,4} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      html += `<h${level + 1} class="md-h">${inline(line.replace(/^#+ /, ''))}</h${level + 1}>`;
      i++;
      continue;
    }
    if (/^- /.test(line)) {
      html += '<ul>';
      while (i < lines.length && /^- /.test(lines[i])) {
        let item = lines[i].slice(2);
        i++;
        while (i < lines.length && /^ {2}\S/.test(lines[i])) item += ' ' + lines[i++].trim();
        html += `<li>${inline(item)}</li>`;
      }
      html += '</ul>';
      continue;
    }
    if (/^\d+\. /.test(line)) {
      html += '<ol>';
      while (i < lines.length && /^\d+\. /.test(lines[i])) html += `<li>${inline(lines[i++].replace(/^\d+\. /, ''))}</li>`;
      html += '</ol>';
      continue;
    }
    if (/^> /.test(line)) {
      const buf = [];
      while (i < lines.length && /^> ?/.test(lines[i])) buf.push(lines[i++].replace(/^> ?/, ''));
      const text = buf.join(' ');
      const m = text.match(/^(Tip|Watch out|Note|LeetCode|Remember):\s*/);
      const kind = m ? m[1].toLowerCase().replace(' ', '-') : 'note';
      html += `<aside class="callout callout-${kind}">${m ? `<b>${m[1]}</b> ` : ''}${inline(text.slice(m ? m[0].length : 0))}</aside>`;
      continue;
    }
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\|[\s:-]+\|/.test(r) || /[a-z0-9]/i.test(r.replace(/[\s|:-]/g, '')));
      html += '<div class="table-wrap"><table>';
      body.forEach((r, ri) => {
        const tag = ri === 0 ? 'th' : 'td';
        html += '<tr>' + cells(r).map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
      });
      html += '</table></div>';
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(```|~~~|- |\d+\. |> |#{2,4} |\|)/.test(lines[i])) buf.push(lines[i++]);
    html += `<p>${inline(buf.join(' '))}</p>`;
  }
  return html;
}

export function codeBlock(code, cls = '') {
  return `<pre class="code ${cls}"><code>${highlight(code)}</code></pre>`;
}

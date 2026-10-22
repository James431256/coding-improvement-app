// Shared rendering of a test run (used by problems and code questions).
import { esc, icon } from '../ui.js';
import { parseSignature, fmtValue } from '../java/runner.js';

function errorBox(err) {
  if (!err) return '';
  const title = { compile: 'Compile error', exception: 'Exception', timeout: 'Time limit exceeded', output: 'Output limit', internal: 'Runner error' }[err.kind] || 'Error';
  return `<div class="err-box err-${err.kind}"><div class="err-title">${title}${err.line ? ` <span class="err-line">line ${err.line}</span>` : ''}</div>
    <pre>${esc(err.message)}</pre>${err.note ? `<p class="err-note">${esc(err.note)}</p>` : ''}</div>`;
}
export { errorBox };

export function renderTestResults(res, spec, { compact = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'test-results';
  if (res.compileError) {
    wrap.innerHTML = errorBox(res.compileError);
    return wrap;
  }
  const sig = parseSignature(spec.signature);
  const allPass = res.passed === res.total;
  const firstFail = res.results.findIndex((r) => !r.pass);
  wrap.innerHTML = `
    <div class="tr-summary ${allPass ? 'pass' : 'fail'}">${icon(allPass ? 'check' : 'x')}
      <b>${res.passed}/${res.total}</b>&nbsp;tests passed
      <span class="tr-dots" aria-hidden="true">${res.results.map((r) => `<i class="${r.pass ? 'p' : 'f'}"></i>`).join('')}</span>
    </div>
    <div class="tr-list">
      ${res.results.map((r, i) => {
        const open = i === firstFail || (!compact && res.results.length <= 3);
        const input = sig.params.map((p, k) => `<span class="arg"><span class="arg-name">${esc(p.name)}</span> = ${esc(fmtValue(r.args[k]))}</span>`).join('');
        return `<details class="tr-case ${r.pass ? 'pass' : 'fail'}" ${open ? 'open' : ''}>
          <summary>${icon(r.pass ? 'check' : 'x')} Test ${i + 1}<span class="tr-ms">${r.ms != null ? r.ms + ' ms' : ''}</span></summary>
          <div class="tr-body">
            <div class="kv"><span class="k">Input</span><span class="v mono">${input}</span></div>
            <div class="kv"><span class="k">Expected</span><span class="v mono">${esc(fmtValue(r.expected))}</span></div>
            ${r.error ? '' : `<div class="kv"><span class="k">Your output</span><span class="v mono ${r.pass ? '' : 'bad'}">${esc(fmtValue(r.got))}</span></div>`}
            ${r.stdout ? `<div class="kv"><span class="k">Printed</span><pre class="v console small">${esc(r.stdout.slice(0, 2000))}</pre></div>` : ''}
            ${errorBox(r.error)}
          </div>
        </details>`;
      }).join('')}
    </div>`;
  return wrap;
}

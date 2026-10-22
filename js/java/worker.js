// Runs Java code off the main thread so infinite loops never freeze the page.
import { runProgram, runTests } from './runner.js';
import { findRunnable } from '../../content/registry.js';

self.onmessage = async (ev) => {
  const { id, kind, src, stdin, ref } = ev.data;
  let result;
  try {
    if (kind === 'run') result = runProgram(src, { stdin });
    else {
      const spec = await findRunnable(ref);
      result = runTests(src, spec);
    }
  } catch (e) {
    result = { error: { kind: 'internal', message: String(e && e.message || e) } };
  }
  self.postMessage({ id, result });
};

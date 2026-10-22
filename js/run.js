// Talks to the Java worker. Falls back to running on the main thread if module workers are unavailable.
let worker = null;
let seq = 0;
const pending = new Map();
let workerBroken = false;

function getWorker() {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./java/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const p = pending.get(ev.data.id);
      if (p) { pending.delete(ev.data.id); clearTimeout(p.timer); p.resolve(ev.data.result); }
    };
    worker.onerror = (ev) => {
      ev.preventDefault();
      workerBroken = true;
      for (const [, p] of pending) { clearTimeout(p.timer); p.retry(); }
      pending.clear();
      worker = null;
    };
  } catch (e) {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

async function runInline(msg) {
  const runner = await import('./java/runner.js');
  if (msg.kind === 'run') return runner.runProgram(msg.src, { stdin: msg.stdin });
  const { findRunnable } = await import('../content/registry.js');
  return runner.runTests(msg.src, await findRunnable(msg.ref));
}

function send(msg, timeoutMs = 15000) {
  const w = getWorker();
  if (!w) return runInline(msg);
  return new Promise((resolve) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      // Kill the stuck worker; a fresh one is created on the next run.
      w.terminate();
      if (worker === w) worker = null;
      for (const [, p] of pending) { clearTimeout(p.timer); p.resolve({ error: { kind: 'timeout', message: 'Stopped: took too long.' } }); }
      pending.clear();
      resolve(msg.kind === 'run'
        ? { stdout: '', error: { kind: 'timeout', message: 'Time limit exceeded - your code ran too long. Check for an infinite loop.' } }
        : { results: [], compileError: { kind: 'timeout', message: 'Time limit exceeded - your code ran too long. Check for an infinite loop.' }, passed: 0, total: 0 });
    }, timeoutMs);
    pending.set(id, { resolve, timer, retry: () => runInline(msg).then(resolve) });
    w.postMessage({ ...msg, id });
  });
}

export function runProgram(src, stdin = '') {
  return send({ kind: 'run', src, stdin });
}

export function runTests(src, ref) {
  return send({ kind: 'test', src, ref });
}

// Warm the worker up so the first run is quick.
export function warmUp() { getWorker(); }

// Runs every tests/java/*.java through real javac/java and through the in-browser interpreter, and diffs output.
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runProgram } from '../js/java/runner.js';

const dir = new URL('../tests/java/', import.meta.url).pathname;
const only = process.argv[2];
const files = readdirSync(dir).filter((f) => f.endsWith('.java') && (!only || f.includes(only)));
const cacheDir = join(tmpdir(), 'recompile-javacache');
mkdirSync(cacheDir, { recursive: true });

export function realJava(src, name) {
  const wd = join(cacheDir, name.replace(/\W/g, '_'));
  mkdirSync(wd, { recursive: true });
  const cacheFile = join(wd, 'out.json');
  if (existsSync(cacheFile)) {
    const c = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (c.src === src) return c.out;
  }
  writeFileSync(join(wd, 'Main.java'), src);
  let out;
  try {
    execFileSync('javac', ['-nowarn', '-d', wd, join(wd, 'Main.java')], { stdio: 'pipe' });
    try {
      out = execFileSync('java', ['-cp', wd, 'Main'], { stdio: 'pipe', timeout: 10000 }).toString();
    } catch (e) {
      out = (e.stdout || '').toString() + '<<EXC>>' + (e.stderr || '').toString().split('\n').find((l) => l.startsWith('Exception') || l.includes('Error')) ;
    }
  } catch (e) {
    out = '<<COMPILE ERROR>>' + e.stderr.toString();
  }
  writeFileSync(cacheFile, JSON.stringify({ src, out }));
  return out;
}

let fail = 0;
for (const f of files) {
  const src = readFileSync(join(dir, f), 'utf8');
  const expected = realJava(src, f).replace(/^Picked up JAVA_TOOL_OPTIONS.*\n/m, '');
  const r = runProgram(src);
  let got = r.stdout;
  if (r.error) got += r.error.kind === 'exception' ? '<<EXC>>' + r.error.message : '<<' + r.error.kind.toUpperCase() + '>>' + r.error.message;
  const exp = expected.replace(/<<EXC>>.*/s, (m) => m.split('\n')[0]);
  const ok = got.trim() === exp.trim() || (exp.includes('<<COMPILE ERROR>>') && got.includes('<<COMPILE>>'));
  if (!ok) {
    fail++;
    console.log(`FAIL ${f}`);
    const el = exp.split('\n'), gl = got.split('\n');
    for (let i = 0; i < Math.max(el.length, gl.length); i++) {
      if (el[i] !== gl[i]) { console.log(`  line ${i + 1}\n    java: ${JSON.stringify(el[i])}\n    ours: ${JSON.stringify(gl[i])}`); break; }
    }
  } else console.log(`ok   ${f} (${r.ms}ms)`);
}
console.log(`\n${files.length - fail}/${files.length} passed`);
process.exit(fail ? 1 : 0);

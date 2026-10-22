import { icon, esc, confirmDialog } from '../ui.js';
import { createEditor } from '../editor.js';
import { runProgram } from '../run.js';
import { errorBox } from './testresults.js';

const EXAMPLES = {
  'Hello, world': `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}`,
  'Quick statements (no class needed)': `// You can skip the class and main() for quick experiments.
int total = 0;
for (int i = 1; i <= 10; i++) {
    total += i;
}
System.out.println("Sum 1..10 = " + total);
System.out.println(7 / 2 + " vs " + 7 / 2.0);`,
  'Word frequency (HashMap)': `import java.util.*;

public class Main {
    public static void main(String[] args) {
        String text = "the cat and the hat and the bat";
        Map<String, Integer> counts = new HashMap<>();
        for (String w : text.split(" ")) {
            counts.put(w, counts.getOrDefault(w, 0) + 1);
        }
        System.out.println(counts);
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            if (e.getValue() > 1) System.out.println(e.getKey() + " appears " + e.getValue() + " times");
        }
    }
}`,
  'Recursion: factorial & fibonacci': `public class Main {
    static long factorial(int n) {
        if (n <= 1) return 1;        // base case
        return n * factorial(n - 1); // recursive case
    }

    static int fib(int n) {
        return n < 2 ? n : fib(n - 1) + fib(n - 2);
    }

    public static void main(String[] args) {
        for (int i = 0; i <= 10; i++) {
            System.out.printf("%2d! = %-8d fib(%d) = %d%n", i, factorial(i), i, fib(i));
        }
    }
}`,
  'Reading input (Scanner)': `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int sum = 0;
        for (int i = 0; i < n; i++) sum += in.nextInt();
        System.out.println("Sum: " + sum);
    }
}`,
};
const EXAMPLE_STDIN = { 'Reading input (Scanner)': '4\n10 20 30 40' };

export default function playground({ root, store }) {
  const L = store.lang();
  const saved = L.playground || { code: EXAMPLES['Hello, world'], stdin: '' };
  root.innerHTML = `
    <header class="page-head compact">
      <div class="kicker mono">Scratchpad</div>
      <h1>Playground</h1>
      <p class="lede">Try anything. Write a full class with <code>main</code>, or just a few statements.</p>
    </header>
    <div class="play-layout">
      <div class="play-main">
        <div class="work-bar">
          <label class="select-wrap"><span class="sr-only">Load example</span>
            <select class="example-select"><option value="">Load an example…</option>${Object.keys(EXAMPLES).map((k) => `<option>${esc(k)}</option>`).join('')}</select>
          </label>
          <button type="button" class="btn primary run-btn">${icon('play')} Run</button>
        </div>
        <div class="play-editor"></div>
        <details class="stdin-box" ${saved.stdin ? 'open' : ''}>
          <summary>Program input (stdin)</summary>
          <textarea class="stdin" rows="3" spellcheck="false" placeholder="Text your program reads with Scanner">${esc(saved.stdin || '')}</textarea>
        </details>
      </div>
      <div class="play-out">
        <div class="work-bar"><span class="mini-label">Output</span><span class="run-meta muted small mono"></span></div>
        <pre class="console big-console" aria-live="polite"><span class="muted">Press Run (or Ctrl/⌘ + Enter) to see output here.</span></pre>
        <div class="play-error"></div>
      </div>
    </div>
    <p class="muted small fine-print">This runs a large subset of Java right in your browser: classes, interfaces, enums, records, generics, lambdas, collections, streams and String.format. Some things like threads, files and networking aren't supported.</p>`;

  const stdin = root.querySelector('.stdin');
  const save = () => { L.playground = { code: ed.value, stdin: stdin.value }; store.changed(); };
  const ed = createEditor(root.querySelector('.play-editor'), { value: saved.code, minLines: 16, onChange: save, onRun: () => run() });
  stdin.addEventListener('input', save);
  const out = root.querySelector('.console');
  const errBox = root.querySelector('.play-error');
  const meta = root.querySelector('.run-meta');
  const runBtn = root.querySelector('.run-btn');

  async function run() {
    if (runBtn.disabled) return;
    runBtn.disabled = true;
    out.innerHTML = '<span class="muted">Running…</span>';
    errBox.innerHTML = '';
    const res = await runProgram(ed.value, stdin.value);
    runBtn.disabled = false;
    store.bump();
    store.changed();
    out.textContent = res.stdout || '';
    if (!res.stdout && !res.error) out.innerHTML = '<span class="muted">(no output)</span>';
    errBox.innerHTML = errorBox(res.error);
    ed.markLine(res.error && res.error.line);
    meta.textContent = res.ms != null ? `${res.ms} ms` : '';
    if (window.matchMedia('(max-width: 900px)').matches) root.querySelector('.play-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  runBtn.addEventListener('click', run);
  root.querySelector('.example-select').addEventListener('change', async (ev) => {
    const k = ev.target.value;
    ev.target.value = '';
    if (!k) return;
    if (ed.value.trim() && ed.value !== saved.code && !(await confirmDialog('Replace the code in the editor with this example?', { ok: 'Replace' }))) return;
    ed.value = EXAMPLES[k];
    stdin.value = EXAMPLE_STDIN[k] || stdin.value;
    if (EXAMPLE_STDIN[k]) root.querySelector('.stdin-box').open = true;
    save();
  });
}

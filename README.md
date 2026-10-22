# Recompile: get your Java back

A practice web app for someone who used to write Java and wants it back. It starts with a syntax refresher and climbs to LeetCode Easy problems. It works on phone and laptop, and saves your progress.

**Live site:** https://james431256.github.io/coding-improvement-app/

## What's inside

- **8 units, 25 lessons, 185 questions.** Each lesson opens with a short refresher, then mixes question types:
  - multiple choice and "select all that apply"
  - **predict the output** (type exactly what the code prints)
  - **fill in the blanks** in real code
  - **spot the bug** (tap the broken line)
  - **put in order** (assemble a program from shuffled lines)
  - **write the code** (your method runs against test cases)
- **41 problems**, from warm-ups to classic LeetCode Easy (Two Sum, Valid Parentheses, Best Time to Buy and Sell Stock, Reverse Linked List, Max Depth of Binary Tree, …). Each has hints, a solution and an explanation. They're ordered to match the course.
- **Your Java actually runs, in the browser.** `js/java/` is a small Java interpreter (lexer, parser, tree-walking evaluator and a standard-library subset: `String`, `StringBuilder`, `Math`, `ArrayList`, `HashMap` with Java's real iteration order, `HashSet`, `TreeMap`, `ArrayDeque`, `PriorityQueue`, streams, records, enums, lambdas, exceptions and more). It runs in a Web Worker, so an infinite loop can't freeze the page.
- **Review queue.** Questions you miss come back later, spaced out, until you get them right.
- **Progress tracking.** XP, a daily goal, a streak, an activity heatmap, and accuracy by question type. Everything is saved in your browser's `localStorage`. **Export / Import** on the Progress page moves it between devices.
- **Playground** for free-form Java, with stdin support for `Scanner`.
- **Cheat sheet** that collects every lesson's notes.
- Installable and offline-capable (PWA).

## Everything is checked against real Java

`npm test` runs two checks:

1. `tools/difftest.mjs` runs the programs in `tests/java/` through real `javac`/`java` **and** through the browser interpreter, and diffs the output.
2. `tools/verify-content.mjs` checks every lesson question and problem:
   - every "predict the output" answer must match what real Java prints, and what the in-browser interpreter prints;
   - every fill-in-the-blank, bug fix and ordering question must compile once corrected (and produce the stated output);
   - every reference solution must pass its tests in both runtimes, every expected value is re-computed by real Java, and every starter template must compile.

You'll need a JDK (17+) on your `PATH` for these.

## Running locally

It's a static site with no build step. Serve the folder with anything:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

After changing files, run `node tools/build-sw.mjs` to refresh the offline cache list.

## Adding another language later

- `content/registry.js` lists languages (Python, JavaScript and C++ are already there as "coming soon").
- A language is a content pack (`content/<lang>/index.js`: units, lessons, questions and problems in the same format as Java's) plus a runner that implements `runProgram` / `runTests` like `js/java/runner.js`.
- Progress is stored per language, so switching languages keeps each one's progress separate.

## Project layout

```
index.html, css/style.css     app shell and styles
js/app.js                     router and shell
js/views/*                    pages (home, learn, lesson session, problems, playground, progress, notes)
js/questions.js               question-type renderers
js/editor.js                  code editor (highlighting, auto-indent, phone symbol bar)
js/store.js                   progress persistence
js/java/*                     the Java interpreter + test harness + worker
content/java/units/*          lesson content
content/java/problems.js      problem set
tools/*                       verification scripts and service-worker builder
```

import { starter } from '../helpers.js';

export default {
  id: 'u6',
  title: 'The Collections toolkit',
  blurb: 'ArrayList, HashMap, HashSet, stacks, queues and heaps. Knowing which to grab is half of solving a problem.',
  lessons: [
    {
      id: 'arraylist',
      title: 'ArrayList & wrapper types',
      summary: 'Growable lists, autoboxing, and the remove() trap.',
      notes: `
~~~java
List<Integer> nums = new ArrayList<>();   // program to the interface
nums.add(5);            // append
nums.add(0, 9);         // insert at index 0
nums.get(1);            // read
nums.set(1, 7);         // overwrite
nums.remove(0);         // remove BY INDEX (int argument)
nums.remove(Integer.valueOf(7)); // remove BY VALUE (Object argument)
nums.size(); nums.contains(7); nums.indexOf(7); nums.isEmpty();
~~~

- Generics need **wrapper types**: \`List<Integer>\`, not \`List<int>\`. Java converts automatically between \`int\` and \`Integer\` (autoboxing).
- \`List.of(1, 2, 3)\` is **immutable**: \`add\` throws \`UnsupportedOperationException\`. Wrap it to get a mutable copy: \`new ArrayList<>(List.of(...))\`.
- Modifying a list while for-each-ing over it throws \`ConcurrentModificationException\`. Use \`list.removeIf(x -> ...)\` or an explicit \`Iterator\`.
- \`Collections.sort(list)\`, \`Collections.reverse(list)\`, \`Collections.max(list)\`, \`list.sort(comparator)\`.

> Watch out: Compare \`Integer\` objects with \`.equals()\`. \`==\` happens to work for values from -128 to 127 (they're cached), then mysteriously fails for bigger numbers.
`,
      questions: [
        {
          type: 'output',
          code: `List<String> list = new ArrayList<>();
list.add("a");
list.add("b");
list.add(0, "c");
list.set(2, "d");
System.out.println(list + " " + list.size());`,
          answer: '[c, a, d] 3',
          explain: '`add(0, "c")` inserts at the front, giving `[c, a, b]`. Then `set(2, "d")` replaces the `b`.',
        },
        {
          type: 'output',
          code: `List<Integer> nums = new ArrayList<>(List.of(10, 20, 30, 40));
nums.remove(1);
nums.remove(Integer.valueOf(40));
System.out.println(nums);`,
          answer: '[10, 30]',
          explain: '`remove(1)` uses the `int` overload and removes **index** 1 (the 20). `remove(Integer.valueOf(40))` uses the `Object` overload and removes the **value** 40.',
        },
        {
          type: 'mcq',
          prompt: 'What happens with this line?',
          code: 'List<int> nums = new ArrayList<>();',
          options: ['Works fine', 'Compile error: generics need a reference type like `Integer`', 'Runtime error on first `add`', 'It creates a list of `Integer` automatically'],
          answer: 1,
          explain: 'Type arguments must be classes. Use `List<Integer>`, and autoboxing handles the conversions.',
        },
        {
          type: 'mcq',
          prompt: 'What happens?',
          code: `List<Integer> fixed = List.of(1, 2, 3);
fixed.add(4);`,
          options: ['`fixed` becomes `[1, 2, 3, 4]`', 'Compile error', '`UnsupportedOperationException` at runtime', 'The add is silently ignored'],
          answer: 2,
          explain: '`List.of` returns an immutable list. It compiles (it\'s still a `List`) but throws when you modify it.',
        },
        {
          type: 'fill',
          prompt: 'Average the values in the list.',
          code: `List<Integer> nums = List.of(4, 8, 15);
int total = 0;
for (___ n : nums) total += n;
double avg = (double) total / nums.___;
System.out.println(avg);`,
          blanks: [['int', 'Integer', 'var'], ['size()']],
          expect: '9.0',
          explain: 'You can loop with `int` (auto-unboxing) or `Integer`. Lists use `size()`, arrays use `.length`, and Strings use `length()`. Yes, all three are different.',
        },
        {
          type: 'bug',
          prompt: 'This throws `ConcurrentModificationException`. Which line should change?',
          code: `List<Integer> nums = new ArrayList<>(List.of(1, 2, 3, 4));
for (Integer n : nums) {
    if (n % 2 == 0) nums.remove(n);
}
System.out.println(nums);`,
          line: 2,
          fix: 'for (Integer n : new ArrayList<>(nums)) {   // iterate over a copy',
          expect: '[1, 3]',
          explain: 'You can\'t structurally change a list while a for-each is walking it. Iterating over a copy works, but the cleanest fix is a single line: `nums.removeIf(n -> n % 2 == 0);`.',
        },
        {
          type: 'mcq',
          prompt: 'What does this print?',
          code: `Integer a = 1000, b = 1000;
System.out.println(a == b);
System.out.println(a.equals(b));`,
          options: ['`true` then `true`', '`false` then `true`', '`true` then `false`', 'Compile error'],
          answer: 1,
          explain: '`==` compares object references. Java caches `Integer` objects only for -128..127, so two 1000s are different objects. Use `equals` (or unbox to `int`).',
        },
        {
          type: 'output',
          code: `List<Integer> nums = new ArrayList<>(List.of(5, 2, 9, 1));
Collections.sort(nums);
System.out.println(nums + " max=" + Collections.max(nums));
Collections.reverse(nums);
System.out.println(nums.get(0));`,
          answer: '[1, 2, 5, 9] max=9\n9',
          explain: '`sort` orders ascending in place, and `reverse` flips it, so index 0 becomes the largest.',
        },
      ],
    },
    {
      id: 'hashmap-set',
      title: 'HashMap & HashSet',
      summary: 'O(1) lookups: counting, de-duplicating, remembering.',
      notes: `
~~~java
Map<String, Integer> ages = new HashMap<>();
ages.put("Ada", 36);                  // insert or overwrite
ages.get("Ada");                      // 36
ages.get("Bob");                      // null (missing key)
ages.getOrDefault("Bob", 0);          // 0
ages.containsKey("Ada");              // true
ages.remove("Ada");
ages.merge(word, 1, Integer::sum);    // counting one-liner

for (Map.Entry<String, Integer> e : ages.entrySet()) {
    System.out.println(e.getKey() + " -> " + e.getValue());
}
// also: ages.keySet(), ages.values()

Set<Integer> seen = new HashSet<>();
seen.add(3);         // true if it was new, false if already there
seen.contains(3);    // O(1) on average
~~~

- \`HashMap\`/\`HashSet\` iteration order is **not** something you can rely on.
- \`TreeMap\`/\`TreeSet\` keep keys **sorted** (O(log n) operations). \`LinkedHashMap\` remembers insertion order.
- The counting pattern: \`map.put(k, map.getOrDefault(k, 0) + 1)\`.

> Watch out: \`int n = map.get(key);\` throws \`NullPointerException\` when the key is missing: \`null\` can't unbox to \`int\`.
`,
      questions: [
        {
          type: 'output',
          code: `String word = "banana";
Map<Character, Integer> counts = new HashMap<>();
for (char c : word.toCharArray()) {
    counts.put(c, counts.getOrDefault(c, 0) + 1);
}
System.out.println(counts.get('a') + " " + counts.get('n') + " " + counts.get('z'));`,
          answer: '3 2 null',
          explain: 'The count pattern starts each key at 0 via `getOrDefault`. A key that was never added returns `null` from `get`.',
        },
        {
          type: 'output',
          code: `Set<String> seen = new HashSet<>();
System.out.println(seen.add("x"));
System.out.println(seen.add("x"));
System.out.println(seen.size());`,
          answer: 'true\nfalse\n1',
          explain: '`add` returns whether the set changed. That return value is handy for "have I seen this before?" checks.',
        },
        {
          type: 'fill',
          prompt: 'Print every entry.',
          code: `Map<String, Integer> scores = new TreeMap<>();
scores.put("bo", 3);
scores.put("al", 5);
for (Map.___<String, Integer> e : scores.___()) {
    System.out.println(e.getKey() + "=" + e.getValue());
}`,
          blanks: [['Entry'], ['entrySet']],
          expect: 'al=5\nbo=3',
          explain: '`entrySet()` gives key-value pairs as `Map.Entry` objects. A `TreeMap` iterates in sorted key order.',
        },
        {
          type: 'output',
          code: `Map<String, Integer> m = new TreeMap<>();
m.put("pear", 3);
m.put("apple", 7);
m.put("fig", 1);
m.put("apple", 2);
System.out.println(m);`,
          answer: '{apple=2, fig=1, pear=3}',
          explain: 'Keys are unique, so the second `put("apple", ...)` overwrites the first. `TreeMap` keeps keys sorted.',
        },
        {
          type: 'bug',
          prompt: 'This throws `NullPointerException`. Which line?',
          code: `Map<String, Integer> stock = new HashMap<>();
stock.put("apples", 4);
int pears = stock.get("pears");
System.out.println(pears);`,
          line: 3,
          fix: 'int pears = stock.getOrDefault("pears", 0);',
          expect: '0',
          explain: '`get` returns `null` for a missing key, and auto-unboxing `null` into an `int` throws.',
        },
        {
          type: 'mcq',
          prompt: 'What\'s the average time complexity of `HashSet.contains(x)`?',
          options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
          answer: 0,
          explain: 'Hashing jumps straight to the right bucket. That\'s why "use a set or map" turns so many O(n²) solutions into O(n).',
        },
        {
          type: 'code',
          prompt: 'Return the first character in `s` that appears for the **second** time while reading left to right. Return `\'_\'` if no character repeats. For `"abcbad"` the answer is `\'b\'`.',
          signature: 'char firstRepeated(String s)',
          starter: starter('char firstRepeated(String s)', { imports: true }),
          tests: [
            { args: ['abcbad'], expected: 'b' },
            { args: ['abc'], expected: '_' },
            { args: ['aa'], expected: 'a' },
            { args: [''], expected: '_' },
            { args: ['xyzzy'], expected: 'z' },
            { args: ['hello world'], expected: 'l' },
          ],
          solution: `import java.util.*;

class Solution {
    public char firstRepeated(String s) {
        Set<Character> seen = new HashSet<>();
        for (char c : s.toCharArray()) {
            if (!seen.add(c)) return c;
        }
        return '_';
    }
}`,
          explain: '`add` returns `false` when the character is already in the set, which is exactly the moment we want. That\'s O(n) time.',
        },
      ],
    },
    {
      id: 'stacks-queues',
      title: 'Stacks, queues & priority queues',
      summary: 'LIFO, FIFO and "always give me the smallest".',
      notes: `
### Stack (last in, first out)
~~~java
Deque<Integer> stack = new ArrayDeque<>();
stack.push(1); stack.push(2);
stack.peek();   // 2 (look)
stack.pop();    // 2 (remove)
stack.isEmpty();
~~~
Use for: matching brackets, undo, "most recent unmatched thing", and depth-first search.

### Queue (first in, first out)
~~~java
Queue<String> q = new ArrayDeque<>();   // or new LinkedList<>()
q.offer("a"); q.offer("b");
q.peek();   // "a"
q.poll();   // "a" (null if empty)
~~~
Use for: processing in arrival order, and breadth-first search (level by level).

### PriorityQueue (a heap)
~~~java
PriorityQueue<Integer> minHeap = new PriorityQueue<>();
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Collections.reverseOrder());
PriorityQueue<int[]> byDist = new PriorityQueue<>((a, b) -> a[1] - b[1]);
~~~
\`offer\` and \`poll\` are O(log n), and \`peek\` is O(1). It always hands you the smallest (by its ordering) next.

> Tip: Prefer \`ArrayDeque\` to the old \`Stack\` class. \`Stack\` is synchronized legacy code built on \`Vector\`.
`,
      questions: [
        {
          type: 'output',
          code: `Deque<Integer> stack = new ArrayDeque<>();
stack.push(1);
stack.push(2);
stack.push(3);
System.out.println(stack.pop() + " " + stack.peek() + " " + stack.size());`,
          answer: '3 2 2',
          explain: 'The last item pushed (3) comes off first. Then `peek` shows 2 without removing it, leaving 2 items.',
        },
        {
          type: 'output',
          code: `Queue<String> q = new ArrayDeque<>();
q.offer("a");
q.offer("b");
q.offer("c");
q.poll();
System.out.println(q.peek() + " " + q.size());`,
          answer: 'b 2',
          explain: 'A queue serves in arrival order, so `poll` removes "a" and "b" is next.',
        },
        {
          type: 'output',
          code: `PriorityQueue<Integer> pq = new PriorityQueue<>();
for (int x : new int[]{5, 1, 4, 2}) pq.offer(x);
System.out.print(pq.poll() + " ");
System.out.print(pq.poll() + " ");
System.out.println(pq.size());`,
          answer: '1 2 2',
          explain: 'A min-heap always polls the smallest remaining value, no matter what order things went in.',
        },
        {
          type: 'mcq',
          prompt: 'You\'re checking that every `(` has a matching `)` and every `[` has a `]`, in the right nesting order. Which structure fits best?',
          options: ['Queue', 'Stack', 'PriorityQueue', 'HashSet'],
          answer: 1,
          explain: 'The bracket you must close next is always the **most recently opened** one. That\'s LIFO, so a stack. You\'ll do this in the Valid Parentheses problem.',
        },
        {
          type: 'fill',
          prompt: 'Make a max-heap.',
          code: `PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Collections.___());
maxHeap.addAll(List.of(3, 9, 4));
System.out.println(maxHeap.poll());`,
          blanks: [['reverseOrder']],
          expect: '9',
          explain: '`Collections.reverseOrder()` flips the natural ordering, so the largest comes out first. `(a, b) -> b - a` also works for small ints.',
        },
        {
          type: 'code',
          prompt: 'Each `*` in `s` deletes the closest non-star character to its left (and the star itself). Return the final string. `"leet**cod*e"` gives `"lecoe"`. The input is always valid.',
          signature: 'String removeStars(String s)',
          starter: starter('String removeStars(String s)'),
          tests: [
            { args: ['leet**cod*e'], expected: 'lecoe' },
            { args: ['erase*****'], expected: '' },
            { args: ['abc'], expected: 'abc' },
            { args: ['a*b*c'], expected: 'c' },
            { args: ['ab**cd*'], expected: 'c' },
          ],
          solution: `class Solution {
    public String removeStars(String s) {
        StringBuilder stack = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c == '*') stack.deleteCharAt(stack.length() - 1);
            else stack.append(c);
        }
        return stack.toString();
    }
}`,
          explain: 'This is a stack problem: a `*` "pops" the latest character. A `StringBuilder` makes a great char stack, since append is push and `deleteCharAt(length - 1)` is pop.',
        },
        {
          type: 'mcq',
          prompt: 'Why is `Deque<Integer> stack = new ArrayDeque<>()` preferred over `new Stack<>()`?',
          options: [
            '`Stack` can\'t hold Integers',
            '`Stack` is a legacy synchronized class built on `Vector`, so it\'s slower and has odd extra methods',
            '`ArrayDeque` keeps elements sorted',
            '`Stack` has no `pop` method',
          ],
          answer: 1,
          explain: '`Stack` predates the Collections Framework. `ArrayDeque` is faster and is what the Java docs recommend.',
        },
      ],
    },
  ],
};

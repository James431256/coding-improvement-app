import { starter } from '../helpers.js';

export default {
  id: 'u2',
  title: 'Control flow',
  blurb: 'Branching, looping, and the everyday loop patterns that most problems are built from.',
  lessons: [
    {
      id: 'conditionals',
      title: 'if, switch & boolean logic',
      summary: 'Short-circuiting, fall-through, and the modern switch.',
      notes: `
### if / else if / else
Conditions must be \`boolean\`. Unlike C, \`if (x)\` with an \`int\` won't compile. Java checks the branches from the top and runs only the **first** one that matches.

~~~java
if (score >= 90) grade = 'A';
else if (score >= 80) grade = 'B';   // only checked if the first failed
else grade = 'C';
~~~

### Boolean operators
- \`&&\` and, \`||\` or, \`!\` not. Comparisons: \`== != < <= > >=\`.
- \`&&\` and \`||\` **short-circuit**: in \`a && b\`, if \`a\` is false, \`b\` is never evaluated. That's what makes \`s != null && s.length() > 0\` safe.
- De Morgan: \`!(a && b)\` is \`!a || !b\`, and \`!(a || b)\` is \`!a && !b\`.
- Ternary: \`String label = n % 2 == 0 ? "even" : "odd";\`

### switch
Classic switch **falls through** to the next case unless you \`break\`:

~~~java
switch (day) {
    case 6:
    case 7:
        System.out.println("weekend");
        break;
    default:
        System.out.println("weekday");
}
~~~

Modern (Java 14+) arrow form has no fall-through and can produce a value:

~~~java
int speed = switch (cmd) {
    case "stop" -> 0;
    case "slow", "careful" -> 10;
    default -> 50;
};
~~~
`,
      questions: [
        {
          type: 'output',
          code: `int temp = 18;
if (temp > 25) System.out.println("hot");
else if (temp > 15) System.out.println("mild");
else System.out.println("cold");`,
          answer: 'mild',
          explain: '18 isn\'t over 25, but it is over 15. The first matching branch runs and the rest are skipped.',
        },
        {
          type: 'mcq',
          prompt: '`s` might be `null`. Which condition is safe to evaluate?',
          options: [
            '`s != null && s.length() > 3`',
            '`s.length() > 3 && s != null`',
            '`s != null & s.length() > 3`',
            '`s.length() > 3 || s == null`',
          ],
          answer: 0,
          explain: '`&&` stops as soon as the left side is false, so `s.length()` never runs on `null`. The single `&` evaluates **both** sides, and the others call `length()` first, so they throw a `NullPointerException`.',
        },
        {
          type: 'output',
          prompt: 'Careful with this one. What prints?',
          code: `int day = 2;
switch (day) {
    case 1: System.out.println("Mon");
    case 2: System.out.println("Tue");
    case 3: System.out.println("Wed");
        break;
    default: System.out.println("Other");
}`,
          answer: 'Tue\nWed',
          explain: 'Execution jumps to `case 2` and then **falls through** into `case 3` because there\'s no `break`. It stops at the `break` before `default`.',
        },
        {
          type: 'fill',
          prompt: 'Complete the ternary expression.',
          code: `int n = 7;
String label = (n % 2 == 0) ___ "even" ___ "odd";
System.out.println(label);`,
          blanks: [['?'], [':']],
          expect: 'odd',
          explain: '`condition ? valueIfTrue : valueIfFalse`.',
        },
        {
          type: 'output',
          code: `String cmd = "go";
int speed = switch (cmd) {
    case "stop" -> 0;
    case "slow", "careful" -> 10;
    case "go" -> 50;
    default -> -1;
};
System.out.println(speed);`,
          answer: '50',
          explain: 'Arrow-style switch expressions pick exactly one branch (no fall-through) and produce a value. They work on `String`s too.',
        },
        {
          type: 'bug',
          prompt: 'A score of 85 should give `B`, but this prints `C`. Which line causes it?',
          code: `int score = 85;
String grade;
if (score >= 70) grade = "C";
else if (score >= 80) grade = "B";
else if (score >= 90) grade = "A";
else grade = "F";
System.out.println(grade);`,
          line: 3,
          fix: `if (score >= 90) grade = "A";
else if (score >= 80) grade = "B";
else if (score >= 70) grade = "C";`,
          expect: 'B',
          explain: '85 ≥ 70, so the first branch wins and the others are never checked. With overlapping ranges, test the **most restrictive** condition first.',
        },
        {
          type: 'mcq',
          prompt: 'Which expression is equivalent to `!(isAdmin && isActive)`?',
          options: ['`!isAdmin && !isActive`', '`!isAdmin || !isActive`', '`isAdmin || isActive`', '`!isAdmin || isActive`'],
          answer: 1,
          explain: 'De Morgan\'s law: the negation of an AND is the OR of the negations. "Not (admin and active)" means "not admin, or not active".',
        },
        {
          type: 'output',
          code: `int x = 7;
boolean result = x > 5 || x / 0 == 1;
System.out.println(result);`,
          answer: 'true',
          explain: '`x > 5` is already true, so `||` short-circuits and the division by zero is never evaluated. No exception.',
        },
      ],
    },
    {
      id: 'loops',
      title: 'Loops: for, while, do-while',
      summary: 'Counting loops, off-by-one errors, break and continue.',
      notes: `
~~~java
for (int i = 0; i < n; i++) { ... }      // runs n times: i = 0 .. n-1
for (int i = n - 1; i >= 0; i--) { ... } // backwards
while (condition) { ... }                // checks first, may run 0 times
do { ... } while (condition);            // runs at least once
for (int x : nums) { ... }               // for-each over an array or collection
~~~

- \`break\` leaves the loop immediately. \`continue\` skips to the next iteration.
- \`i < n\` vs \`i <= n\` is the classic **off-by-one**. With 0-based indexes, the last valid index is \`n - 1\`.
- A loop variable declared in the \`for\` header only exists inside the loop.
- In nested loops, \`break\` only exits the **inner** loop. To exit both, label the outer loop: \`outer: for (...)\` and use \`break outer;\`.

> Tip: When a loop is confusing, trace it by hand in a little table, one row per iteration, with a column for each variable. It feels slow, but it's how you find off-by-one bugs.
`,
      questions: [
        {
          type: 'output',
          code: `for (int i = 0; i < 5; i += 2) {
    System.out.print(i + " ");
}`,
          answer: '0 2 4',
          explain: '`i` takes the values 0, 2, 4. When it reaches 6 the condition `6 < 5` fails.',
        },
        {
          type: 'mcq',
          prompt: 'How many lines does this print?',
          code: `for (int i = 0; i <= 10; i++) {
    System.out.println(i);
}`,
          options: ['9', '10', '11', '12'],
          answer: 2,
          explain: '0 through 10 **inclusive** is 11 values. `i < 10` would give 10.',
        },
        {
          type: 'output',
          code: `int i = 0;
while (true) {
    i++;
    if (i % 2 == 0) continue;
    if (i > 7) break;
    System.out.print(i + " ");
}`,
          answer: '1 3 5 7',
          explain: 'Even values hit `continue` and skip the print. When `i` becomes 9 (odd and greater than 7) the loop breaks.',
        },
        {
          type: 'output',
          code: `int n = 10;
do {
    System.out.println("n = " + n);
    n++;
} while (n < 5);`,
          answer: 'n = 10',
          explain: 'A `do-while` checks its condition **after** the body, so the body always runs at least once, even though `10 < 5` is false.',
        },
        {
          type: 'fill',
          prompt: 'Print the string backwards.',
          code: `String s = "abc";
for (int i = ___; i >= 0; i___) {
    System.out.print(s.charAt(i));
}`,
          blanks: [['s.length() - 1'], ['--', '-=1', '-= 1']],
          expect: 'cba',
          explain: 'The last index is `length() - 1`. Counting down uses `i--`.',
        },
        {
          type: 'output',
          code: `for (int i = 1; i <= 3; i++) {
    for (int j = 1; j <= i; j++) {
        System.out.print("*");
    }
    System.out.println();
}`,
          answer: '*\n**\n***',
          explain: 'The inner loop runs `i` times on each pass of the outer loop, giving 1, 2, then 3 stars.',
        },
        {
          type: 'bug',
          prompt: 'This should count down from 10 to 1, but it never stops. Find the bug.',
          code: `int count = 10;
while (count > 0) {
    System.out.println(count);
    count++;
}`,
          line: 4,
          fix: 'count--;',
          explain: '`count` goes up forever, so `count > 0` never becomes false. (Eventually it would overflow, but that\'s not a fix.)',
        },
        {
          type: 'order',
          prompt: 'Build a program that adds up the even numbers from 1 to 10 and prints `30`.',
          lines: [
            'int sum = 0;',
            'for (int i = 1; i <= 10; i++) {',
            '    if (i % 2 == 0) {',
            '        sum += i;',
            '    }',
            '}',
            'System.out.println(sum);',
          ],
          distractors: ['sum = i;'],
          expect: '30',
          explain: 'Declare the accumulator **before** the loop, update it inside, print it after. The `sum = i;` line would overwrite instead of adding.',
        },
      ],
    },
    {
      id: 'loop-patterns',
      title: 'Loop patterns: count, sum, max, digits',
      summary: 'The building blocks behind half of all Easy problems.',
      notes: `
Most loop problems are one of a handful of patterns.

### Accumulate
~~~java
int sum = 0;
for (int x : nums) sum += x;
~~~

### Count matches
~~~java
int count = 0;
for (int x : nums) if (x > 0) count++;
~~~

### Track the best so far
~~~java
int best = nums[0];          // or Integer.MIN_VALUE, never 0
for (int x : nums) best = Math.max(best, x);
~~~

### Peel off digits
\`n % 10\` is the last digit, and \`n / 10\` drops it:
~~~java
while (n > 0) {
    int digit = n % 10;
    n /= 10;
}
~~~

### Search with an early exit
~~~java
for (int x : nums) {
    if (x == target) return true;   // found: stop now
}
return false;                       // only after checking everything
~~~

> Tip: To test whether \`n\` is prime you only need divisors up to √n. Loop while \`i * i <= n\`.
`,
      questions: [
        {
          type: 'output',
          code: `int n = 4072;
while (n > 0) {
    System.out.print(n % 10 + " ");
    n /= 10;
}`,
          answer: '2 7 0 4',
          explain: '`% 10` grabs the last digit, and `/= 10` removes it. The digits come out in reverse order.',
        },
        {
          type: 'fill',
          prompt: 'Find the largest value, which works even if every number is negative.',
          code: `int[] nums = {-8, -3, -12};
int best = ___;
for (int x : nums) {
    if (x ___ best) best = x;
}
System.out.println(best);`,
          blanks: [['nums[0]', 'Integer.MIN_VALUE'], ['>', '>=']],
          expect: '-3',
          explain: 'Start from the first element (or `Integer.MIN_VALUE`), not `0`. With all-negative input, `0` would wrongly win.',
        },
        {
          type: 'output',
          code: `int count = 0;
for (int i = 1; i <= 20; i++) {
    if (i % 3 == 0 || i % 5 == 0) count++;
}
System.out.println(count);`,
          answer: '9',
          explain: '3, 5, 6, 9, 10, 12, 15, 18, 20 makes 9 numbers. Note 15 is counted once even though it matches both conditions.',
        },
        {
          type: 'code',
          prompt: 'Return the sum of the digits of a non-negative integer. For example, `sumDigits(123)` is `6`.',
          signature: 'int sumDigits(int n)',
          starter: starter('int sumDigits(int n)'),
          tests: [
            { args: [123], expected: 6 },
            { args: [0], expected: 0 },
            { args: [7], expected: 7 },
            { args: [9999], expected: 36 },
            { args: [1000000], expected: 1 },
          ],
          solution: `class Solution {
    public int sumDigits(int n) {
        int sum = 0;
        while (n > 0) {
            sum += n % 10;
            n /= 10;
        }
        return sum;
    }
}`,
          explain: 'Peel digits off with `% 10` and `/ 10` until nothing is left. `n = 0` never enters the loop, so it correctly returns 0.',
        },
        {
          type: 'code',
          prompt: 'Return `true` if `n` is prime. Remember 0 and 1 are **not** prime.',
          signature: 'boolean isPrime(int n)',
          starter: starter('boolean isPrime(int n)'),
          tests: [
            { args: [2], expected: true },
            { args: [1], expected: false },
            { args: [0], expected: false },
            { args: [9], expected: false },
            { args: [17], expected: true },
            { args: [25], expected: false },
            { args: [7919], expected: true },
            { args: [1000000], expected: false },
          ],
          solution: `class Solution {
    public boolean isPrime(int n) {
        if (n < 2) return false;
        for (int i = 2; i * i <= n; i++) {
            if (n % i == 0) return false;
        }
        return true;
    }
}`,
          explain: 'If `n` has a divisor bigger than √n, it also has one smaller than √n. So stopping at `i * i <= n` is enough, and it\'s much faster than checking up to `n`.',
        },
        {
          type: 'bug',
          prompt: 'This should report whether `target` appears anywhere in the array, but it only ever checks the first element.',
          code: `static boolean contains(int[] arr, int target) {
    for (int x : arr) {
        if (x == target) return true;
        else return false;
    }
    return false;
}`,
          line: 4,
          fix: '// (delete the else: only return false after the loop has checked everything)',
          explain: 'Returning `false` inside the loop exits after the very first element. The "not found" answer belongs **after** the loop.',
        },
        {
          type: 'mcq',
          prompt: 'You need the maximum of an `int[]` that might contain only negative numbers. Which starting value for `best` is correct?',
          options: ['`0`', '`-1`', '`nums[0]`', '`nums.length`'],
          answer: 2,
          explain: 'Starting from an actual element guarantees the answer is one of the values. `0` or `-1` would beat an array like `{-5, -9}`. (`Integer.MIN_VALUE` also works.)',
        },
      ],
    },
  ],
};

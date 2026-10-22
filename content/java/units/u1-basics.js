export default {
  id: 'u1',
  title: 'Warm-up: types, maths & output',
  blurb: 'Shake off the rust. How a Java program is laid out, the primitive types, and the integer-maths traps that catch everyone.',
  lessons: [
    {
      id: 'types',
      title: 'Program anatomy & primitive types',
      summary: 'main(), statements, and the 8 primitive types.',
      notes: `
Every Java program lives inside a **class**, and execution starts at \`main\`:

~~~java
public class Main {                          // file must be Main.java
    public static void main(String[] args) { // entry point
        int age = 36;                        // statements end with ;
        System.out.println("Age: " + age);
    }
}
~~~

### The primitive types

| Type | Holds | Example |
|---|---|---|
| \`int\` | whole numbers, about ±2.1 billion | \`int n = 42;\` |
| \`long\` | bigger whole numbers | \`long big = 3_000_000_000L;\` |
| \`double\` | decimals (the default for decimals) | \`double p = 9.99;\` |
| \`boolean\` | \`true\` / \`false\` | \`boolean done = false;\` |
| \`char\` | one character, **single quotes** | \`char c = 'A';\` |
| \`byte\`, \`short\`, \`float\` | rarely needed | \`float f = 1.5f;\` |

- \`String\` is **not** a primitive. It's a class (capital S) and uses **double quotes**.
- A \`char\` is really a number (its Unicode code), so \`'A' + 1\` is \`66\`.
- \`var\` lets the compiler infer a local variable's type: \`var count = 0;\` is an \`int\`.
- \`final int MAX = 10;\` makes a constant, so it can't be reassigned.
- Underscores in numbers are just for readability: \`1_000_000\`.

> Watch out: A whole-number literal like \`3000000000\` is an \`int\` by default, and that one is too big. Add an \`L\` to make it a \`long\`.
`,
      questions: [
        {
          type: 'mcq',
          prompt: 'Which of these is a valid entry point that Java will run?',
          options: [
            '`public static void main(String[] args)`',
            '`public void main(String args)`',
            '`public static int main(String[] args)`',
            '`public static main(String[] args)`',
          ],
          answer: 0,
          explain: '`main` must be `public static void` and take a `String[]`. The other versions either return a value, aren\'t static, or are missing the return type.',
        },
        {
          type: 'mcq',
          prompt: 'You need to store the number of people on Earth (about 8,100,000,000). Which type should you use?',
          options: ['`int`', '`long`', '`short`', '`char`'],
          answer: 1,
          explain: '`int` tops out at 2,147,483,647 (about 2.1 billion). Anything bigger needs a `long` (up to about 9.2 × 10¹⁸).',
        },
        {
          type: 'output',
          code: `int apples = 5;
double price = 0.5;
System.out.println(apples * price);`,
          answer: '2.5',
          explain: 'When an `int` meets a `double` in arithmetic, the `int` is promoted to `double`, so the result is `2.5`.',
        },
        {
          type: 'fill',
          prompt: 'Fill in the type for each variable.',
          code: `___ name = "Ada";
___ initial = 'A';
___ ready = true;
___ pi = 3.14159;`,
          blanks: [['String', 'var'], ['char', 'var'], ['boolean', 'var'], ['double', 'var']],
          explain: 'Double quotes make a `String`, single quotes a `char`. `true`/`false` are `boolean`, and decimal literals are `double` by default.',
        },
        {
          type: 'bug',
          code: `public class Main {
    public static void main(String[] args) {
        char grade = "A";
        int score = 91;
        System.out.println(grade + " " + score);
    }
}`,
          line: 3,
          fix: `char grade = 'A';`,
          explain: 'A `char` literal uses **single** quotes. `"A"` is a `String`, and Java won\'t convert a `String` to a `char`, so this is a compile error.',
        },
        {
          type: 'output',
          code: `char c = 'A';
c++;
System.out.println(c);
System.out.println('A' + 1);`,
          answer: 'B\n66',
          explain: '`c++` keeps `c` a `char`, moving it to the next character: `B`. But `\'A\' + 1` is plain arithmetic: the char becomes its code (65) and the result is the `int` 66.',
        },
        {
          type: 'mcq',
          prompt: 'What happens with this line?',
          code: 'long population = 8100000000;',
          options: [
            'It compiles and stores 8100000000',
            'Compile error: the number is too large for an `int` literal',
            'It compiles but overflows to a negative number',
            'It is automatically stored as a `double`',
          ],
          answer: 1,
          explain: 'The literal on the right is an `int` literal until you add `L`. The compiler rejects it as "integer number too large". Write `8100000000L`.',
        },
        {
          type: 'order',
          prompt: 'Arrange the lines into a program that prints `Hi, Sam`.',
          lines: [
            'public class Main {',
            '    public static void main(String[] args) {',
            '        String name = "Sam";',
            '        System.out.println("Hi, " + name);',
            '    }',
            '}',
          ],
          explain: 'Class first, then `main` inside it. The variable has to be declared before it\'s used, and every `{` gets a matching `}`.',
        },
      ],
    },
    {
      id: 'operators',
      title: 'Operators: integer division, casting & overflow',
      summary: 'Where int maths surprises you, and how to control it.',
      notes: `
### Integer division truncates
When **both** sides are integers, \`/\` throws the fractional part away (it rounds toward zero):

~~~java
7 / 2      // 3
-7 / 2     // -3   (toward zero, not down)
7 / 2.0    // 3.5  (one double makes it a double division)
7 % 2      // 1    remainder
-7 % 2     // -1   remainder takes the sign of the left side
~~~

### Casting
- \`(double) a / b\` casts **a** first, so the division happens in \`double\`.
- \`(double) (a / b)\` is too late: the integer division already happened.
- \`(int) 3.99\` is \`3\`. Casting chops the decimals off, it doesn't round. Use \`Math.round\` to round.

### Increment & compound assignment
~~~java
int x = 5;
int a = x++;   // a = 5, then x becomes 6  (post-increment)
int b = ++x;   // x becomes 7, then b = 7  (pre-increment)
x += 2.9;      // compiles! same as x = (int)(x + 2.9), so x is 9
~~~

### Overflow
\`int\` arithmetic silently **wraps around**. \`Integer.MAX_VALUE + 1\` is \`Integer.MIN_VALUE\`. If a sum might get huge, use \`long\`.

> Tip: Operator precedence works like maths: \`* / %\` before \`+ -\`. Comparisons come next, then \`&&\`, then \`||\`. When in doubt, add parentheses.
`,
      questions: [
        {
          type: 'output',
          code: `System.out.println(7 / 2);
System.out.println(7 % 2);
System.out.println(7 / 2.0);`,
          answer: '3\n1\n3.5',
          explain: '`7 / 2` is integer division, giving `3`. `%` gives the remainder `1`. With `2.0` one side is a `double`, so you get `3.5`.',
        },
        {
          type: 'mcq',
          prompt: 'What is stored in `r`?',
          code: `int a = 5, b = 2;
double r = a / b;`,
          options: ['`2.5`', '`2.0`', '`2`', 'Compile error'],
          answer: 1,
          explain: '`a / b` is evaluated first as integer division, giving `2`. Only then is it widened to `double` for the assignment, so you get `2.0`.',
        },
        {
          type: 'fill',
          prompt: 'Make this compute the true average (e.g. `7 / 2` should give `3.5`).',
          code: `int sum = 7, count = 2;
double avg = (___) sum / count;`,
          blanks: [['double']],
          explain: 'Casting `sum` to `double` **before** dividing makes it a floating-point division.',
        },
        {
          type: 'output',
          code: `System.out.println(-7 / 2);
System.out.println(-7 % 2);`,
          answer: '-3\n-1',
          explain: 'Integer division rounds **toward zero**, so it\'s `-3`, not `-4`. The remainder has the sign of the left operand: `-1`. This is why `n % 2 == 1` fails as an odd check for negative numbers.',
        },
        {
          type: 'output',
          code: `int x = 5;
int y = x++ * 2;
System.out.println(x + " " + y);`,
          answer: '6 10',
          explain: 'Post-increment `x++` uses the **old** value (5) in the expression, then increments. So `y = 5 * 2 = 10` and `x` ends up `6`.',
        },
        {
          type: 'mcq',
          prompt: 'What does this print?',
          code: `int big = Integer.MAX_VALUE;
big = big + 1;
System.out.println(big);`,
          options: ['`2147483648`', '`-2147483648`', 'It throws an exception', 'Compile error'],
          answer: 1,
          explain: '`int` overflow wraps silently to the most negative value. No error, no warning. This is a classic source of bugs in sum and product problems.',
        },
        {
          type: 'bug',
          prompt: 'This should print `87.5%`, but prints `0.0%`. Tap the buggy line.',
          code: `int correct = 7;
int total = 8;
double percent = correct / total * 100;
System.out.println(percent + "%");`,
          line: 3,
          fix: 'double percent = (double) correct / total * 100;',
          explain: '`correct / total` is `7 / 8`, which is integer division giving `0`. Cast one side to `double` first.',
        },
        {
          type: 'output',
          code: `int n = 10;
n += 2.7;
System.out.println(n);`,
          answer: '12',
          explain: 'Compound assignment contains a hidden cast: `n += 2.7` means `n = (int)(n + 2.7)`, so `(int) 12.7` gives `12`. Writing `n = n + 2.7;` would be a compile error.',
        },
        {
          type: 'mcq',
          prompt: 'Which expression correctly checks whether an `int n` is even, including negative numbers?',
          options: ['`n % 2 == 0`', '`n % 2 == 1`', '`n / 2 == 0`', '`n / 2 * 2 == 1`'],
          answer: 0,
          explain: 'Even numbers have remainder 0, and that works for negatives too (`-4 % 2 == 0`). `n % 2 == 1` is an *odd* check that fails for negatives, because `-3 % 2` is `-1`.',
        },
      ],
    },
    {
      id: 'strings-print',
      title: 'Strings & printing',
      summary: 'Concatenation order, printf, escapes and immutability.',
      notes: `
### Concatenation is left to right
\`+\` means addition until it meets a \`String\`. From then on it means concatenation:

~~~java
1 + 2 + "3"     // "33"   (1+2 first, then "3" joins on)
"1" + 2 + 3     // "123"
'a' + 'b'       // 195    (two chars add as numbers!)
"" + 'a' + 'b'  // "ab"
~~~

### Printing
- \`System.out.println(x)\` prints and adds a newline. \`print\` doesn't add one.
- \`System.out.printf("%s has %d items, total %.2f%n", name, n, total);\`
- Format codes: \`%d\` int, \`%s\` anything, \`%.2f\` 2 decimal places, \`%5d\` pad to width 5, \`%-5s\` left-align, \`%n\` newline.
- \`String.format(...)\` builds the string without printing it.

### Escapes
\`\\n\` newline, \`\\t\` tab, \`\\"\` a quote, \`\\\\\` a backslash.

### Strings are immutable
Methods like \`toUpperCase()\`, \`trim()\`, \`replace()\` **return a new String**. The original never changes:

~~~java
String s = "hello";
s.toUpperCase();          // result thrown away!
s = s.toUpperCase();      // now s is "HELLO"
~~~
`,
      questions: [
        {
          type: 'output',
          code: 'System.out.println(1 + 2 + "3" + 4 + 5);',
          answer: '3345',
          explain: 'Left to right: `1 + 2 = 3` (still numbers), then `3 + "3"` is `"33"`, and everything after joins as text: `"3345"`.',
        },
        {
          type: 'output',
          code: `System.out.print("A");
System.out.print("B");
System.out.println("C");
System.out.println("D");`,
          answer: 'ABC\nD',
          explain: '`print` leaves the cursor on the same line. `println` ends the line after printing.',
        },
        {
          type: 'fill',
          prompt: 'Complete the format string so it prints `Ada is 36 years old`.',
          code: `String name = "Ada";
int age = 36;
System.out.printf("___ is ___ years old%n", name, age);`,
          blanks: [['%s'], ['%d', '%s']],
          explain: '`%s` formats any value as text, and `%d` formats an integer. `%n` is a newline.',
        },
        {
          type: 'output',
          code: `System.out.printf("%.2f%n", 3.14159);
System.out.println(String.format("[%5d]", 42));`,
          answer: '3.14\n[   42]',
          explain: '`%.2f` rounds to 2 decimal places. `%5d` right-aligns the number in a field 5 characters wide.',
        },
        {
          type: 'mcq',
          prompt: 'What does this print?',
          code: `String s = "hello";
s.toUpperCase();
System.out.println(s);`,
          options: ['`hello`', '`HELLO`', '`Hello`', 'Compile error'],
          answer: 0,
          explain: 'Strings are immutable. `toUpperCase()` returns a **new** string, which is thrown away here. You need `s = s.toUpperCase();`.',
        },
        {
          type: 'output',
          code: `System.out.println("She said \\"hi\\"");
System.out.println("C:\\\\temp");`,
          answer: 'She said "hi"\nC:\\temp',
          explain: 'Inside a string, `\\"` is a literal quote and `\\\\` is a single backslash.',
        },
        {
          type: 'output',
          code: `char a = 'a';
char b = 'b';
System.out.println(a + b);
System.out.println("" + a + b);`,
          answer: '195\nab',
          explain: '`a + b` adds the character codes (97 + 98 = 195). Starting with `""` turns `+` into concatenation.',
        },
        {
          type: 'bug',
          prompt: 'This should print `Grace Hopper`. Which line is wrong?',
          code: `String first = "Grace";
String last = "Hopper";
String full = first + last;
System.out.println(full);`,
          line: 3,
          fix: 'String full = first + " " + last;',
          explain: 'Concatenation adds nothing between the parts, so you get `GraceHopper`. Add the space yourself.',
        },
      ],
    },
  ],
};

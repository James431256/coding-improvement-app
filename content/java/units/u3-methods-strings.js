import { starter } from '../helpers.js';

export default {
  id: 'u3',
  title: 'Methods & strings',
  blurb: 'Writing your own methods, how Java passes arguments, and the String toolkit every problem leans on.',
  lessons: [
    {
      id: 'methods',
      title: 'Methods, parameters & return values',
      summary: 'Pass-by-value, overloading, static vs instance.',
      notes: `
~~~java
static int add(int a, int b) {   // return type, name, parameters
    return a + b;
}
static void greet(String name) {  // void: returns nothing
    System.out.println("Hi " + name);
}
~~~

### Java is always pass-by-value
- For primitives, the method gets a **copy**, so changing it inside has no effect outside.
- For objects and arrays, the method gets a copy of the **reference**. It can change the object's contents (\`arr[0] = 5\`), but reassigning the parameter (\`arr = new int[3]\`) doesn't affect the caller.

### Overloading
Same name, different parameter lists. Java picks the most specific match at compile time: \`print(5)\` prefers \`print(int)\` over \`print(long)\` over \`print(double)\`.

### static vs instance
- \`static\` methods belong to the class. Call them directly from \`main\`.
- Non-static (instance) methods need an object: \`new Solution().solve()\`.
- Calling an instance method from \`static main\` without an object gives the compile error *"non-static method cannot be referenced from a static context"*.

> Watch out: Every path through a non-void method must \`return\` something, or it won't compile ("missing return statement").
`,
      questions: [
        {
          type: 'output',
          code: `static void addOne(int x) {
    x = x + 1;
}

int n = 5;
addOne(n);
System.out.println(n);`,
          answer: '5',
          explain: '`addOne` receives a **copy** of `n`. Changing the copy doesn\'t touch the original.',
        },
        {
          type: 'output',
          code: `static void zeroFirst(int[] a) {
    a[0] = 0;
}

int[] nums = {5, 6, 7};
zeroFirst(nums);
System.out.println(nums[0] + nums[1]);`,
          answer: '6',
          explain: 'The method gets a copy of the **reference**, which points at the same array. Writing `a[0] = 0` changes the caller\'s array, so the sum is `0 + 6`.',
        },
        {
          type: 'output',
          prompt: 'Which overload runs for each call?',
          code: `static String kind(int x) { return "int"; }
static String kind(double x) { return "double"; }
static String kind(long x) { return "long"; }

System.out.println(kind(5) + " " + kind(5.0) + " " + kind(5L) + " " + kind('a'));`,
          answer: 'int double long int',
          explain: 'Exact matches win. A `char` has no exact overload, so Java widens it to the nearest type, `int`.',
        },
        {
          type: 'fill',
          prompt: 'Fill in the return types.',
          code: `static ___ average(int a, int b) {
    return (a + b) / 2.0;
}
static ___ shout(String s) {
    System.out.println(s.toUpperCase() + "!");
}`,
          blanks: [['double'], ['void']],
          explain: '`(a + b) / 2.0` is a `double`. A method that only prints and returns nothing is `void`.',
        },
        {
          type: 'bug',
          prompt: 'The compiler rejects this method with "missing return statement". Which line needs to change?',
          code: `static String sign(int n) {
    if (n > 0) return "positive";
    else if (n < 0) return "negative";
}`,
          line: 3,
          fix: 'else return n < 0 ? "negative" : "zero";',
          explain: 'When `n == 0`, neither branch returns. The compiler insists every path returns a value. Make the last branch a plain `else`.',
        },
        {
          type: 'mcq',
          prompt: 'In `public static void main`, you call `helper();`, where `helper` is declared as `void helper() { ... }` (no `static`). What happens?',
          options: [
            'It runs normally',
            'Compile error: non-static method cannot be referenced from a static context',
            'Runtime NullPointerException',
            'Java automatically creates an object to call it on',
          ],
          answer: 1,
          explain: 'Instance methods need an object to run on. Either make `helper` `static`, or call it on an instance (`new Main().helper()`).',
        },
        {
          type: 'code',
          prompt: 'Return the largest of three integers.',
          signature: 'int maxOfThree(int a, int b, int c)',
          starter: starter('int maxOfThree(int a, int b, int c)'),
          tests: [
            { args: [1, 2, 3], expected: 3 },
            { args: [9, 2, 3], expected: 9 },
            { args: [4, 8, 1], expected: 8 },
            { args: [-5, -2, -9], expected: -2 },
            { args: [7, 7, 7], expected: 7 },
          ],
          solution: `class Solution {
    public int maxOfThree(int a, int b, int c) {
        return Math.max(a, Math.max(b, c));
    }
}`,
          explain: '`Math.max` takes two values, so nest it. A chain of `if`s works too.',
        },
      ],
    },
    {
      id: 'string-api',
      title: 'The String toolkit',
      summary: 'charAt, substring, indexOf, equals, split and friends.',
      notes: `
| Method | Example | Result |
|---|---|---|
| \`length()\` | \`"java".length()\` | \`4\` |
| \`charAt(i)\` | \`"java".charAt(1)\` | \`'a'\` |
| \`substring(b, e)\` | \`"java".substring(1, 3)\` | \`"av"\` (end is **exclusive**) |
| \`substring(b)\` | \`"java".substring(2)\` | \`"va"\` |
| \`indexOf(x)\` | \`"java".indexOf('v')\` | \`2\` (or \`-1\` if missing) |
| \`contains(s)\` | \`"java".contains("av")\` | \`true\` |
| \`equals(s)\` | \`a.equals(b)\` | compares **content** |
| \`compareTo(s)\` | \`"a".compareTo("b")\` | negative, 0, or positive |
| \`split(regex)\` | \`"a,b".split(",")\` | \`["a", "b"]\` |
| \`toCharArray()\` | \`"hi".toCharArray()\` | \`['h', 'i']\` |
| \`trim()\`, \`toLowerCase()\` | | return **new** strings |

- Arrays use \`.length\` (a field), but Strings use \`.length()\` (a method).
- Convert: \`Integer.parseInt("42")\`, \`String.valueOf(42)\`, \`"" + 42\`.
- \`Character.isDigit(c)\`, \`isLetter\`, \`isLetterOrDigit\`, \`isUpperCase\`, \`toLowerCase(c)\`.

> Watch out: Never compare Strings with \`==\`. It checks whether two references point at the **same object**, not whether they hold the same text. Use \`.equals()\`.
`,
      questions: [
        {
          type: 'output',
          code: `String s = "programming";
System.out.println(s.substring(3, 7));
System.out.println(s.substring(8));`,
          answer: 'gram\ning',
          explain: '`substring(3, 7)` takes indexes 3, 4, 5, 6 (the end index is excluded). `substring(8)` runs to the end.',
        },
        {
          type: 'output',
          code: `String s = "banana";
System.out.println(s.indexOf("an"));
System.out.println(s.lastIndexOf("an"));
System.out.println(s.indexOf('z'));`,
          answer: '1\n3\n-1',
          explain: '"an" first appears at index 1 and last at index 3. Not found gives `-1`.',
        },
        {
          type: 'mcq',
          prompt: 'What does this print?',
          code: `String a = "hi";
String b = new String("hi");
System.out.println(a == b);
System.out.println(a.equals(b));`,
          options: ['`true` then `true`', '`false` then `true`', '`true` then `false`', '`false` then `false`'],
          answer: 1,
          explain: '`new String` creates a separate object, so `==` (same object?) is `false`. `equals` compares the characters, so it\'s `true`. Always use `equals` for Strings.',
        },
        {
          type: 'output',
          code: `System.out.println("apple".compareTo("banana") < 0);
System.out.println("Zebra".compareTo("apple") < 0);`,
          answer: 'true\ntrue',
          explain: '`compareTo` compares character codes. All uppercase letters (A–Z are 65–90) come **before** lowercase ones (97–122), so `"Zebra"` sorts before `"apple"`.',
        },
        {
          type: 'fill',
          prompt: 'Loop over every character in `s`.',
          code: `String s = "loop";
for (int i = 0; i < s.___; i++) {
    char c = s.___(i);
    System.out.print(c + "-");
}`,
          blanks: [['length()'], ['charAt']],
          expect: 'l-o-o-p-',
          explain: 'Strings use the method `length()` (with brackets), and `charAt(i)` reads one character.',
        },
        {
          type: 'output',
          code: `String[] parts = "2026-10-20".split("-");
System.out.println(parts.length + " " + parts[1]);
System.out.println(Integer.parseInt(parts[0]) + 1);`,
          answer: '3 10\n2027',
          explain: '`split` returns a `String[]`. To do maths with a piece, parse it with `Integer.parseInt`. `parts[0] + 1` would have given `"20261"`.',
        },
        {
          type: 'bug',
          prompt: 'This prints `Cancelled` even though the input is "yes". Why?',
          code: `String input = new String("yes"); // imagine this came from the user
if (input == "yes") {
    System.out.println("Confirmed");
} else {
    System.out.println("Cancelled");
}`,
          line: 2,
          fix: 'if (input.equals("yes")) {',
          expect: 'Confirmed',
          explain: 'Strings built at runtime (user input, `new String`, `substring`, …) are different objects from the literal `"yes"`, so `==` is false. `equals` compares content.',
        },
        {
          type: 'output',
          code: `String s = "a1B2";
int letters = 0, digits = 0;
for (char c : s.toCharArray()) {
    if (Character.isLetter(c)) letters++;
    else if (Character.isDigit(c)) digits++;
}
System.out.println(letters + " letters, " + digits + " digits");`,
          answer: '2 letters, 2 digits',
          explain: '`toCharArray()` lets you for-each over characters. The `Character` helpers classify each one.',
        },
        {
          type: 'code',
          prompt: 'Count the vowels (`a e i o u`, upper or lower case) in `s`.',
          signature: 'int countVowels(String s)',
          starter: starter('int countVowels(String s)'),
          tests: [
            { args: ['hello'], expected: 2 },
            { args: ['AEIOU'], expected: 5 },
            { args: ['rhythm'], expected: 0 },
            { args: [''], expected: 0 },
            { args: ['Programming in Java'], expected: 6 },
          ],
          solution: `class Solution {
    public int countVowels(String s) {
        int count = 0;
        for (char c : s.toLowerCase().toCharArray()) {
            if ("aeiou".indexOf(c) >= 0) count++;
        }
        return count;
    }
}`,
          explain: 'Lower-case the string once, then check each character. `"aeiou".indexOf(c) >= 0` is a neat "is it one of these?" test.',
        },
      ],
    },
    {
      id: 'stringbuilder',
      title: 'StringBuilder & character tricks',
      summary: 'Building strings efficiently and doing maths with chars.',
      notes: `
### StringBuilder: a mutable string
~~~java
StringBuilder sb = new StringBuilder();
sb.append("abc").append(42).append('!'); // chainable
sb.insert(0, ">");       // ">abc42!"
sb.reverse();            // "!24cba>"
sb.setCharAt(0, '?');
sb.deleteCharAt(sb.length() - 1);
String result = sb.toString();
~~~

Why bother? \`result += c\` inside a loop creates a brand-new String every time, copying everything so far, which is O(n²) overall. \`StringBuilder.append\` is amortised O(1).

### chars are numbers
~~~java
char c = 'd';
int index = c - 'a';             // 3: position in the alphabet
char next = (char) (c + 1);      // 'e' (cast back to char!)
int digit = '7' - '0';           // 7: char digit to int
int[] counts = new int[26];      // letter frequency table
counts[c - 'a']++;
~~~

> Tip: \`new int[26]\` indexed by \`c - 'a'\` is the fastest way to count lowercase letters. You'll use it in anagram and frequency problems.
`,
      questions: [
        {
          type: 'output',
          code: `StringBuilder sb = new StringBuilder("abc");
sb.append("de").insert(0, "x").reverse();
System.out.println(sb);`,
          answer: 'edcbax',
          explain: '`"abc"` becomes `"abcde"`, then `"xabcde"`, then reversed: `"edcbax"`. StringBuilder methods modify it in place and return the same builder, which is why chaining works.',
        },
        {
          type: 'output',
          code: `char c = 'd';
System.out.println(c - 'a');
System.out.println((char) ('a' + 25));`,
          answer: '3\nz',
          explain: 'Subtracting chars gives an `int` distance. Adding to a char gives an `int` too, so you cast back with `(char)` to get a letter.',
        },
        {
          type: 'fill',
          prompt: 'Count how often each letter appears.',
          code: `String word = "hello";
int[] counts = new int[26];
for (char c : word.toCharArray()) {
    counts[c - ___]++;
}
System.out.println(counts['l' - 'a']);`,
          blanks: [["'a'", '97']],
          expect: '2',
          explain: '`c - \'a\'` maps `\'a\'..\'z\'` to `0..25`, a perfect array index.',
        },
        {
          type: 'mcq',
          prompt: 'Why use `StringBuilder` instead of `result += c` when building a long string in a loop?',
          options: [
            '`+=` doesn\'t work with `char`',
            'Each `+=` copies the whole string into a new object, so the loop becomes O(n²)',
            'StringBuilder output is sorted',
            'Strings have a maximum length of 255',
          ],
          answer: 1,
          explain: 'Strings are immutable, so every `+=` allocates and copies. `StringBuilder` grows one buffer in place.',
        },
        {
          type: 'code',
          prompt: 'Return `s` reversed.',
          signature: 'String reverse(String s)',
          starter: starter('String reverse(String s)'),
          tests: [
            { args: ['hello'], expected: 'olleh' },
            { args: [''], expected: '' },
            { args: ['a'], expected: 'a' },
            { args: ['Java 21'], expected: '12 avaJ' },
          ],
          solution: `class Solution {
    public String reverse(String s) {
        return new StringBuilder(s).reverse().toString();
    }
}`,
          explain: 'The one-liner uses `StringBuilder.reverse()`. A manual loop from the end, appending each char to a StringBuilder, is good practice too.',
        },
        {
          type: 'code',
          prompt: 'Return `true` if `s` reads the same forwards and backwards (exact characters, case-sensitive). Try it **without** building a reversed copy.',
          signature: 'boolean isPalindrome(String s)',
          starter: starter('boolean isPalindrome(String s)'),
          tests: [
            { args: ['racecar'], expected: true },
            { args: ['abba'], expected: true },
            { args: ['abca'], expected: false },
            { args: [''], expected: true },
            { args: ['x'], expected: true },
            { args: ['Abba'], expected: false },
          ],
          solution: `class Solution {
    public boolean isPalindrome(String s) {
        int i = 0, j = s.length() - 1;
        while (i < j) {
            if (s.charAt(i) != s.charAt(j)) return false;
            i++;
            j--;
        }
        return true;
    }
}`,
          explain: 'Two pointers walk in from both ends and stop at the first mismatch. That\'s O(n) time and O(1) extra space. You\'ll see this pattern again in Unit 7.',
        },
        {
          type: 'bug',
          prompt: 'This should print `0,1,2` without the trailing comma.',
          code: `StringBuilder sb = new StringBuilder();
for (int i = 0; i < 3; i++) {
    sb.append(i).append(",");
}
String csv = sb.toString();
csv.substring(0, csv.length() - 1);
System.out.println(csv);`,
          line: 6,
          fix: 'csv = csv.substring(0, csv.length() - 1);',
          expect: '0,1,2',
          explain: 'Strings are immutable. `substring` returns a new String that\'s thrown away here. (`sb.setLength(sb.length() - 1)` before `toString()` also works.)',
        },
        {
          type: 'output',
          code: `String word = "hal";
StringBuilder out = new StringBuilder();
for (char c : word.toCharArray()) {
    out.append((char) (c + 1));
}
System.out.println(out);`,
          answer: 'ibm',
          explain: 'Each letter shifts forward by one: h→i, a→b, l→m. Without the `(char)` cast you would append the numbers `105`, `98`, `109`.',
        },
      ],
    },
  ],
};

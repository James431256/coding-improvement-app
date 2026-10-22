import { starter } from '../helpers.js';

export default {
  id: 'u4',
  title: 'Arrays',
  blurb: 'Fixed-size arrays inside out: defaults, references, in-place algorithms and 2D grids.',
  lessons: [
    {
      id: 'arrays-basics',
      title: 'Array basics & references',
      summary: 'Creation, defaults, length, printing and aliasing.',
      notes: `
~~~java
int[] a = new int[5];          // five zeros
int[] b = {3, 1, 4};           // initializer (only allowed in a declaration)
int[] c = new int[]{3, 1, 4};  // the same, works anywhere
String[] names = new String[3]; // three nulls
~~~

- **Defaults**: \`0\` for numbers, \`false\` for boolean, \`'\\u0000'\` for char, \`null\` for objects.
- Indexes run \`0\` to \`a.length - 1\`. Anything else throws \`ArrayIndexOutOfBoundsException\`.
- \`a.length\` is a field, so no brackets.
- Arrays are **fixed size**. For something that grows, use \`ArrayList\` (Unit 6).

### Arrays are objects, so variables hold references
~~~java
int[] x = {1, 2};
int[] y = x;        // y points at the SAME array
y[0] = 99;          // x[0] is now 99 too
~~~
- \`x == y\` compares references. Use \`Arrays.equals(x, y)\` to compare contents.
- \`System.out.println(x)\` prints something like \`[I@1b6d3586\`. Use \`Arrays.toString(x)\`.
- For-each gives you a **copy** of each element. Assigning to the loop variable doesn't change the array.
`,
      questions: [
        {
          type: 'output',
          code: `int[] a = new int[3];
String[] s = new String[2];
boolean[] b = new boolean[1];
System.out.println(a[0] + " " + s[1] + " " + b[0]);`,
          answer: '0 null false',
          explain: 'New arrays are filled with default values: 0, null, false.',
        },
        {
          type: 'mcq',
          prompt: 'What does this print?',
          code: `int[] nums = {1, 2, 3};
System.out.println(nums);`,
          options: ['`[1, 2, 3]`', '`123`', 'Something like `[I@1b6d3586`', 'Compile error'],
          answer: 2,
          explain: 'Arrays don\'t override `toString()`, so you get a type code plus a hash. Use `Arrays.toString(nums)` for `[1, 2, 3]`.',
        },
        {
          type: 'output',
          code: `int[] a = {1, 2, 3};
int[] b = a;
b[0] = 99;
System.out.println(a[0]);`,
          answer: '99',
          explain: '`b = a` copies the reference, not the array. Both names refer to one array. To get a real copy use `a.clone()` or `Arrays.copyOf(a, a.length)`.',
        },
        {
          type: 'output',
          code: `int[] nums = {1, 2, 3};
for (int x : nums) {
    x = x * 10;
}
System.out.println(Arrays.toString(nums));`,
          answer: '[1, 2, 3]',
          explain: '`x` is a copy of each element. To modify the array, use an index loop: `nums[i] *= 10`.',
        },
        {
          type: 'bug',
          prompt: 'This crashes with `ArrayIndexOutOfBoundsException`. Which line?',
          code: `int[] scores = {90, 85, 77};
int total = 0;
for (int i = 0; i <= scores.length; i++) {
    total += scores[i];
}
System.out.println(total);`,
          line: 3,
          fix: 'for (int i = 0; i < scores.length; i++) {',
          expect: '252',
          explain: 'Valid indexes are 0–2. `i <= length` tries `scores[3]`.',
        },
        {
          type: 'fill',
          prompt: 'Fill an array with the squares 0, 1, 4, 9, 16.',
          code: `int[] squares = new int[___];
for (int i = 0; i < squares.___; i++) {
    squares[i] = i * i;
}
System.out.println(Arrays.toString(squares));`,
          blanks: [['5'], ['length']],
          expect: '[0, 1, 4, 9, 16]',
          explain: 'Five elements, and `length` without brackets for arrays.',
        },
        {
          type: 'multi',
          prompt: 'Given these arrays, which expressions are `true`? Select all that apply.',
          code: `int[] a = {1, 2};
int[] b = {1, 2};`,
          options: ['`a == b`', '`a.equals(b)`', '`Arrays.equals(a, b)`', '`a.length == b.length`'],
          answers: [2, 3],
          explain: '`==` and `a.equals(b)` both compare **references** for arrays (arrays inherit `Object.equals`). Only `Arrays.equals` compares contents.',
        },
        {
          type: 'output',
          code: `int[] arr = new int[5];
arr[arr.length - 1] = 7;
System.out.println(arr[4] + arr.length);`,
          answer: '12',
          explain: '`arr.length - 1` is 4, the last index. `7 + 5 = 12`.',
        },
      ],
    },
    {
      id: 'array-algorithms',
      title: 'In-place array algorithms',
      summary: 'Swap, reverse, prefix sums, sorting and copying.',
      notes: `
### Swap two elements
~~~java
int tmp = a[i];
a[i] = a[j];
a[j] = tmp;
~~~

### Reverse in place (two pointers)
~~~java
for (int l = 0, r = a.length - 1; l < r; l++, r--) {
    int tmp = a[l]; a[l] = a[r]; a[r] = tmp;
}
~~~

### Prefix sums: answer "sum of a range" in O(1)
~~~java
int[] prefix = new int[a.length + 1];
for (int i = 0; i < a.length; i++) prefix[i + 1] = prefix[i] + a[i];
// sum of a[l..r] inclusive = prefix[r + 1] - prefix[l]
~~~

### Handy java.util.Arrays methods
| Call | Does |
|---|---|
| \`Arrays.sort(a)\` | sorts ascending, O(n log n) |
| \`Arrays.toString(a)\` | \`"[1, 2, 3]"\` |
| \`Arrays.fill(a, -1)\` | sets every element |
| \`Arrays.copyOf(a, n)\` | new array of length n (pads with defaults) |
| \`Arrays.copyOfRange(a, from, to)\` | \`to\` is exclusive |
`,
      questions: [
        {
          type: 'order',
          prompt: 'Arrange the lines to reverse `arr` in place.',
          setup: 'int[] arr = {1, 2, 3, 4, 5};',
          lines: [
            'int left = 0, right = arr.length - 1;',
            'while (left < right) {',
            '    int tmp = arr[left];',
            '    arr[left] = arr[right];',
            '    arr[right] = tmp;',
            '    left++;',
            '    right--;',
            '}',
          ],
          alts: [[
            'int left = 0, right = arr.length - 1;',
            'while (left < right) {',
            '    int tmp = arr[left];',
            '    arr[left] = arr[right];',
            '    arr[right] = tmp;',
            '    right--;',
            '    left++;',
            '}',
          ]],
          teardown: 'System.out.println(Arrays.toString(arr));',
          expect: '[5, 4, 3, 2, 1]',
          explain: 'Save one value in `tmp` before overwriting it, then move both pointers inward. Stop when they meet.',
        },
        {
          type: 'output',
          code: `int[] a = {3, 1, 4, 1, 5};
int[] prefix = new int[a.length + 1];
for (int i = 0; i < a.length; i++) prefix[i + 1] = prefix[i] + a[i];
System.out.println(Arrays.toString(prefix));
System.out.println(prefix[4] - prefix[1]);`,
          answer: '[0, 3, 4, 8, 9, 14]\n6',
          explain: '`prefix[k]` is the sum of the first `k` elements. `prefix[4] - prefix[1]` is `a[1] + a[2] + a[3] = 1 + 4 + 1 = 6`.',
        },
        {
          type: 'output',
          code: `int[] a = {3, -1, 2};
int[] b = Arrays.copyOf(a, 5);
Arrays.sort(a);
System.out.println(Arrays.toString(a));
System.out.println(Arrays.toString(b));`,
          answer: '[-1, 2, 3]\n[3, -1, 2, 0, 0]',
          explain: '`copyOf` makes an independent array, padding with zeros. Sorting `a` afterwards doesn\'t affect `b`.',
        },
        {
          type: 'fill',
          prompt: 'Complete the swap.',
          code: `int[] a = {10, 20};
int i = 0, j = 1;
int tmp = a[i];
a[i] = ___;
a[j] = ___;
System.out.println(a[0] + " " + a[1]);`,
          blanks: [['a[j]'], ['tmp']],
          expect: '20 10',
          explain: 'Classic three-step swap. Without `tmp`, the first assignment would destroy `a[i]`.',
        },
        {
          type: 'bug',
          prompt: '`max(new int[]{-4, -2, -7})` returns `0`. Which line is wrong?',
          code: `static int max(int[] nums) {
    int best = 0;
    for (int x : nums) {
        if (x > best) best = x;
    }
    return best;
}`,
          line: 2,
          fix: 'int best = nums[0];',
          explain: '0 is bigger than every element, so it never gets replaced. Start from a real element.',
        },
        {
          type: 'code',
          prompt: 'Return the index of the largest value. If it appears more than once, return the **first** index. The array is non-empty.',
          signature: 'int indexOfMax(int[] nums)',
          starter: starter('int indexOfMax(int[] nums)'),
          tests: [
            { args: [[1, 5, 3]], expected: 1 },
            { args: [[7]], expected: 0 },
            { args: [[2, 9, 9, 1]], expected: 1 },
            { args: [[-3, -1, -2]], expected: 1 },
            { args: [[4, 3, 2, 1]], expected: 0 },
          ],
          solution: `class Solution {
    public int indexOfMax(int[] nums) {
        int best = 0;
        for (int i = 1; i < nums.length; i++) {
            if (nums[i] > nums[best]) best = i;
        }
        return best;
    }
}`,
          explain: 'Track the **index** of the best so far. Using `>` (not `>=`) keeps the first occurrence when there are ties.',
        },
        {
          type: 'code',
          prompt: 'Return the second-largest **distinct** value. For example `{4, 9, 9, 2}` gives `4`. There are always at least two distinct values.',
          signature: 'int secondLargest(int[] nums)',
          starter: starter('int secondLargest(int[] nums)'),
          tests: [
            { args: [[4, 9, 9, 2]], expected: 4 },
            { args: [[1, 2]], expected: 1 },
            { args: [[5, 5, 5, 3]], expected: 3 },
            { args: [[-1, -5, -3]], expected: -3 },
            { args: [[10, 20, 30, 40, 50]], expected: 40 },
            { args: [[50, 40, 30, 20, 10]], expected: 40 },
          ],
          solution: `class Solution {
    public int secondLargest(int[] nums) {
        int first = Integer.MIN_VALUE, second = Integer.MIN_VALUE;
        for (int x : nums) {
            if (x > first) {
                second = first;
                first = x;
            } else if (x > second && x < first) {
                second = x;
            }
        }
        return second;
    }
}`,
          explain: 'One pass, two trackers. When a new maximum arrives, the old maximum becomes the runner-up. The `x < first` check skips duplicates of the max. Sorting works too, but it\'s O(n log n) instead of O(n).',
        },
      ],
    },
    {
      id: 'arrays-2d',
      title: '2D arrays & grids',
      summary: 'Rows, columns, nested loops and neighbours.',
      notes: `
~~~java
int[][] grid = new int[3][4];   // 3 rows, 4 columns, all 0
int[][] m = {{1, 2, 3}, {4, 5, 6}};
int rows = m.length;            // 2
int cols = m[0].length;         // 3
m[1][2]                         // row 1, column 2 is 6
~~~

A 2D array is really an **array of arrays**, so rows can have different lengths ("jagged").

### Visiting every cell
~~~java
for (int r = 0; r < grid.length; r++) {
    for (int c = 0; c < grid[r].length; c++) {
        // grid[r][c]
    }
}
~~~

### Neighbours with a direction table
~~~java
int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
for (int[] d : dirs) {
    int nr = r + d[0], nc = c + d[1];
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        // safe to read grid[nr][nc]
    }
}
~~~

- \`Arrays.deepToString(grid)\` prints nested arrays.
- \`Arrays.toString(grid)\` would print the row references.
`,
      questions: [
        {
          type: 'output',
          code: `int[][] g = {{1, 2, 3}, {4, 5, 6}};
System.out.println(g.length + " " + g[0].length);
System.out.println(g[1][2]);`,
          answer: '2 3\n6',
          explain: '`g.length` counts rows, `g[0].length` counts columns in row 0. `g[1][2]` is row 1, column 2.',
        },
        {
          type: 'output',
          code: `int[][] m = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
int sum = 0;
for (int i = 0; i < m.length; i++) sum += m[i][i];
System.out.println(sum);`,
          answer: '15',
          explain: 'The main diagonal is where row equals column: 1 + 5 + 9.',
        },
        {
          type: 'fill',
          prompt: 'Visit every cell and count the 1s.',
          code: `int[][] grid = {{1, 0, 1}, {0, 1, 1}};
int ones = 0;
for (int r = 0; r < grid.___; r++) {
    for (int c = 0; c < grid[___].length; c++) {
        if (grid[r][c] == 1) ones++;
    }
}
System.out.println(ones);`,
          blanks: [['length'], ['r', '0']],
          expect: '4',
          explain: 'Outer loop over rows (`grid.length`), inner loop over the columns of that row (`grid[r].length`).',
        },
        {
          type: 'mcq',
          prompt: 'For `int[][] grid = new int[3][5];`, how do you get the number of columns?',
          options: ['`grid.length`', '`grid[0].length`', '`grid.length()`', '`grid.columns`'],
          answer: 1,
          explain: '`grid.length` is the number of rows (3). Each row is an `int[]` of length 5, so `grid[0].length` is 5.',
        },
        {
          type: 'bug',
          prompt: 'Calling this on an edge cell crashes with `ArrayIndexOutOfBoundsException`. Which line?',
          code: `static int countNeighbours(int[][] g, int r, int c) {
    int count = 0;
    int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    for (int[] d : dirs) {
        int nr = r + d[0], nc = c + d[1];
        if (g[nr][nc] == 1 && nr >= 0 && nr < g.length && nc >= 0 && nc < g[0].length) count++;
    }
    return count;
}`,
          line: 6,
          fix: 'if (nr >= 0 && nr < g.length && nc >= 0 && nc < g[0].length && g[nr][nc] == 1) count++;',
          explain: 'The grid is read **before** the bounds are checked. Put the bounds checks first so `&&` short-circuits before the out-of-range access.',
        },
        {
          type: 'output',
          code: `int[][] grid = new int[2][3];
grid[1][0] = 5;
System.out.println(Arrays.deepToString(grid));`,
          answer: '[[0, 0, 0], [5, 0, 0]]',
          explain: '`deepToString` walks into the nested arrays. Two rows of three, with the one change at row 1, column 0.',
        },
        {
          type: 'code',
          prompt: 'Return the **transpose** of a matrix: rows become columns. A `2 x 3` input gives a `3 x 2` result.',
          signature: 'int[][] transpose(int[][] matrix)',
          starter: starter('int[][] transpose(int[][] matrix)'),
          tests: [
            { args: [[[1, 2, 3], [4, 5, 6]]], expected: [[1, 4], [2, 5], [3, 6]] },
            { args: [[[1, 2], [3, 4]]], expected: [[1, 3], [2, 4]] },
            { args: [[[7]]], expected: [[7]] },
            { args: [[[1, 2, 3]]], expected: [[1], [2], [3]] },
          ],
          solution: `class Solution {
    public int[][] transpose(int[][] matrix) {
        int rows = matrix.length, cols = matrix[0].length;
        int[][] t = new int[cols][rows];
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                t[c][r] = matrix[r][c];
            }
        }
        return t;
    }
}`,
          explain: 'Allocate `new int[cols][rows]` (swapped), then copy `t[c][r] = matrix[r][c]`. This is LeetCode 867.',
        },
      ],
    },
  ],
};

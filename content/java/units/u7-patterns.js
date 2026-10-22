import { starter } from '../helpers.js';

export default {
  id: 'u7',
  title: 'Big-O & problem patterns',
  blurb: 'How to judge a solution\'s speed, plus the four patterns behind most LeetCode Easy problems.',
  lessons: [
    {
      id: 'big-o',
      title: 'Big-O in practice',
      summary: 'Reading time complexity off code, and the costs of common operations.',
      notes: `
Big-O describes how running time grows as the input size \`n\` grows. Drop constants and keep the biggest term.

| Code shape | Complexity |
|---|---|
| fixed number of steps | O(1) |
| halve the range each step (\`n /= 2\`, binary search) | O(log n) |
| one loop over the input | O(n) |
| sort, then loop | O(n log n) |
| loop inside a loop over the input | O(n²) |
| try every subset | O(2ⁿ) |

### Costs worth memorising
| Operation | Cost |
|---|---|
| \`array[i]\`, \`list.get(i)\` (ArrayList) | O(1) |
| \`list.add(x)\` at the end | O(1) amortised |
| \`list.add(0, x)\`, \`list.remove(0)\` | O(n), everything shifts |
| \`list.contains(x)\`, \`indexOf\` | O(n) |
| \`HashMap\`/\`HashSet\` get, put, contains | O(1) average |
| \`TreeMap\`/\`TreeSet\`, \`PriorityQueue\` offer/poll | O(log n) |
| \`Arrays.sort\`, \`Collections.sort\` | O(n log n) |

> Tip: A rough budget is ~10⁸ simple operations per second. With \`n = 10⁵\`, O(n²) is 10¹⁰, which is too slow. O(n log n) is about 2 × 10⁶, which is fine. Constraints in a problem statement are a hint about which complexity you need.
`,
      questions: [
        {
          type: 'mcq',
          prompt: 'What is the time complexity?',
          code: `int count = 0;
for (int i = 0; i < n; i++) {
    for (int j = i + 1; j < n; j++) {
        if (a[i] == a[j]) count++;
    }
}`,
          options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'],
          answer: 2,
          explain: 'The inner loop runs n-1, n-2, …, 1 times, which sums to about n²/2. Constants drop out, giving O(n²).',
        },
        {
          type: 'mcq',
          prompt: 'What is the time complexity?',
          code: `int steps = 0;
while (n > 1) {
    n = n / 2;
    steps++;
}`,
          options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
          answer: 1,
          explain: 'Halving each time means about log₂(n) iterations. A million needs only around 20 steps.',
        },
        {
          type: 'mcq',
          prompt: '`a` and `b` both have n elements, and `b` is an `ArrayList`. What\'s the complexity, and how could you speed it up?',
          code: `for (int x : a) {
    if (b.contains(x)) common++;
}`,
          options: [
            'O(n). It\'s already optimal',
            'O(n²). Put `b` into a `HashSet` first to get O(n)',
            'O(n log n). Sort `a` first',
            'O(log n). `contains` uses binary search',
          ],
          answer: 1,
          explain: '`ArrayList.contains` scans the whole list (O(n)), and it runs n times. A `HashSet` makes each lookup O(1).',
        },
        {
          type: 'order',
          prompt: 'Order these complexities from **fastest** to **slowest** growth.',
          lines: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'],
          verify: false,
          explain: 'Constant < logarithmic < linear < linearithmic < quadratic < exponential. Most Easy problems want O(n) or O(n log n).',
        },
        {
          type: 'multi',
          prompt: 'Which of these are O(1) on average? Select all that apply.',
          options: ['`hashMap.get(key)`', '`arrayList.get(i)`', '`arrayList.contains(x)`', '`hashSet.add(x)`', '`arrayList.remove(0)`'],
          answers: [0, 1, 3],
          explain: '`contains` scans (O(n)), and `remove(0)` shifts every element left (O(n)). Hash lookups and indexed `get` are O(1).',
        },
        {
          type: 'mcq',
          prompt: 'A problem says `1 <= n <= 10^5`. Which approach is likely to be **too slow**?',
          options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
          answer: 2,
          explain: '(10⁵)² = 10¹⁰ operations, far over the rough 10⁸-per-second budget.',
        },
        {
          type: 'mcq',
          prompt: 'You count letter frequencies with `int[] counts = new int[26]`. What\'s the **extra space** complexity in terms of the input length n?',
          options: ['O(1)', 'O(n)', 'O(26n)', 'O(log n)'],
          answer: 0,
          explain: 'The array is 26 slots no matter how long the input is, so its size is constant. A `HashMap` of all n words, by contrast, would be O(n).',
        },
      ],
    },
    {
      id: 'two-pointers',
      title: 'Two pointers & sliding window',
      summary: 'Linear-time tricks for arrays and strings.',
      notes: `
### Opposite ends: move inward
Great for **sorted** arrays and palindromes.
~~~java
int i = 0, j = a.length - 1;
while (i < j) {
    int sum = a[i] + a[j];
    if (sum == target) return true;
    if (sum < target) i++;   // need bigger: move left pointer right
    else j--;                // need smaller: move right pointer left
}
~~~

### Same direction: reader and writer
Compact an array in place, like removing duplicates or moving zeroes.
~~~java
int write = 0;
for (int read = 0; read < a.length; read++) {
    if (keep(a[read])) a[write++] = a[read];
}
~~~

### Sliding window
A window \`[left, right]\` slides across the array. You update a running total instead of re-summing.
~~~java
int window = 0, best = Integer.MIN_VALUE;
for (int right = 0; right < a.length; right++) {
    window += a[right];                       // grow on the right
    if (right >= k) window -= a[right - k];   // shrink on the left
    if (right >= k - 1) best = Math.max(best, window);
}
~~~

> LeetCode: Valid Palindrome, Two Sum II, Remove Duplicates, Move Zeroes, Merge Sorted Array, Squares of a Sorted Array and Best Time to Buy and Sell Stock are all variations of these.
`,
      questions: [
        {
          type: 'output',
          code: `int[] a = {1, 3, 4, 6, 9};
int target = 13;
int i = 0, j = a.length - 1;
while (i < j) {
    int sum = a[i] + a[j];
    if (sum == target) break;
    if (sum < target) i++;
    else j--;
}
System.out.println(a[i] + " + " + a[j]);`,
          answer: '4 + 9',
          explain: '1+9=10 is too small, so i++. 3+9=12 is too small, i++ again. 4+9=13 is found.',
        },
        {
          type: 'fill',
          prompt: 'Finish the palindrome check.',
          code: `static boolean isPal(String s) {
    int l = 0, r = s.length() - 1;
    while (l < r) {
        if (s.charAt(l) != s.charAt(r)) return false;
        ___;
        ___;
    }
    return true;
}`,
          teardown: 'System.out.println(isPal("level") + " " + isPal("levels"));',
          blanks: [['l++', '++l', 'l += 1'], ['r--', '--r', 'r -= 1']],
          expect: 'true false',
          explain: 'After comparing a matching pair, both pointers move one step toward the middle.',
        },
        {
          type: 'mcq',
          prompt: 'Why does the opposite-ends "find a pair with this sum" technique need the array to be **sorted**?',
          options: [
            'So the pointers never cross',
            'Because moving `i` right must increase the sum and moving `j` left must decrease it',
            'Sorting removes duplicates',
            'It doesn\'t. It works on any array',
          ],
          answer: 1,
          explain: 'The whole decision ("too small, move left pointer up") relies on order. On unsorted data, use a HashSet of complements instead (next lesson).',
        },
        {
          type: 'output',
          code: `int[] a = {2, 1, 5, 1, 3, 2};
int k = 3, window = 0, best = 0;
for (int i = 0; i < a.length; i++) {
    window += a[i];
    if (i >= k) window -= a[i - k];
    if (i >= k - 1) best = Math.max(best, window);
}
System.out.println(best);`,
          answer: '9',
          explain: 'Windows of 3: [2,1,5]=8, [1,5,1]=7, [5,1,3]=9, [1,3,2]=6. Each step adds one element and removes one, so the work is O(n), not O(n·k).',
        },
        {
          type: 'order',
          prompt: 'Arrange the reader/writer loop that removes duplicates from a **sorted** array in place.',
          setup: 'int[] nums = {1, 1, 2, 3, 3, 3, 4};',
          lines: [
            'int write = 1;',
            'for (int read = 1; read < nums.length; read++) {',
            '    if (nums[read] != nums[read - 1]) {',
            '        nums[write] = nums[read];',
            '        write++;',
            '    }',
            '}',
          ],
          teardown: 'System.out.println(write + " " + Arrays.toString(Arrays.copyOf(nums, write)));',
          expect: '4 [1, 2, 3, 4]',
          explain: '`read` scans everything. `write` marks where the next unique value goes. Since the array is sorted, a value is new exactly when it differs from its left neighbour.',
        },
        {
          type: 'code',
          prompt: 'Return the maximum sum of any `k` **consecutive** elements. `1 <= k <= nums.length`.',
          signature: 'int maxSumOfK(int[] nums, int k)',
          starter: starter('int maxSumOfK(int[] nums, int k)'),
          tests: [
            { args: [[2, 1, 5, 1, 3, 2], 3], expected: 9 },
            { args: [[5], 1], expected: 5 },
            { args: [[-1, -2, -3], 2], expected: -3 },
            { args: [[1, 2, 3, 4], 4], expected: 10 },
            { args: [[4, -1, 2, 1, -5, 4], 2], expected: 3 },
          ],
          solution: `class Solution {
    public int maxSumOfK(int[] nums, int k) {
        int window = 0;
        for (int i = 0; i < k; i++) window += nums[i];
        int best = window;
        for (int i = k; i < nums.length; i++) {
            window += nums[i] - nums[i - k];
            best = Math.max(best, window);
        }
        return best;
    }
}`,
          explain: 'Sum the first window, then slide: add the new right element and subtract the one falling off the left. Starting `best` from the first window (not 0) handles negative numbers.',
        },
        {
          type: 'code',
          prompt: 'Merge two **sorted** arrays into one new sorted array.',
          signature: 'int[] mergeSorted(int[] a, int[] b)',
          starter: starter('int[] mergeSorted(int[] a, int[] b)'),
          tests: [
            { args: [[1, 3, 5], [2, 4, 6]], expected: [1, 2, 3, 4, 5, 6] },
            { args: [[], [1, 2]], expected: [1, 2] },
            { args: [[1, 2], []], expected: [1, 2] },
            { args: [[1, 1, 4], [1, 9]], expected: [1, 1, 1, 4, 9] },
            { args: [[-3, 0], [-5, 10, 20]], expected: [-5, -3, 0, 10, 20] },
          ],
          solution: `class Solution {
    public int[] mergeSorted(int[] a, int[] b) {
        int[] out = new int[a.length + b.length];
        int i = 0, j = 0, k = 0;
        while (i < a.length && j < b.length) {
            if (a[i] <= b[j]) out[k++] = a[i++];
            else out[k++] = b[j++];
        }
        while (i < a.length) out[k++] = a[i++];
        while (j < b.length) out[k++] = b[j++];
        return out;
    }
}`,
          explain: 'One pointer per array: always take the smaller front element. When one array runs out, copy the rest of the other. O(n + m), and it\'s the heart of merge sort.',
        },
      ],
    },
    {
      id: 'hashing-patterns',
      title: 'Hashing patterns',
      summary: 'Seen-sets, complement lookups and frequency tables.',
      notes: `
When the brute force is "for each element, scan the others" (O(n²)), ask: **what could I remember in a set or map so that each lookup is O(1)?**

### Seen-before
~~~java
Set<Integer> seen = new HashSet<>();
for (int x : nums) {
    if (!seen.add(x)) return true;   // duplicate found
}
~~~

### Complement lookup (the Two Sum idea)
~~~java
Map<Integer, Integer> indexOf = new HashMap<>();
for (int i = 0; i < nums.length; i++) {
    int need = target - nums[i];
    if (indexOf.containsKey(need)) return new int[]{indexOf.get(need), i};
    indexOf.put(nums[i], i);
}
~~~

### Frequency tables
- Lowercase letters only? Use \`int[26]\`.
- Anything else? Use \`Map<T, Integer>\` with \`getOrDefault\` or \`merge\`.
- **Anagrams**: same frequency table. Or same sorted characters.
- **Group by key**: \`map.computeIfAbsent(key, k -> new ArrayList<>()).add(item)\`.
`,
      questions: [
        {
          type: 'mcq',
          prompt: 'Brute-force Two Sum checks every pair: O(n²). What does a single pass with a `HashMap` of value to index achieve?',
          options: ['O(n log n) time', 'O(n) time, O(n) extra space', 'O(1) time', 'O(n) time, O(1) space'],
          answer: 1,
          explain: 'Each element does one O(1) lookup for its complement and one insert. You trade O(n) memory for going from quadratic to linear time.',
        },
        {
          type: 'fill',
          prompt: 'Complete the one-pass complement lookup.',
          code: `int[] nums = {3, 8, 11, 5};
int target = 16;
Map<Integer, Integer> seen = new HashMap<>();
for (int i = 0; i < nums.length; i++) {
    int need = target - nums[i];
    if (seen.___(need)) {
        System.out.println(seen.get(need) + "," + i);
        break;
    }
    seen.put(nums[i], ___);
}`,
          blanks: [['containsKey'], ['i']],
          expect: '2,3',
          explain: 'Ask "have I already seen the number that completes this pair?", then record the current value with its index. 11 + 5 = 16.',
        },
        {
          type: 'output',
          code: `String a = "listen", b = "silent";
int[] count = new int[26];
for (char c : a.toCharArray()) count[c - 'a']++;
for (char c : b.toCharArray()) count[c - 'a']--;
boolean same = true;
for (int x : count) if (x != 0) same = false;
System.out.println(same);`,
          answer: 'true',
          explain: 'Add for one word, subtract for the other. Anagrams cancel out to all zeros.',
        },
        {
          type: 'mcq',
          prompt: 'When is `int[] counts = new int[26]` a better choice than `HashMap<Character, Integer>`?',
          options: [
            'Always',
            'When the input is only lowercase English letters',
            'When the input contains Unicode emoji',
            'When you need the keys sorted by frequency',
          ],
          answer: 1,
          explain: 'A fixed array is faster and simpler, but only when the key range is small and known. For arbitrary characters, use a map.',
        },
        {
          type: 'output',
          code: `String[] words = {"eat", "tea", "tan", "ate", "nat"};
Map<String, List<String>> groups = new TreeMap<>();
for (String w : words) {
    char[] cs = w.toCharArray();
    Arrays.sort(cs);
    String key = new String(cs);
    groups.computeIfAbsent(key, k -> new ArrayList<>()).add(w);
}
System.out.println(groups);`,
          answer: '{aet=[eat, tea, ate], ant=[tan, nat]}',
          explain: 'Anagrams share the same sorted letters, so that becomes the grouping key. `computeIfAbsent` creates each list the first time a key appears.',
        },
        {
          type: 'bug',
          prompt: 'Both maps hold 1000 for "x", yet this prints `different`. Which line?',
          code: `Map<String, Integer> a = new HashMap<>(), b = new HashMap<>();
a.put("x", 1000);
b.put("x", 1000);
if (a.get("x") == b.get("x")) System.out.println("same");
else System.out.println("different");`,
          line: 4,
          fix: 'if (a.get("x").equals(b.get("x"))) System.out.println("same");',
          expect: 'same',
          explain: 'Map values are `Integer` **objects**. `==` compares references, which only coincidentally match for -128..127. This bug hides in tests with small numbers and appears with big ones.',
        },
        {
          type: 'code',
          prompt: 'Return how many **distinct** values are in `nums`.',
          signature: 'int countDistinct(int[] nums)',
          starter: starter('int countDistinct(int[] nums)', { imports: true }),
          tests: [
            { args: [[1, 2, 2, 3, 3, 3]], expected: 3 },
            { args: [[]], expected: 0 },
            { args: [[7, 7, 7]], expected: 1 },
            { args: [[-1, 1, -1, 1, 0]], expected: 3 },
          ],
          solution: `import java.util.*;

class Solution {
    public int countDistinct(int[] nums) {
        Set<Integer> set = new HashSet<>();
        for (int x : nums) set.add(x);
        return set.size();
    }
}`,
          explain: 'A set ignores duplicates, so its size is the answer. That\'s O(n). (Sorting and counting changes also works, in O(n log n).)',
        },
      ],
    },
    {
      id: 'binary-search',
      title: 'Binary search',
      summary: 'Halving the search space, and the off-by-one details.',
      notes: `
On a **sorted** array, look at the middle and throw away the half that can't contain the answer. That's O(log n).

~~~java
int lo = 0, hi = nums.length - 1;
while (lo <= hi) {                      // <= so a 1-element range is checked
    int mid = lo + (hi - lo) / 2;       // avoids overflow of (lo + hi)
    if (nums[mid] == target) return mid;
    if (nums[mid] < target) lo = mid + 1;   // answer is to the right
    else hi = mid - 1;                      // answer is to the left
}
return -1;   // when not found, lo is where target WOULD be inserted
~~~

- Always move **past** \`mid\` (\`mid + 1\` / \`mid - 1\`). Using \`lo = mid\` can loop forever.
- After the loop, \`lo\` is the first index whose value is ≥ target. That's the "insert position" (LeetCode 35).
- **Binary search on the answer**: if you can ask "is x big enough?" and the answer flips from no to yes exactly once, you can binary search x itself, even without an array (e.g. integer square root).
- \`Arrays.binarySearch(arr, key)\` exists too.
`,
      questions: [
        {
          type: 'order',
          prompt: 'Assemble a binary search that returns the index of `target`, or `-1`.',
          setup: 'static int search(int[] nums, int target) {',
          lines: [
            'int lo = 0, hi = nums.length - 1;',
            'while (lo <= hi) {',
            '    int mid = lo + (hi - lo) / 2;',
            '    if (nums[mid] == target) return mid;',
            '    if (nums[mid] < target) lo = mid + 1;',
            '    else hi = mid - 1;',
            '}',
            'return -1;',
          ],
          teardown: '}\nSystem.out.println(search(new int[]{1, 3, 5, 7, 9}, 7) + " " + search(new int[]{1, 3, 5}, 4));',
          expect: '3 -1',
          explain: 'Compute `mid`, check for a hit, then discard the half that can\'t contain the target. `-1` comes only after the range is empty.',
        },
        {
          type: 'output',
          code: `int[] a = {2, 5, 8, 12, 16, 23, 38, 56, 72, 91};
int lo = 0, hi = a.length - 1, steps = 0;
while (lo <= hi) {
    steps++;
    int mid = lo + (hi - lo) / 2;
    if (a[mid] == 23) break;
    if (a[mid] < 23) lo = mid + 1;
    else hi = mid - 1;
}
System.out.println(steps);`,
          answer: '3',
          explain: 'Step 1: mid=4 (16), too small, so lo=5. Step 2: mid=7 (56), too big, so hi=6. Step 3: mid=5 (23), found. A linear scan would take 6 steps.',
        },
        {
          type: 'mcq',
          prompt: 'Why write `lo + (hi - lo) / 2` instead of `(lo + hi) / 2`?',
          options: ['It\'s faster', '`lo + hi` can overflow `int` for large indexes', 'It rounds up instead of down', 'Java requires it'],
          answer: 1,
          explain: 'If `lo` and `hi` are both above ~1.07 billion, their sum exceeds `Integer.MAX_VALUE` and wraps negative. The subtraction form never overflows.',
        },
        {
          type: 'mcq',
          prompt: 'About how many comparisons does binary search need, at most, on 1,000,000 sorted elements?',
          options: ['About 20', 'About 1,000', 'About 500,000', 'About 1,000,000'],
          answer: 0,
          explain: 'log₂(1,000,000) ≈ 20. Each comparison halves what\'s left.',
        },
        {
          type: 'bug',
          prompt: 'Searching for a value that is larger than `nums[mid]` can make this loop forever. Which line?',
          code: `static int search(int[] nums, int target) {
    int lo = 0, hi = nums.length - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) lo = mid;
        else hi = mid - 1;
    }
    return -1;
}`,
          line: 6,
          fix: 'if (nums[mid] < target) lo = mid + 1;',
          explain: 'With `lo = mid`, a two-element range where `mid == lo` never shrinks. `mid` is already ruled out, so skip past it.',
        },
        {
          type: 'code',
          prompt: 'Return the integer square root of `x` (rounded down), **without** `Math.sqrt`. `x` can be as large as `Integer.MAX_VALUE`.',
          signature: 'int mySqrt(int x)',
          starter: starter('int mySqrt(int x)'),
          tests: [
            { args: [0], expected: 0 },
            { args: [1], expected: 1 },
            { args: [4], expected: 2 },
            { args: [8], expected: 2 },
            { args: [15], expected: 3 },
            { args: [16], expected: 4 },
            { args: [2147395599], expected: 46339 },
            { args: [2147483647], expected: 46340 },
          ],
          solution: `class Solution {
    public int mySqrt(int x) {
        long lo = 0, hi = x;
        while (lo <= hi) {
            long mid = lo + (hi - lo) / 2;
            if (mid * mid <= x) lo = mid + 1;
            else hi = mid - 1;
        }
        return (int) hi;
    }
}`,
          explain: 'Binary search on the answer: is `mid * mid <= x`? Use `long` because `mid * mid` overflows `int`. When the loop ends, `hi` is the largest value whose square fits. This is LeetCode 69.',
        },
      ],
    },
  ],
};

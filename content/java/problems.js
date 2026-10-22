// The problem set: warm-ups building to classic LeetCode Easy problems.
// Problem statements are written in our own words; `leetcode` gives the original number for reference.
import { starter, inPlace, firstK, LISTNODE_HEADER, TREENODE_HEADER } from './helpers.js';

const P = (o) => ({ ...o, starter: o.starter || starter(o.signature, { header: o.header || '' }) });

export default [
  // ---------------- loops & basics ----------------
  P({
    id: 'fizzbuzz',
    title: 'Fizz Buzz',
    leetcode: 412,
    topic: 'Loops',
    difficulty: 'warmup',
    after: 'loops',
    blurb: 'Multiples of 3 and 5, the interview classic.',
    description: `
Return a list of strings for each number from \`1\` to \`n\`:

- multiples of both 3 and 5 become \`"FizzBuzz"\`
- multiples of 3 become \`"Fizz"\`
- multiples of 5 become \`"Buzz"\`
- everything else is the number itself, as a string
`,
    constraints: '- `1 <= n <= 10^4`',
    signature: 'List<String> fizzBuzz(int n)',
    tests: [
      { args: [3], expected: ['1', '2', 'Fizz'] },
      { args: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'] },
      { args: [15], expected: ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz'] },
      { args: [1], expected: ['1'] },
    ],
    hints: [
      'Check the "both" case **first**. If you test `% 3` first, 15 would become "Fizz".',
      '`String.valueOf(i)` turns a number into a String.',
    ],
    solution: `import java.util.*;

class Solution {
    public List<String> fizzBuzz(int n) {
        List<String> out = new ArrayList<>();
        for (int i = 1; i <= n; i++) {
            if (i % 15 == 0) out.add("FizzBuzz");
            else if (i % 3 == 0) out.add("Fizz");
            else if (i % 5 == 0) out.add("Buzz");
            else out.add(String.valueOf(i));
        }
        return out;
    }
}`,
    complexity: 'O(n) time',
    explain: 'The order of the checks matters: divisible by 15 (both) must be tested before 3 or 5 alone.',
  }),
  P({
    id: 'palindrome-number',
    title: 'Palindrome Number',
    leetcode: 9,
    topic: 'Loops',
    difficulty: 'warmup',
    after: 'loop-patterns',
    blurb: 'Does an integer read the same backwards? Without converting it to a String.',
    description: `
Return \`true\` if the integer \`x\` reads the same forwards and backwards.

Try it **without** turning the number into a String: peel digits off with \`% 10\` and \`/ 10\`.
`,
    constraints: '- `-2^31 <= x <= 2^31 - 1`',
    signature: 'boolean isPalindrome(int x)',
    tests: [
      { args: [121], expected: true },
      { args: [-121], expected: false, why: 'Backwards it is `121-`.' },
      { args: [10], expected: false },
      { args: [0], expected: true },
      { args: [1221], expected: true },
      { args: [123], expected: false },
      { args: [2147447412], expected: true },
    ],
    hints: [
      'Negative numbers can never be palindromes.',
      'Build the reversed number: `rev = rev * 10 + x % 10`, then `x /= 10`. Use a `long` for `rev` to be safe from overflow.',
    ],
    solution: `class Solution {
    public boolean isPalindrome(int x) {
        if (x < 0) return false;
        long rev = 0;
        int n = x;
        while (n > 0) {
            rev = rev * 10 + n % 10;
            n /= 10;
        }
        return rev == x;
    }
}`,
    complexity: 'O(log x) time (one step per digit), O(1) space',
    explain: 'Reverse the digits arithmetically and compare. Using `long` for the reversed value means a big reversed number can never overflow.',
  }),
  P({
    id: 'max-consecutive-ones',
    title: 'Max Consecutive Ones',
    leetcode: 485,
    topic: 'Arrays',
    difficulty: 'warmup',
    after: 'arrays-basics',
    blurb: 'The longest run of 1s in a binary array.',
    description: 'Given an array containing only `0`s and `1`s, return the length of the longest run of consecutive `1`s.',
    constraints: '- `1 <= nums.length <= 10^5`\n- `nums[i]` is `0` or `1`',
    signature: 'int findMaxConsecutiveOnes(int[] nums)',
    tests: [
      { args: [[1, 1, 0, 1, 1, 1]], expected: 3 },
      { args: [[1, 0, 1, 1, 0, 1]], expected: 2 },
      { args: [[0]], expected: 0 },
      { args: [[1]], expected: 1 },
      { args: [[0, 0, 1, 1, 1, 1]], expected: 4 },
    ],
    hints: ['Keep a `current` run length and a `best`. A 0 resets `current` to 0.'],
    solution: `class Solution {
    public int findMaxConsecutiveOnes(int[] nums) {
        int current = 0, best = 0;
        for (int x : nums) {
            current = (x == 1) ? current + 1 : 0;
            best = Math.max(best, current);
        }
        return best;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'One pass: grow the current streak on a 1, reset it on a 0, and remember the best streak seen.',
  }),
  P({
    id: 'running-sum',
    title: 'Running Sum of an Array',
    leetcode: 1480,
    topic: 'Arrays',
    difficulty: 'warmup',
    after: 'array-algorithms',
    blurb: 'Each element becomes the total so far.',
    description: 'Return an array where element `i` is the sum of `nums[0]` through `nums[i]`.',
    constraints: '- `1 <= nums.length <= 1000`',
    signature: 'int[] runningSum(int[] nums)',
    tests: [
      { args: [[1, 2, 3, 4]], expected: [1, 3, 6, 10], why: '`[1, 1+2, 1+2+3, 1+2+3+4]`' },
      { args: [[1, 1, 1, 1, 1]], expected: [1, 2, 3, 4, 5] },
      { args: [[3, 1, 2, 10, 1]], expected: [3, 4, 6, 16, 17] },
      { args: [[5]], expected: [5] },
    ],
    hints: ['Each answer is the previous answer plus the current element.'],
    solution: `class Solution {
    public int[] runningSum(int[] nums) {
        int[] out = new int[nums.length];
        int sum = 0;
        for (int i = 0; i < nums.length; i++) {
            sum += nums[i];
            out[i] = sum;
        }
        return out;
    }
}`,
    complexity: 'O(n) time',
    explain: 'This is a prefix sum. You could even do it in place: `nums[i] += nums[i - 1]` for `i` from 1.',
  }),
  P({
    id: 'reverse-string',
    title: 'Reverse String',
    leetcode: 344,
    topic: 'Two pointers',
    difficulty: 'warmup',
    after: 'array-algorithms',
    blurb: 'Reverse a char array in place.',
    description: 'Reverse the array of characters `s` **in place**: modify the input array and don\'t create a new one. The method returns nothing, and the tests check `s` afterwards.',
    constraints: '- `1 <= s.length <= 10^5`',
    signature: 'void reverseString(char[] s)',
    check: inPlace(0),
    tests: [
      { args: [['h', 'e', 'l', 'l', 'o']], expected: ['o', 'l', 'l', 'e', 'h'] },
      { args: [['H', 'a', 'n', 'n', 'a', 'h']], expected: ['h', 'a', 'n', 'n', 'a', 'H'] },
      { args: [['x']], expected: ['x'] },
      { args: [['a', 'b']], expected: ['b', 'a'] },
    ],
    hints: ['Swap `s[left]` and `s[right]`, then move both pointers toward the middle.'],
    solution: `class Solution {
    public void reverseString(char[] s) {
        for (int l = 0, r = s.length - 1; l < r; l++, r--) {
            char tmp = s[l];
            s[l] = s[r];
            s[r] = tmp;
        }
    }
}`,
    complexity: 'O(n) time, O(1) extra space',
    explain: 'Classic two-pointer swap. Stop when the pointers meet, otherwise you\'d reverse everything back again.',
  }),
  P({
    id: 'plus-one',
    title: 'Plus One',
    leetcode: 66,
    topic: 'Arrays',
    difficulty: 'easy',
    after: 'array-algorithms',
    blurb: 'Add one to a number stored as an array of digits.',
    description: `
A non-negative integer is stored as an array of digits, most significant digit first (\`[1, 2, 3]\` means 123). There are no leading zeros.

Return the digits of that number **plus one**.
`,
    constraints: '- `1 <= digits.length <= 100`\n- `0 <= digits[i] <= 9`',
    signature: 'int[] plusOne(int[] digits)',
    tests: [
      { args: [[1, 2, 3]], expected: [1, 2, 4] },
      { args: [[4, 3, 2, 1]], expected: [4, 3, 2, 2] },
      { args: [[9]], expected: [1, 0], why: '9 + 1 = 10, which needs an extra digit.' },
      { args: [[9, 9, 9]], expected: [1, 0, 0, 0] },
      { args: [[1, 9]], expected: [2, 0] },
    ],
    hints: [
      'Walk from the last digit. If it\'s less than 9, add one and you\'re done.',
      'A 9 becomes 0 and the carry moves left. If you fall off the front, every digit was 9, so the answer is `1` followed by zeros.',
    ],
    solution: `class Solution {
    public int[] plusOne(int[] digits) {
        for (int i = digits.length - 1; i >= 0; i--) {
            if (digits[i] < 9) {
                digits[i]++;
                return digits;
            }
            digits[i] = 0;
        }
        int[] out = new int[digits.length + 1];
        out[0] = 1;
        return out;
    }
}`,
    complexity: 'O(n) time',
    explain: 'Converting to an `int` would overflow (100 digits!). Instead, simulate the carry by hand. A new array is only needed for the all-nines case, and Java zero-fills it for free.',
  }),
  P({
    id: 'missing-number',
    title: 'Missing Number',
    leetcode: 268,
    topic: 'Arrays',
    difficulty: 'easy',
    after: 'array-algorithms',
    blurb: 'One number from 0..n is missing. Which?',
    description: 'The array `nums` holds `n` **distinct** numbers taken from the range `0..n`. Exactly one number from that range is missing. Return it.',
    constraints: '- `1 <= n <= 10^4`\n- all numbers are unique',
    signature: 'int missingNumber(int[] nums)',
    tests: [
      { args: [[3, 0, 1]], expected: 2 },
      { args: [[0, 1]], expected: 2 },
      { args: [[9, 6, 4, 2, 3, 5, 7, 0, 1]], expected: 8 },
      { args: [[0]], expected: 1 },
      { args: [[1]], expected: 0 },
    ],
    hints: [
      'What is 0 + 1 + … + n? (Gauss: `n * (n + 1) / 2`.)',
      'The missing number is the expected total minus the actual total.',
    ],
    solution: `class Solution {
    public int missingNumber(int[] nums) {
        int n = nums.length;
        int expected = n * (n + 1) / 2;
        int actual = 0;
        for (int x : nums) actual += x;
        return expected - actual;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'The sum trick avoids sorting (O(n log n)) and avoids a set (O(n) space). A neat alternative: XOR all indexes and values together, and the pairs cancel out.',
  }),
  P({
    id: 'pivot-index',
    title: 'Find Pivot Index',
    leetcode: 724,
    topic: 'Prefix sums',
    difficulty: 'easy',
    after: 'array-algorithms',
    blurb: 'Where is the left sum equal to the right sum?',
    description: `
Return the **leftmost** index \`i\` where the sum of everything strictly left of \`i\` equals the sum of everything strictly right of \`i\`. Return \`-1\` if there's no such index.

At the edges, the "empty side" counts as 0.
`,
    constraints: '- `1 <= nums.length <= 10^4`\n- `-1000 <= nums[i] <= 1000`',
    signature: 'int pivotIndex(int[] nums)',
    tests: [
      { args: [[1, 7, 3, 6, 5, 6]], expected: 3, why: 'Left: 1 + 7 + 3 = 11. Right: 5 + 6 = 11.' },
      { args: [[1, 2, 3]], expected: -1 },
      { args: [[2, 1, -1]], expected: 0, why: 'Left of index 0 is empty (0). Right is 1 + -1 = 0.' },
      { args: [[0]], expected: 0 },
      { args: [[-1, -1, 0, 1, 1, 0]], expected: 5 },
    ],
    hints: [
      'Compute the total once.',
      'Walking left to right with a running `left` sum, the right sum is `total - left - nums[i]`.',
    ],
    solution: `class Solution {
    public int pivotIndex(int[] nums) {
        int total = 0;
        for (int x : nums) total += x;
        int left = 0;
        for (int i = 0; i < nums.length; i++) {
            if (left == total - left - nums[i]) return i;
            left += nums[i];
        }
        return -1;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'A two-loop brute force (re-summing both sides for each index) is O(n²). Knowing the total lets you get the right-hand sum in O(1).',
  }),
  // ---------------- strings ----------------
  P({
    id: 'length-of-last-word',
    title: 'Length of Last Word',
    leetcode: 58,
    topic: 'Strings',
    difficulty: 'warmup',
    after: 'string-api',
    blurb: 'Words separated by spaces. How long is the last one?',
    description: 'A string `s` contains words separated by one or more spaces (and maybe leading or trailing spaces). Return the length of the **last** word.',
    constraints: '- `1 <= s.length <= 10^4`\n- `s` has at least one word',
    signature: 'int lengthOfLastWord(String s)',
    tests: [
      { args: ['Hello World'], expected: 5 },
      { args: ['   fly me   to   the moon  '], expected: 4 },
      { args: ['luffy is still joyboy'], expected: 6 },
      { args: ['a'], expected: 1 },
      { args: ['day '], expected: 3 },
    ],
    hints: [
      'Start at the end and skip trailing spaces.',
      'Then count characters until you hit a space or the start of the string.',
    ],
    solution: `class Solution {
    public int lengthOfLastWord(String s) {
        int i = s.length() - 1;
        while (i >= 0 && s.charAt(i) == ' ') i--;
        int len = 0;
        while (i >= 0 && s.charAt(i) != ' ') {
            len++;
            i--;
        }
        return len;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'Scanning from the end touches only what\'s needed. `s.trim().split(" +")` also works, but it allocates a whole array of words.',
  }),
  P({
    id: 'longest-common-prefix',
    title: 'Longest Common Prefix',
    leetcode: 14,
    topic: 'Strings',
    difficulty: 'easy',
    after: 'string-api',
    blurb: 'The longest start shared by every string.',
    description: 'Return the longest prefix that **all** strings in the array share. If there is none, return `""`.',
    constraints: '- `1 <= strs.length <= 200`\n- strings are lowercase letters, possibly empty',
    signature: 'String longestCommonPrefix(String[] strs)',
    tests: [
      { args: [['flower', 'flow', 'flight']], expected: 'fl' },
      { args: [['dog', 'racecar', 'car']], expected: '' },
      { args: [['a']], expected: 'a' },
      { args: [['ab', 'ab']], expected: 'ab' },
      { args: [['', 'b']], expected: '' },
      { args: [['interview', 'internet', 'interval']], expected: 'inter' },
    ],
    hints: [
      'Check column by column: position 0 of every string, then position 1, and so on.',
      'Stop at the first position where some string is too short or has a different character.',
    ],
    solution: `class Solution {
    public String longestCommonPrefix(String[] strs) {
        String first = strs[0];
        for (int i = 0; i < first.length(); i++) {
            char c = first.charAt(i);
            for (String s : strs) {
                if (i >= s.length() || s.charAt(i) != c) return first.substring(0, i);
            }
        }
        return first;
    }
}`,
    complexity: 'O(total characters) time',
    explain: 'Vertical scanning: compare one column of characters at a time against the first string, and cut at the first disagreement.',
  }),
  P({
    id: 'add-binary',
    title: 'Add Binary',
    leetcode: 67,
    topic: 'Strings',
    difficulty: 'easy',
    after: 'stringbuilder',
    blurb: 'Add two binary numbers given as strings.',
    description: 'Given two binary strings, return their sum as a binary string. The inputs can be up to 10⁴ digits long, so converting them to an `int` or `long` won\'t work.',
    constraints: '- `1 <= a.length, b.length <= 10^4`\n- no leading zeros except the number "0" itself',
    signature: 'String addBinary(String a, String b)',
    tests: [
      { args: ['11', '1'], expected: '100' },
      { args: ['1010', '1011'], expected: '10101' },
      { args: ['0', '0'], expected: '0' },
      { args: ['1111', '1'], expected: '10000' },
      { args: ['1', '111'], expected: '1000' },
    ],
    hints: [
      'Add from the right, like by hand. Keep a `carry`.',
      'Each step: `sum = carry + digitA + digitB`. Append `sum % 2` and set `carry = sum / 2`. Reverse the StringBuilder at the end.',
    ],
    solution: `class Solution {
    public String addBinary(String a, String b) {
        StringBuilder sb = new StringBuilder();
        int i = a.length() - 1, j = b.length() - 1, carry = 0;
        while (i >= 0 || j >= 0 || carry > 0) {
            int sum = carry;
            if (i >= 0) sum += a.charAt(i--) - '0';
            if (j >= 0) sum += b.charAt(j--) - '0';
            sb.append(sum % 2);
            carry = sum / 2;
        }
        return sb.reverse().toString();
    }
}`,
    complexity: 'O(max(n, m)) time',
    explain: 'Schoolbook addition in base 2. `c - \'0\'` turns a digit character into 0 or 1. Appending then reversing is cheaper than inserting at the front each time.',
  }),
  // ---------------- hash maps & sets ----------------
  P({
    id: 'contains-duplicate',
    title: 'Contains Duplicate',
    leetcode: 217,
    topic: 'Hashing',
    difficulty: 'warmup',
    after: 'hashmap-set',
    blurb: 'Does any value appear twice?',
    description: 'Return `true` if any value appears at least twice in `nums`, and `false` if every element is distinct.',
    constraints: '- `1 <= nums.length <= 10^5`',
    signature: 'boolean containsDuplicate(int[] nums)',
    tests: [
      { args: [[1, 2, 3, 1]], expected: true },
      { args: [[1, 2, 3, 4]], expected: false },
      { args: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expected: true },
      { args: [[5]], expected: false },
      { args: [[-1, 1]], expected: false },
    ],
    hints: ['A `HashSet`\'s `add` returns `false` when the value was already there.'],
    solution: `import java.util.*;

class Solution {
    public boolean containsDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int x : nums) {
            if (!seen.add(x)) return true;
        }
        return false;
    }
}`,
    complexity: 'O(n) time, O(n) space',
    explain: 'The "seen-before" pattern. Alternatives: sort and compare neighbours (O(n log n), O(1) extra space), or brute-force pairs (O(n²), too slow for 10⁵).',
  }),
  P({
    id: 'majority-element',
    title: 'Majority Element',
    leetcode: 169,
    topic: 'Hashing',
    difficulty: 'easy',
    after: 'hashmap-set',
    blurb: 'The value that appears more than n/2 times.',
    description: 'Return the element that appears **more than** `n / 2` times. Such an element is guaranteed to exist.',
    constraints: '- `1 <= nums.length <= 5 * 10^4`',
    signature: 'int majorityElement(int[] nums)',
    tests: [
      { args: [[3, 2, 3]], expected: 3 },
      { args: [[2, 2, 1, 1, 1, 2, 2]], expected: 2 },
      { args: [[1]], expected: 1 },
      { args: [[6, 5, 5]], expected: 5 },
      { args: [[-1, 4, -1, -1]], expected: -1 },
    ],
    hints: [
      'A frequency map works: count everything, then find the count above n/2.',
      'Bonus: Boyer–Moore voting does it in O(1) space. Keep a candidate and a counter that goes up when you see the candidate and down otherwise.',
    ],
    solution: `class Solution {
    public int majorityElement(int[] nums) {
        int candidate = 0, count = 0;
        for (int x : nums) {
            if (count == 0) candidate = x;
            count += (x == candidate) ? 1 : -1;
        }
        return candidate;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'Boyer–Moore voting: pair each majority vote against a different vote, and they cancel out. Because the majority has more than half the votes, it\'s the one left standing. A `HashMap` count is a perfectly good O(n) answer too.',
  }),
  P({
    id: 'single-number',
    title: 'Single Number',
    leetcode: 136,
    topic: 'Hashing',
    difficulty: 'easy',
    after: 'hashmap-set',
    blurb: 'Everything appears twice except one.',
    description: 'Every element appears exactly **twice** except one, which appears once. Return that one.',
    constraints: '- `1 <= nums.length <= 3 * 10^4`',
    signature: 'int singleNumber(int[] nums)',
    tests: [
      { args: [[2, 2, 1]], expected: 1 },
      { args: [[4, 1, 2, 1, 2]], expected: 4 },
      { args: [[1]], expected: 1 },
      { args: [[-3, 7, 7]], expected: -3 },
    ],
    hints: [
      'A set works: add on first sight, remove on second sight. The one left over is the answer.',
      'Bonus trick: `x ^ x == 0` and `x ^ 0 == x`. What happens if you XOR everything together?',
    ],
    solution: `class Solution {
    public int singleNumber(int[] nums) {
        int result = 0;
        for (int x : nums) result ^= x;
        return result;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'XOR is its own inverse and order doesn\'t matter, so every pair cancels to 0, leaving only the single value. The `HashSet` approach is O(n) space but just as valid.',
  }),
  P({
    id: 'roman-to-integer',
    title: 'Roman to Integer',
    leetcode: 13,
    topic: 'Hashing',
    difficulty: 'easy',
    after: 'hashmap-set',
    blurb: 'MCMXCIV → 1994.',
    description: `
Convert a Roman numeral to an integer. Values: \`I=1, V=5, X=10, L=50, C=100, D=500, M=1000\`.

Normally symbols go from largest to smallest and add up. But when a smaller symbol comes **before** a larger one, it's subtracted: \`IV = 4\`, \`IX = 9\`, \`XL = 40\`, \`CM = 900\`.
`,
    constraints: '- valid numerals in the range 1 to 3999',
    signature: 'int romanToInt(String s)',
    tests: [
      { args: ['III'], expected: 3 },
      { args: ['LVIII'], expected: 58, why: 'L = 50, V = 5, III = 3.' },
      { args: ['MCMXCIV'], expected: 1994, why: 'M = 1000, CM = 900, XC = 90, IV = 4.' },
      { args: ['IV'], expected: 4 },
      { args: ['IX'], expected: 9 },
      { args: ['MMMCMXCIX'], expected: 3999 },
    ],
    hints: [
      'Put the symbol values in a `Map<Character, Integer>`, or use a `switch`.',
      'If a symbol is smaller than the one after it, subtract it. Otherwise add it.',
    ],
    solution: `import java.util.*;

class Solution {
    public int romanToInt(String s) {
        Map<Character, Integer> v = Map.of('I', 1, 'V', 5, 'X', 10, 'L', 50, 'C', 100, 'D', 500, 'M', 1000);
        int total = 0;
        for (int i = 0; i < s.length(); i++) {
            int cur = v.get(s.charAt(i));
            if (i + 1 < s.length() && cur < v.get(s.charAt(i + 1))) total -= cur;
            else total += cur;
        }
        return total;
    }
}`,
    complexity: 'O(n) time',
    explain: 'The subtraction rule only depends on the next symbol, so one look-ahead per character is enough.',
  }),
  P({
    id: 'happy-number',
    title: 'Happy Number',
    leetcode: 202,
    topic: 'Hashing',
    difficulty: 'easy',
    after: 'hashmap-set',
    blurb: 'Square the digits, repeat. Do you reach 1 or loop forever?',
    description: `
Starting with \`n\`, repeatedly replace the number with the **sum of the squares of its digits**. If this eventually reaches \`1\`, \`n\` is happy. Otherwise it loops forever in a cycle that doesn't include 1.

Return \`true\` if \`n\` is happy.
`,
    constraints: '- `1 <= n <= 2^31 - 1`',
    signature: 'boolean isHappy(int n)',
    tests: [
      { args: [19], expected: true, why: '1² + 9² = 82 → 68 → 100 → 1' },
      { args: [2], expected: false },
      { args: [1], expected: true },
      { args: [7], expected: true },
      { args: [4], expected: false },
      { args: [100], expected: true },
    ],
    hints: [
      'Write a helper that returns the sum of squared digits.',
      'How do you know you\'re looping forever? You see a number you\'ve seen before. Use a `HashSet`.',
    ],
    solution: `import java.util.*;

class Solution {
    public boolean isHappy(int n) {
        Set<Integer> seen = new HashSet<>();
        while (n != 1 && seen.add(n)) {
            n = next(n);
        }
        return n == 1;
    }

    private int next(int n) {
        int sum = 0;
        while (n > 0) {
            int d = n % 10;
            sum += d * d;
            n /= 10;
        }
        return sum;
    }
}`,
    complexity: 'O(log n) per step, and the sequence quickly drops to small numbers',
    explain: 'Cycle detection with a seen-set. (Floyd\'s fast/slow pointers, from the linked list lesson, also works here with O(1) space.)',
  }),
  // ---------------- hashing patterns ----------------
  P({
    id: 'two-sum',
    title: 'Two Sum',
    leetcode: 1,
    topic: 'Hashing',
    difficulty: 'easy',
    after: 'hashing-patterns',
    blurb: 'The most famous LeetCode problem.',
    description: `
Return the indices of the two numbers in \`nums\` that add up to \`target\`.

Exactly one solution exists, and you can't use the same element twice. The indices can be returned in any order.
`,
    constraints: '- `2 <= nums.length <= 10^4`\n- exactly one valid answer',
    signature: 'int[] twoSum(int[] nums, int target)',
    compare: 'unordered',
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1], why: '`nums[0] + nums[1] == 9`' },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
      { args: [[0, 4, 3, 0], 0], expected: [0, 3] },
    ],
    hints: [
      'Brute force checks every pair: O(n²). Can you do it in one pass?',
      'For each number, the partner you need is `target - nums[i]`. Have you seen it already?',
      'Use a `HashMap` from value to index. Check for the complement **before** inserting the current number, so you never pair an element with itself.',
    ],
    solution: `import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> indexOf = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int need = target - nums[i];
            if (indexOf.containsKey(need)) return new int[]{indexOf.get(need), i};
            indexOf.put(nums[i], i);
        }
        return new int[0];
    }
}`,
    complexity: 'O(n) time, O(n) space',
    explain: 'The complement-lookup pattern: remember what you\'ve seen, and ask the map whether the missing half of the pair was already there. Checking before inserting handles cases like `[3, 3]` correctly.',
  }),
  P({
    id: 'valid-anagram',
    title: 'Valid Anagram',
    leetcode: 242,
    topic: 'Hashing',
    difficulty: 'easy',
    after: 'hashing-patterns',
    blurb: 'Same letters, same counts?',
    description: 'Return `true` if `t` is an anagram of `s`: same letters, each used the same number of times. Both contain only lowercase English letters.',
    constraints: '- `1 <= s.length, t.length <= 5 * 10^4`',
    signature: 'boolean isAnagram(String s, String t)',
    tests: [
      { args: ['anagram', 'nagaram'], expected: true },
      { args: ['rat', 'car'], expected: false },
      { args: ['a', 'ab'], expected: false },
      { args: ['listen', 'silent'], expected: true },
      { args: ['aacc', 'ccac'], expected: false },
    ],
    hints: [
      'Different lengths mean they can\'t be anagrams.',
      'An `int[26]`: add 1 for each letter of `s`, subtract 1 for each letter of `t`. Is everything back to zero?',
    ],
    solution: `class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] count = new int[26];
        for (int i = 0; i < s.length(); i++) {
            count[s.charAt(i) - 'a']++;
            count[t.charAt(i) - 'a']--;
        }
        for (int c : count) if (c != 0) return false;
        return true;
    }
}`,
    complexity: 'O(n) time, O(1) space (26 counters)',
    explain: 'Frequency tables. Sorting both strings and comparing also works, in O(n log n).',
  }),
  P({
    id: 'first-unique-char',
    title: 'First Unique Character',
    leetcode: 387,
    topic: 'Hashing',
    difficulty: 'easy',
    after: 'hashing-patterns',
    blurb: 'Index of the first letter that appears only once.',
    description: 'Return the index of the first character in `s` that does not repeat anywhere in the string, or `-1` if there isn\'t one. `s` is lowercase letters.',
    constraints: '- `1 <= s.length <= 10^5`',
    signature: 'int firstUniqChar(String s)',
    tests: [
      { args: ['leetcode'], expected: 0 },
      { args: ['loveleetcode'], expected: 2 },
      { args: ['aabb'], expected: -1 },
      { args: ['z'], expected: 0 },
      { args: ['abcabd'], expected: 2 },
    ],
    hints: ['Two passes: first count every letter, then find the first index whose count is 1.'],
    solution: `class Solution {
    public int firstUniqChar(String s) {
        int[] count = new int[26];
        for (char c : s.toCharArray()) count[c - 'a']++;
        for (int i = 0; i < s.length(); i++) {
            if (count[s.charAt(i) - 'a'] == 1) return i;
        }
        return -1;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'Counting first, then scanning in the original order, means "first unique" falls out naturally.',
  }),
  P({
    id: 'ransom-note',
    title: 'Ransom Note',
    leetcode: 383,
    topic: 'Hashing',
    difficulty: 'easy',
    after: 'hashing-patterns',
    blurb: 'Can you build one string from another\'s letters?',
    description: 'Return `true` if `ransomNote` can be built using letters from `magazine`, where each letter in `magazine` can be used only once. Both are lowercase.',
    constraints: '- `1 <= lengths <= 10^5`',
    signature: 'boolean canConstruct(String ransomNote, String magazine)',
    tests: [
      { args: ['a', 'b'], expected: false },
      { args: ['aa', 'ab'], expected: false },
      { args: ['aa', 'aab'], expected: true },
      { args: ['bat', 'tablet'], expected: true },
      { args: ['abc', 'ab'], expected: false },
    ],
    hints: ['Count the magazine\'s letters, then "spend" them on the note. If any count goes negative, it\'s impossible.'],
    solution: `class Solution {
    public boolean canConstruct(String ransomNote, String magazine) {
        int[] count = new int[26];
        for (char c : magazine.toCharArray()) count[c - 'a']++;
        for (char c : ransomNote.toCharArray()) {
            if (--count[c - 'a'] < 0) return false;
        }
        return true;
    }
}`,
    complexity: 'O(n + m) time, O(1) space',
    explain: 'Another frequency-table problem. `--count[...] < 0` decrements and checks in one go.',
  }),
  P({
    id: 'isomorphic-strings',
    title: 'Isomorphic Strings',
    leetcode: 205,
    topic: 'Hashing',
    difficulty: 'easy+',
    after: 'hashing-patterns',
    blurb: 'Can one string\'s letters be consistently renamed into the other?',
    description: `
Two strings are isomorphic if you can replace characters in \`s\` to get \`t\`, where:

- every occurrence of a character is replaced by the **same** character, and
- no two different characters map to the same character (a character may map to itself).

\`s\` and \`t\` have the same length.
`,
    constraints: '- `1 <= s.length <= 5 * 10^4`',
    signature: 'boolean isIsomorphic(String s, String t)',
    tests: [
      { args: ['egg', 'add'], expected: true },
      { args: ['foo', 'bar'], expected: false, why: '`o` would have to map to both `a` and `r`.' },
      { args: ['paper', 'title'], expected: true },
      { args: ['badc', 'baba'], expected: false, why: '`b` and `d` would both map to `b`.' },
      { args: ['a', 'a'], expected: true },
      { args: ['ab', 'aa'], expected: false },
    ],
    hints: [
      'One map `s → t` catches the "same letter must map the same way" rule.',
      'You need a **second** map `t → s` (or a set of used targets) to catch two letters mapping onto one.',
    ],
    solution: `import java.util.*;

class Solution {
    public boolean isIsomorphic(String s, String t) {
        Map<Character, Character> st = new HashMap<>(), ts = new HashMap<>();
        for (int i = 0; i < s.length(); i++) {
            char a = s.charAt(i), b = t.charAt(i);
            if (st.containsKey(a) && st.get(a) != b) return false;
            if (ts.containsKey(b) && ts.get(b) != a) return false;
            st.put(a, b);
            ts.put(b, a);
        }
        return true;
    }
}`,
    complexity: 'O(n) time',
    explain: 'The mapping must be a one-to-one correspondence, so check both directions. (Comparing two `Character` objects with `!=` is safe here because chars below 128 are cached. For general objects, use `equals`.)',
  }),
  P({
    id: 'intersection-of-arrays',
    title: 'Intersection of Two Arrays',
    leetcode: 349,
    topic: 'Hashing',
    difficulty: 'easy',
    after: 'hashing-patterns',
    blurb: 'Distinct values that appear in both arrays.',
    description: 'Return an array of the **distinct** values that appear in both `nums1` and `nums2`. Any order is fine.',
    constraints: '- `1 <= lengths <= 1000`',
    signature: 'int[] intersection(int[] nums1, int[] nums2)',
    compare: 'unordered',
    tests: [
      { args: [[1, 2, 2, 1], [2, 2]], expected: [2] },
      { args: [[4, 9, 5], [9, 4, 9, 8, 4]], expected: [9, 4] },
      { args: [[1], [2]], expected: [] },
      { args: [[1, 2, 3], [3, 2, 1]], expected: [1, 2, 3] },
    ],
    hints: ['Put `nums1` in a set. Walk `nums2`, and whenever a value is in that set, add it to a result set.'],
    solution: `import java.util.*;

class Solution {
    public int[] intersection(int[] nums1, int[] nums2) {
        Set<Integer> a = new HashSet<>();
        for (int x : nums1) a.add(x);
        Set<Integer> both = new HashSet<>();
        for (int x : nums2) if (a.contains(x)) both.add(x);
        int[] out = new int[both.size()];
        int i = 0;
        for (int x : both) out[i++] = x;
        return out;
    }
}`,
    complexity: 'O(n + m) time',
    explain: 'Sets give O(1) membership and automatically de-duplicate. The last few lines show the usual way to turn a `Set<Integer>` back into an `int[]`.',
  }),
  // ---------------- two pointers ----------------
  P({
    id: 'valid-palindrome',
    title: 'Valid Palindrome',
    leetcode: 125,
    topic: 'Two pointers',
    difficulty: 'easy',
    after: 'two-pointers',
    blurb: 'Ignore punctuation and case. Is it a palindrome?',
    description: 'After lower-casing letters and **ignoring** everything that isn\'t a letter or digit, does `s` read the same forwards and backwards?',
    constraints: '- `1 <= s.length <= 2 * 10^5`',
    signature: 'boolean isPalindrome(String s)',
    tests: [
      { args: ['A man, a plan, a canal: Panama'], expected: true, why: 'Cleaned: `amanaplanacanalpanama`' },
      { args: ['race a car'], expected: false },
      { args: [' '], expected: true },
      { args: ['0P'], expected: false },
      { args: ['ab_a'], expected: true },
      { args: ['No lemon, no melon'], expected: true },
    ],
    hints: [
      'Two pointers from the ends.',
      'Skip non-alphanumeric characters with `Character.isLetterOrDigit`, and compare with `Character.toLowerCase`.',
    ],
    solution: `class Solution {
    public boolean isPalindrome(String s) {
        int i = 0, j = s.length() - 1;
        while (i < j) {
            if (!Character.isLetterOrDigit(s.charAt(i))) { i++; continue; }
            if (!Character.isLetterOrDigit(s.charAt(j))) { j--; continue; }
            if (Character.toLowerCase(s.charAt(i)) != Character.toLowerCase(s.charAt(j))) return false;
            i++;
            j--;
        }
        return true;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'Building a cleaned copy and reversing it also works (O(n) space). The two-pointer version skips junk on the fly without allocating anything.',
  }),
  P({
    id: 'is-subsequence',
    title: 'Is Subsequence',
    leetcode: 392,
    topic: 'Two pointers',
    difficulty: 'easy',
    after: 'two-pointers',
    blurb: 'Can you get s by deleting characters from t?',
    description: 'Return `true` if `s` is a **subsequence** of `t`, meaning you can delete some (or no) characters from `t`, without reordering the rest, and get `s`.',
    constraints: '- `0 <= s.length <= 100`\n- `0 <= t.length <= 10^4`',
    signature: 'boolean isSubsequence(String s, String t)',
    tests: [
      { args: ['abc', 'ahbgdc'], expected: true },
      { args: ['axc', 'ahbgdc'], expected: false },
      { args: ['', 'abc'], expected: true },
      { args: ['abc', ''], expected: false },
      { args: ['aaa', 'aa'], expected: false },
      { args: ['ace', 'abcde'], expected: true },
    ],
    hints: ['One pointer in each string. Always advance through `t`, and only advance through `s` on a match.'],
    solution: `class Solution {
    public boolean isSubsequence(String s, String t) {
        int i = 0;
        for (int j = 0; j < t.length() && i < s.length(); j++) {
            if (s.charAt(i) == t.charAt(j)) i++;
        }
        return i == s.length();
    }
}`,
    complexity: 'O(|t|) time',
    explain: 'Greedily matching each character of `s` at the earliest possible spot in `t` is always safe.',
  }),
  P({
    id: 'move-zeroes',
    title: 'Move Zeroes',
    leetcode: 283,
    topic: 'Two pointers',
    difficulty: 'easy',
    after: 'two-pointers',
    blurb: 'Push all zeros to the end, keeping the order of the rest.',
    description: 'Move every `0` in `nums` to the end **in place**, keeping the relative order of the non-zero elements. The method returns nothing, and the tests check `nums` afterwards.',
    constraints: '- `1 <= nums.length <= 10^4`',
    signature: 'void moveZeroes(int[] nums)',
    check: inPlace(0),
    tests: [
      { args: [[0, 1, 0, 3, 12]], expected: [1, 3, 12, 0, 0] },
      { args: [[0]], expected: [0] },
      { args: [[1, 2]], expected: [1, 2] },
      { args: [[0, 0, 1]], expected: [1, 0, 0] },
      { args: [[4, 0, 5, 0, 0, 6]], expected: [4, 5, 6, 0, 0, 0] },
    ],
    hints: [
      'Reader/writer pointers: copy every non-zero value to `nums[write++]`.',
      'Then fill from `write` to the end with zeros.',
    ],
    solution: `class Solution {
    public void moveZeroes(int[] nums) {
        int write = 0;
        for (int read = 0; read < nums.length; read++) {
            if (nums[read] != 0) nums[write++] = nums[read];
        }
        while (write < nums.length) nums[write++] = 0;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'The same reader/writer pattern as removing duplicates. The write pointer only moves when you keep something.',
  }),
  P({
    id: 'remove-duplicates',
    title: 'Remove Duplicates from Sorted Array',
    leetcode: 26,
    topic: 'Two pointers',
    difficulty: 'easy',
    after: 'two-pointers',
    blurb: 'Compact a sorted array in place and return the new length.',
    description: `
\`nums\` is sorted in non-decreasing order. Remove the duplicates **in place** so each value appears once, keeping the order.

Return \`k\`, the number of unique values. The first \`k\` elements of \`nums\` must hold them, and whatever is after index \`k - 1\` doesn't matter. (The expected output below shows those first \`k\` elements.)
`,
    constraints: '- `1 <= nums.length <= 3 * 10^4`\n- sorted ascending',
    signature: 'int removeDuplicates(int[] nums)',
    check: firstK(0),
    tests: [
      { args: [[1, 1, 2]], expected: [1, 2], why: 'Return `k = 2`, with `nums` starting `[1, 2, …]`.' },
      { args: [[0, 0, 1, 1, 1, 2, 2, 3, 3, 4]], expected: [0, 1, 2, 3, 4] },
      { args: [[5]], expected: [5] },
      { args: [[1, 2, 3]], expected: [1, 2, 3] },
      { args: [[2, 2, 2, 2]], expected: [2] },
    ],
    hints: ['You built this exact loop in the two-pointers lesson: a value is new when it differs from the previous one.'],
    solution: `class Solution {
    public int removeDuplicates(int[] nums) {
        int write = 1;
        for (int read = 1; read < nums.length; read++) {
            if (nums[read] != nums[read - 1]) nums[write++] = nums[read];
        }
        return write;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'Because the array is sorted, duplicates sit next to each other, so comparing with the left neighbour is enough.',
  }),
  P({
    id: 'merge-sorted-array',
    title: 'Merge Sorted Array',
    leetcode: 88,
    topic: 'Two pointers',
    difficulty: 'easy+',
    after: 'two-pointers',
    blurb: 'Merge into the first array, which has spare room at the end.',
    description: `
\`nums1\` has length \`m + n\`: its first \`m\` elements are sorted values, and the last \`n\` are zeros that are just space. \`nums2\` has \`n\` sorted values.

Merge \`nums2\` into \`nums1\` **in place** so that \`nums1\` is fully sorted. The method returns nothing.
`,
    constraints: '- `0 <= m, n <= 200`',
    signature: 'void merge(int[] nums1, int m, int[] nums2, int n)',
    check: inPlace(0),
    tests: [
      { args: [[1, 2, 3, 0, 0, 0], 3, [2, 5, 6], 3], expected: [1, 2, 2, 3, 5, 6] },
      { args: [[1], 1, [], 0], expected: [1] },
      { args: [[0], 0, [1], 1], expected: [1] },
      { args: [[4, 5, 6, 0, 0, 0], 3, [1, 2, 3], 3], expected: [1, 2, 3, 4, 5, 6] },
      { args: [[2, 0], 1, [1], 1], expected: [1, 2] },
    ],
    hints: [
      'Filling from the front would overwrite values you still need.',
      'Fill from the **back**: compare the largest remaining of each array and put the bigger one at the end.',
      'When `nums2` is used up you\'re done. Whatever is left in `nums1` is already in place.',
    ],
    solution: `class Solution {
    public void merge(int[] nums1, int m, int[] nums2, int n) {
        int i = m - 1, j = n - 1, k = m + n - 1;
        while (j >= 0) {
            if (i >= 0 && nums1[i] > nums2[j]) nums1[k--] = nums1[i--];
            else nums1[k--] = nums2[j--];
        }
    }
}`,
    complexity: 'O(m + n) time, O(1) space',
    explain: 'Merging backwards writes into the empty tail first, so nothing unread is overwritten. It\'s a lovely variation on the merge step from the lesson.',
  }),
  P({
    id: 'squares-sorted-array',
    title: 'Squares of a Sorted Array',
    leetcode: 977,
    topic: 'Two pointers',
    difficulty: 'easy',
    after: 'two-pointers',
    blurb: 'Square everything and keep it sorted, in O(n).',
    description: 'Given an array sorted ascending (possibly with negatives), return an array of each number **squared**, also sorted ascending.',
    constraints: '- `1 <= nums.length <= 10^4`\n- sorted ascending',
    signature: 'int[] sortedSquares(int[] nums)',
    tests: [
      { args: [[-4, -1, 0, 3, 10]], expected: [0, 1, 9, 16, 100] },
      { args: [[-7, -3, 2, 3, 11]], expected: [4, 9, 9, 49, 121] },
      { args: [[1]], expected: [1] },
      { args: [[-5, -3, -2]], expected: [4, 9, 25] },
      { args: [[1, 2, 3]], expected: [1, 4, 9] },
    ],
    hints: [
      'Squaring then sorting is O(n log n). Can you avoid the sort?',
      'The biggest square is always at one of the two **ends**. Two pointers, filling the result from the back.',
    ],
    solution: `class Solution {
    public int[] sortedSquares(int[] nums) {
        int n = nums.length;
        int[] out = new int[n];
        int l = 0, r = n - 1;
        for (int k = n - 1; k >= 0; k--) {
            if (Math.abs(nums[l]) > Math.abs(nums[r])) {
                out[k] = nums[l] * nums[l];
                l++;
            } else {
                out[k] = nums[r] * nums[r];
                r--;
            }
        }
        return out;
    }
}`,
    complexity: 'O(n) time',
    explain: 'Large negatives sit on the left and large positives on the right. Repeatedly take whichever end has the larger absolute value, writing from the back.',
  }),
  P({
    id: 'best-time-stock',
    title: 'Best Time to Buy and Sell Stock',
    leetcode: 121,
    topic: 'Two pointers',
    difficulty: 'easy',
    after: 'two-pointers',
    blurb: 'One buy, one later sell. Maximum profit?',
    description: '`prices[i]` is a stock\'s price on day `i`. Choose one day to buy and a **later** day to sell. Return the maximum profit, or `0` if no profit is possible.',
    constraints: '- `1 <= prices.length <= 10^5`',
    signature: 'int maxProfit(int[] prices)',
    tests: [
      { args: [[7, 1, 5, 3, 6, 4]], expected: 5, why: 'Buy at 1 (day 1), sell at 6 (day 4).' },
      { args: [[7, 6, 4, 3, 1]], expected: 0, why: 'Prices only fall, so don\'t trade.' },
      { args: [[1]], expected: 0 },
      { args: [[2, 4, 1]], expected: 2 },
      { args: [[3, 2, 6, 5, 0, 3]], expected: 4 },
    ],
    hints: [
      'Trying every pair is O(n²), too slow for 10⁵ days.',
      'Walk through the days once, tracking the cheapest price so far. Selling today earns `price - minSoFar`.',
    ],
    solution: `class Solution {
    public int maxProfit(int[] prices) {
        int minPrice = Integer.MAX_VALUE, best = 0;
        for (int p : prices) {
            minPrice = Math.min(minPrice, p);
            best = Math.max(best, p - minPrice);
        }
        return best;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'For each sell day, the best buy day is the cheapest one before it, so you only need to remember the running minimum. This "best so far" idea is the seed of dynamic programming.',
  }),
  // ---------------- stacks & heaps ----------------
  P({
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    leetcode: 20,
    topic: 'Stacks',
    difficulty: 'easy',
    after: 'stacks-queues',
    blurb: 'Are the brackets balanced and properly nested?',
    description: `
The string \`s\` contains only \`()[]{}\`. Return \`true\` if:

- every opening bracket is closed by the same type of bracket,
- brackets close in the correct order, and
- every closing bracket has a matching opener.
`,
    constraints: '- `1 <= s.length <= 10^4`',
    signature: 'boolean isValid(String s)',
    tests: [
      { args: ['()'], expected: true },
      { args: ['()[]{}'], expected: true },
      { args: ['(]'], expected: false },
      { args: ['([)]'], expected: false, why: 'The `)` arrives while `[` is the innermost open bracket.' },
      { args: ['{[]}'], expected: true },
      { args: ['('], expected: false },
      { args: [']'], expected: false },
      { args: ['(('], expected: false },
    ],
    hints: [
      'Push opening brackets onto a stack.',
      'On a closing bracket, the stack top must be its partner. Check the stack isn\'t empty first.',
      'At the end, the stack must be empty.',
    ],
    solution: `import java.util.*;

class Solution {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        for (char c : s.toCharArray()) {
            if (c == '(') stack.push(')');
            else if (c == '[') stack.push(']');
            else if (c == '{') stack.push('}');
            else if (stack.isEmpty() || stack.pop() != c) return false;
        }
        return stack.isEmpty();
    }
}`,
    complexity: 'O(n) time, O(n) space',
    explain: 'Pushing the **expected closing** bracket makes the check a single comparison. Two easy-to-miss cases: a closer with an empty stack, and leftover openers at the end.',
  }),
  P({
    id: 'last-stone-weight',
    title: 'Last Stone Weight',
    leetcode: 1046,
    topic: 'Heaps',
    difficulty: 'easy',
    after: 'stacks-queues',
    blurb: 'Smash the two heaviest stones until one is left.',
    description: `
Each turn, take the two **heaviest** stones \`x <= y\` and smash them:

- if \`x == y\`, both are destroyed;
- otherwise \`x\` is destroyed and \`y\` becomes \`y - x\`.

Return the weight of the last stone, or \`0\` if none are left.
`,
    constraints: '- `1 <= stones.length <= 30`',
    signature: 'int lastStoneWeight(int[] stones)',
    tests: [
      { args: [[2, 7, 4, 1, 8, 1]], expected: 1 },
      { args: [[1]], expected: 1 },
      { args: [[2, 2]], expected: 0 },
      { args: [[10, 4, 2, 10]], expected: 2 },
      { args: [[3, 7, 2]], expected: 2 },
    ],
    hints: ['"Repeatedly take the largest" is exactly what a max-heap is for: `new PriorityQueue<>(Collections.reverseOrder())`.'],
    solution: `import java.util.*;

class Solution {
    public int lastStoneWeight(int[] stones) {
        PriorityQueue<Integer> heap = new PriorityQueue<>(Collections.reverseOrder());
        for (int s : stones) heap.offer(s);
        while (heap.size() > 1) {
            int y = heap.poll(), x = heap.poll();
            if (y != x) heap.offer(y - x);
        }
        return heap.isEmpty() ? 0 : heap.peek();
    }
}`,
    complexity: 'O(n log n) time',
    explain: 'Each smash is two polls and at most one offer, all O(log n). Sorting the array again after every smash would be much slower.',
  }),
  // ---------------- binary search ----------------
  P({
    id: 'binary-search',
    title: 'Binary Search',
    leetcode: 704,
    topic: 'Binary search',
    difficulty: 'warmup',
    after: 'binary-search',
    blurb: 'Find the target in a sorted array in O(log n).',
    description: 'Return the index of `target` in the sorted array `nums`, or `-1` if it isn\'t there. Your solution must run in O(log n).',
    constraints: '- `1 <= nums.length <= 10^4`\n- values are unique and sorted ascending',
    signature: 'int search(int[] nums, int target)',
    tests: [
      { args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4 },
      { args: [[-1, 0, 3, 5, 9, 12], 2], expected: -1 },
      { args: [[5], 5], expected: 0 },
      { args: [[5], -5], expected: -1 },
      { args: [[1, 3], 3], expected: 1 },
      { args: [[1, 3, 5, 7, 9, 11, 13], 1], expected: 0 },
    ],
    hints: ['Write it from memory first: `lo`, `hi`, `while (lo <= hi)`, and an overflow-safe `mid`.'],
    solution: `class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }
}`,
    complexity: 'O(log n) time',
    explain: 'The textbook template. Being able to write this correctly and quickly pays off in lots of other problems.',
  }),
  P({
    id: 'search-insert',
    title: 'Search Insert Position',
    leetcode: 35,
    topic: 'Binary search',
    difficulty: 'easy',
    after: 'binary-search',
    blurb: 'Where does the target go in a sorted array?',
    description: 'Return the index of `target` if it\'s in the sorted array, otherwise the index where it **would** be inserted to keep the order. Must be O(log n).',
    constraints: '- `1 <= nums.length <= 10^4`\n- unique, sorted ascending',
    signature: 'int searchInsert(int[] nums, int target)',
    tests: [
      { args: [[1, 3, 5, 6], 5], expected: 2 },
      { args: [[1, 3, 5, 6], 2], expected: 1 },
      { args: [[1, 3, 5, 6], 7], expected: 4 },
      { args: [[1, 3, 5, 6], 0], expected: 0 },
      { args: [[1], 1], expected: 0 },
    ],
    hints: ['Run a normal binary search. When the target isn\'t found, where does `lo` end up?'],
    solution: `class Solution {
    public int searchInsert(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return lo;
    }
}`,
    complexity: 'O(log n) time',
    explain: 'When the loop ends without a hit, everything before `lo` is smaller than the target and everything from `lo` on is larger. So `lo` is the insertion point.',
  }),
  // ---------------- recursion / DP ----------------
  P({
    id: 'climbing-stairs',
    title: 'Climbing Stairs',
    leetcode: 70,
    topic: 'Recursion & DP',
    difficulty: 'easy',
    after: 'recursion',
    blurb: '1 or 2 steps at a time. How many ways to the top?',
    description: 'You climb a staircase of `n` steps, taking **1 or 2** steps each time. How many distinct ways are there to reach the top?',
    constraints: '- `1 <= n <= 45`',
    signature: 'int climbStairs(int n)',
    tests: [
      { args: [1], expected: 1 },
      { args: [2], expected: 2, why: '1+1, or 2.' },
      { args: [3], expected: 3, why: '1+1+1, 1+2, 2+1.' },
      { args: [5], expected: 8 },
      { args: [10], expected: 89 },
      { args: [45], expected: 1836311903 },
    ],
    hints: [
      'Your last move to step `n` was either a 1-step (from `n-1`) or a 2-step (from `n-2`).',
      'So `ways(n) = ways(n-1) + ways(n-2)`. Look familiar? Naive recursion is too slow for n = 45.',
    ],
    solution: `class Solution {
    public int climbStairs(int n) {
        int a = 1, b = 1; // ways(0), ways(1)
        for (int i = 2; i <= n; i++) {
            int c = a + b;
            a = b;
            b = c;
        }
        return b;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'Fibonacci in disguise. Splitting the count by the last move gives a recurrence, and walking it bottom-up with two variables is your first dynamic programming solution.',
  }),
  P({
    id: 'pascals-triangle',
    title: 'Pascal\'s Triangle',
    leetcode: 118,
    topic: 'Arrays',
    difficulty: 'easy',
    after: 'arrays-2d',
    blurb: 'Each number is the sum of the two above it.',
    description: 'Return the first `numRows` rows of Pascal\'s triangle. Each row starts and ends with 1, and every inner number is the sum of the two numbers directly above it.',
    constraints: '- `1 <= numRows <= 30`',
    signature: 'List<List<Integer>> generate(int numRows)',
    tests: [
      { args: [1], expected: [[1]] },
      { args: [2], expected: [[1], [1, 1]] },
      { args: [5], expected: [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]] },
    ],
    hints: [
      'Build row by row. Row `i` has `i + 1` numbers.',
      'For an inner position `j`: `prev.get(j - 1) + prev.get(j)`.',
    ],
    solution: `import java.util.*;

class Solution {
    public List<List<Integer>> generate(int numRows) {
        List<List<Integer>> rows = new ArrayList<>();
        for (int i = 0; i < numRows; i++) {
            List<Integer> row = new ArrayList<>();
            for (int j = 0; j <= i; j++) {
                if (j == 0 || j == i) row.add(1);
                else row.add(rows.get(i - 1).get(j - 1) + rows.get(i - 1).get(j));
            }
            rows.add(row);
        }
        return rows;
    }
}`,
    complexity: 'O(numRows²) time',
    explain: 'Each row depends only on the one before it. This is good practice with nested `List<List<Integer>>`.',
  }),
  // ---------------- linked lists ----------------
  P({
    id: 'reverse-linked-list',
    title: 'Reverse Linked List',
    leetcode: 206,
    topic: 'Linked lists',
    difficulty: 'easy',
    after: 'linked-lists',
    blurb: 'Flip every next pointer.',
    description: 'Reverse a singly linked list and return the new head. Lists are shown as arrays in the tests: `[1, 2, 3]` means `1 → 2 → 3`.',
    constraints: '- `0 <= length <= 5000`',
    signature: 'ListNode reverseList(ListNode head)',
    needs: ['ListNode'],
    header: LISTNODE_HEADER,
    tests: [
      { args: [[1, 2, 3, 4, 5]], expected: [5, 4, 3, 2, 1] },
      { args: [[1, 2]], expected: [2, 1] },
      { args: [[]], expected: [] },
      { args: [[7]], expected: [7] },
    ],
    hints: [
      'Three variables: `prev`, `curr`, and a saved `next`.',
      'Bonus: try the recursive version too. Reverse the rest, then hook `head` onto the end.',
    ],
    solution: `class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null, curr = head;
        while (curr != null) {
            ListNode next = curr.next;
            curr.next = prev;
            prev = curr;
            curr = next;
        }
        return prev;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'Save next, flip the pointer, advance both. If you can write this from memory, you can handle most linked-list problems.',
  }),
  P({
    id: 'merge-two-lists',
    title: 'Merge Two Sorted Lists',
    leetcode: 21,
    topic: 'Linked lists',
    difficulty: 'easy',
    after: 'linked-lists',
    blurb: 'Splice two sorted lists into one.',
    description: 'Merge two sorted linked lists into one sorted list by splicing their nodes together, and return its head.',
    constraints: '- `0 <= lengths <= 50`',
    signature: 'ListNode mergeTwoLists(ListNode list1, ListNode list2)',
    needs: ['ListNode'],
    header: LISTNODE_HEADER,
    tests: [
      { args: [[1, 2, 4], [1, 3, 4]], expected: [1, 1, 2, 3, 4, 4] },
      { args: [[], []], expected: [] },
      { args: [[], [0]], expected: [0] },
      { args: [[5], [1, 2, 3]], expected: [1, 2, 3, 5] },
      { args: [[1, 1], [1]], expected: [1, 1, 1] },
    ],
    hints: [
      'Use a dummy head and a `tail` pointer.',
      'Attach the smaller front node to `tail.next`. When one list runs out, attach the rest of the other in one step.',
    ],
    solution: `class Solution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        ListNode dummy = new ListNode(0), tail = dummy;
        while (list1 != null && list2 != null) {
            if (list1.val <= list2.val) {
                tail.next = list1;
                list1 = list1.next;
            } else {
                tail.next = list2;
                list2 = list2.next;
            }
            tail = tail.next;
        }
        tail.next = (list1 != null) ? list1 : list2;
        return dummy.next;
    }
}`,
    complexity: 'O(n + m) time, O(1) extra space',
    explain: 'It\'s the same merge as the array version, but there\'s no copying: you just re-point `next`. The dummy node avoids special-casing the first node.',
  }),
  P({
    id: 'middle-of-list',
    title: 'Middle of the Linked List',
    leetcode: 876,
    topic: 'Linked lists',
    difficulty: 'warmup',
    after: 'linked-lists',
    blurb: 'Fast and slow pointers.',
    description: 'Return the middle node of the list. If there are two middle nodes, return the **second** one. The test output shows the list from that node onwards.',
    constraints: '- `1 <= length <= 100`',
    signature: 'ListNode middleNode(ListNode head)',
    needs: ['ListNode'],
    header: LISTNODE_HEADER,
    tests: [
      { args: [[1, 2, 3, 4, 5]], expected: [3, 4, 5] },
      { args: [[1, 2, 3, 4, 5, 6]], expected: [4, 5, 6] },
      { args: [[1]], expected: [1] },
      { args: [[1, 2]], expected: [2] },
    ],
    hints: ['`slow` moves one step, `fast` moves two. Loop while `fast != null && fast.next != null`.'],
    solution: `class Solution {
    public ListNode middleNode(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }
        return slow;
    }
}`,
    complexity: 'O(n) time, O(1) space',
    explain: 'When `fast` has covered the whole list, `slow` has covered half of it. One pass, no counting.',
  }),
  // ---------------- trees ----------------
  P({
    id: 'max-depth-tree',
    title: 'Maximum Depth of Binary Tree',
    leetcode: 104,
    topic: 'Trees',
    difficulty: 'warmup',
    after: 'trees',
    blurb: 'How many levels deep is it?',
    description: 'Return the number of nodes along the longest path from the root down to a leaf. Trees are given in level order, with `null` for missing children.',
    constraints: '- `0 <= nodes <= 10^4`',
    signature: 'int maxDepth(TreeNode root)',
    needs: ['TreeNode'],
    header: TREENODE_HEADER,
    tests: [
      { args: [[3, 9, 20, null, null, 15, 7]], expected: 3 },
      { args: [[1, null, 2]], expected: 2 },
      { args: [[]], expected: 0 },
      { args: [[1]], expected: 1 },
      { args: [[1, 2, null, 3, null, 4]], expected: 4 },
    ],
    hints: ['An empty tree has depth 0. Otherwise: 1 + the deeper subtree.'],
    solution: `class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}`,
    complexity: 'O(n) time, O(height) stack space',
    explain: 'The tree recursion template in its purest form.',
  }),
  P({
    id: 'invert-tree',
    title: 'Invert Binary Tree',
    leetcode: 226,
    topic: 'Trees',
    difficulty: 'easy',
    after: 'trees',
    blurb: 'Mirror the tree left to right.',
    description: 'Swap the left and right children of **every** node, and return the root.',
    constraints: '- `0 <= nodes <= 100`',
    signature: 'TreeNode invertTree(TreeNode root)',
    needs: ['TreeNode'],
    header: TREENODE_HEADER,
    tests: [
      { args: [[4, 2, 7, 1, 3, 6, 9]], expected: [4, 7, 2, 9, 6, 3, 1] },
      { args: [[2, 1, 3]], expected: [2, 3, 1] },
      { args: [[]], expected: [] },
      { args: [[1, 2]], expected: [1, null, 2] },
    ],
    hints: ['Invert both subtrees, then swap them. (Or swap first, then recurse. Either order works.)'],
    solution: `class Solution {
    public TreeNode invertTree(TreeNode root) {
        if (root == null) return null;
        TreeNode left = invertTree(root.left);
        root.left = invertTree(root.right);
        root.right = left;
        return root;
    }
}`,
    complexity: 'O(n) time',
    explain: 'Notice the temporary variable: you need to remember one side before overwriting it, just like an array swap.',
  }),
  P({
    id: 'same-tree',
    title: 'Same Tree',
    leetcode: 100,
    topic: 'Trees',
    difficulty: 'easy',
    after: 'trees',
    blurb: 'Same shape and same values?',
    description: 'Return `true` if the two trees are structurally identical and every corresponding node has the same value.',
    constraints: '- `0 <= nodes <= 100`',
    signature: 'boolean isSameTree(TreeNode p, TreeNode q)',
    needs: ['TreeNode'],
    header: TREENODE_HEADER,
    tests: [
      { args: [[1, 2, 3], [1, 2, 3]], expected: true },
      { args: [[1, 2], [1, null, 2]], expected: false },
      { args: [[1, 2, 1], [1, 1, 2]], expected: false },
      { args: [[], []], expected: true },
      { args: [[1], []], expected: false },
    ],
    hints: [
      'Both null means same. Exactly one null means different.',
      'Otherwise the values must match **and** both pairs of subtrees must be the same.',
    ],
    solution: `class Solution {
    public boolean isSameTree(TreeNode p, TreeNode q) {
        if (p == null && q == null) return true;
        if (p == null || q == null) return false;
        return p.val == q.val && isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
    }
}`,
    complexity: 'O(n) time',
    explain: 'Recursion over two trees at once. Handle the null cases first, then the `&&` chain stops at the first mismatch.',
  }),
];

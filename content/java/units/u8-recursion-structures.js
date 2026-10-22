import { starter } from '../helpers.js';

const LISTNODE = 'class ListNode { int val; ListNode next; ListNode(int val) { this.val = val; } }';
const TREENODE = 'class TreeNode { int val; TreeNode left, right; TreeNode(int val) { this.val = val; } TreeNode(int val, TreeNode l, TreeNode r) { this.val = val; left = l; right = r; } }';

export default {
  id: 'u8',
  title: 'Recursion, linked lists & trees',
  blurb: 'Thinking recursively, then the two pointer-based structures that LeetCode loves.',
  lessons: [
    {
      id: 'recursion',
      title: 'Recursion & memoization',
      summary: 'Base cases, the call stack, and caching repeated work.',
      notes: `
A recursive method solves a problem by calling itself on a **smaller** version of it.

~~~java
static int factorial(int n) {
    if (n <= 1) return 1;            // base case: stops the recursion
    return n * factorial(n - 1);     // recursive case: makes progress
}
~~~

Checklist:
1. **Base case**. Without one (or if it's never reached) you get \`StackOverflowError\`.
2. **Progress**. Each call must move toward the base case.
3. **Trust the recursion**. Assume the smaller call returns the right answer, and just combine it.

Each call gets its own frame on the call stack, with its own copies of local variables. Code **after** a recursive call runs as the calls unwind, in reverse order.

### Memoization
Naive \`fib(n) = fib(n-1) + fib(n-2)\` recomputes the same values exponentially often. Cache them:
~~~java
static long[] memo = new long[100];
static long fib(int n) {
    if (n < 2) return n;
    if (memo[n] != 0) return memo[n];
    return memo[n] = fib(n - 1) + fib(n - 2);
}
~~~
That takes it from O(2ⁿ) to O(n). (A simple loop with two variables is O(n) time and O(1) space.)
`,
      questions: [
        {
          type: 'output',
          code: `static int f(int n) {
    if (n == 0) return 0;
    return n + f(n - 1);
}

System.out.println(f(4));`,
          answer: '10',
          explain: 'f(4) = 4 + f(3) = 4 + 3 + f(2) = … = 4 + 3 + 2 + 1 + 0 = 10.',
        },
        {
          type: 'output',
          code: `static void countdown(int n) {
    if (n == 0) return;
    System.out.print(n + " ");
    countdown(n - 1);
    System.out.print(n + " ");
}

countdown(3);`,
          answer: '3 2 1 1 2 3',
          explain: 'The first print happens on the way **down** (3, 2, 1). The second happens as each call **returns**, innermost first (1, 2, 3).',
        },
        {
          type: 'mcq',
          prompt: 'What happens when you call this with `n = 5`?',
          code: `static int sumTo(int n) {
    return n + sumTo(n - 1);
}`,
          options: ['Returns 15', 'Returns 0', '`StackOverflowError`', 'Compile error'],
          answer: 2,
          explain: 'There\'s no base case, so the calls never stop. 5, 4, 3, … 0, -1, -2, … until the stack runs out.',
        },
        {
          type: 'fill',
          prompt: 'Complete the recursive power function.',
          code: `static long power(int base, int exp) {
    if (exp == ___) return 1;
    return base * power(base, ___);
}`,
          teardown: 'System.out.println(power(2, 10) + " " + power(5, 0));',
          blanks: [['0'], ['exp - 1', 'exp-1']],
          expect: '1024 1',
          explain: 'Anything to the power 0 is 1 (base case). Otherwise peel off one multiplication and recurse on a smaller exponent.',
        },
        {
          type: 'bug',
          prompt: 'This should return the max of `a[i..end]`, but it overflows the stack. Which line?',
          code: `static int max(int[] a, int i) {
    if (i == a.length - 1) return a[i];
    int restMax = max(a, i);
    return Math.max(a[i], restMax);
}`,
          line: 3,
          fix: 'int restMax = max(a, i + 1);',
          explain: 'The recursive call uses the same `i`, so it never gets closer to the base case. It must recurse on the **rest** of the array.',
        },
        {
          type: 'code',
          prompt: 'Return the n-th Fibonacci number (`fib(0) = 0`, `fib(1) = 1`). The tests go up to `n = 45`, so naive recursion will run out of time. Memoize it, or use a loop.',
          signature: 'int fib(int n)',
          starter: starter('int fib(int n)'),
          tests: [
            { args: [0], expected: 0 },
            { args: [1], expected: 1 },
            { args: [2], expected: 1 },
            { args: [10], expected: 55 },
            { args: [30], expected: 832040 },
            { args: [45], expected: 1134903170 },
          ],
          solution: `class Solution {
    public int fib(int n) {
        if (n < 2) return n;
        int prev = 0, cur = 1;
        for (int i = 2; i <= n; i++) {
            int next = prev + cur;
            prev = cur;
            cur = next;
        }
        return cur;
    }
}`,
          explain: 'Each value only needs the previous two, so keep two variables and walk forward. That\'s O(n) time and O(1) space. A memoized recursion is also O(n). (LeetCode 509.)',
        },
        {
          type: 'mcq',
          prompt: 'What does memoization do to the naive recursive Fibonacci?',
          options: ['Nothing, since it\'s already optimal', 'Turns O(2ⁿ) time into O(n) by caching each result', 'Turns O(n) into O(1)', 'Removes the need for a base case'],
          answer: 1,
          explain: 'Each `fib(k)` is computed once and then looked up, instead of being recomputed an exponential number of times.',
        },
      ],
    },
    {
      id: 'linked-lists',
      title: 'Linked lists',
      summary: 'ListNode, traversal, reversal, dummy heads and fast/slow pointers.',
      notes: `
LeetCode defines:
~~~java
class ListNode {
    int val;
    ListNode next;
    ListNode(int val) { this.val = val; }
}
~~~
A list is just a reference to its first node. The last node's \`next\` is \`null\`.

### Traverse
~~~java
for (ListNode cur = head; cur != null; cur = cur.next) { ... }
~~~

### Reverse (iteratively)
~~~java
ListNode prev = null, cur = head;
while (cur != null) {
    ListNode next = cur.next;  // 1. remember the rest
    cur.next = prev;           // 2. flip the pointer
    prev = cur;                // 3. advance prev
    cur = next;                // 4. advance cur
}
return prev;                   // new head
~~~

### Dummy head
When the head itself might be removed or replaced, start with \`ListNode dummy = new ListNode(0); dummy.next = head;\` and return \`dummy.next\`. It removes the special cases.

### Fast & slow pointers
\`slow\` moves 1 step, \`fast\` moves 2. When \`fast\` hits the end, \`slow\` is in the middle. If there's a cycle, they eventually meet.

> Watch out: Check \`node != null\` before touching \`node.next\`. Most linked-list crashes are a \`NullPointerException\` at the end of the list.
`,
      questions: [
        {
          type: 'output',
          code: `class Node {
    int val;
    Node next;
    Node(int val) { this.val = val; }
}

Node head = new Node(1);
head.next = new Node(2);
head.next.next = new Node(3);
for (Node cur = head; cur != null; cur = cur.next) {
    System.out.print(cur.val + " ");
}`,
          answer: '1 2 3',
          explain: 'Start at the head and follow `next` until it\'s `null`.',
        },
        {
          type: 'order',
          prompt: 'Arrange the body of `reverse(head)`.',
          setup: `${LISTNODE}
static ListNode reverse(ListNode head) {`,
          lines: [
            'ListNode prev = null;',
            'ListNode curr = head;',
            'while (curr != null) {',
            '    ListNode next = curr.next;',
            '    curr.next = prev;',
            '    prev = curr;',
            '    curr = next;',
            '}',
            'return prev;',
          ],
          alts: [[
            'ListNode curr = head;',
            'ListNode prev = null;',
            'while (curr != null) {',
            '    ListNode next = curr.next;',
            '    curr.next = prev;',
            '    prev = curr;',
            '    curr = next;',
            '}',
            'return prev;',
          ]],
          teardown: `}
ListNode h = new ListNode(1);
h.next = new ListNode(2);
h.next.next = new ListNode(3);
for (ListNode c = reverse(h); c != null; c = c.next) System.out.print(c.val);`,
          expect: '321',
          explain: 'Save `next` **before** flipping `curr.next`, or you lose the rest of the list. At the end `curr` is `null` and `prev` is the new head.',
        },
        {
          type: 'mcq',
          prompt: 'Why use a "dummy" node in front of the head when deleting nodes?',
          options: [
            'It makes the list doubly linked',
            'Deleting the real head becomes the same as deleting any other node, so there\'s no special case',
            'It speeds the algorithm up from O(n²) to O(n)',
            'Java requires lists to start with a sentinel',
          ],
          answer: 1,
          explain: 'With `dummy.next = head`, every real node has a predecessor, so one uniform `prev.next = prev.next.next` handles all cases. Return `dummy.next`.',
        },
        {
          type: 'output',
          code: `class Node {
    int val;
    Node next;
    Node(int val, Node next) { this.val = val; this.next = next; }
}

Node head = new Node(1, new Node(2, new Node(3, new Node(4, new Node(5, null)))));
Node slow = head, fast = head;
while (fast != null && fast.next != null) {
    slow = slow.next;
    fast = fast.next.next;
}
System.out.println(slow.val);`,
          answer: '3',
          explain: 'fast moves 1→3→5 while slow moves 1→2→3. fast can\'t take another double step, so slow is at the middle.',
        },
        {
          type: 'bug',
          prompt: 'After `insertAfter(node, newNode)`, `newNode` points to itself. Which line is in the wrong place?',
          setup: LISTNODE,
          code: `static void insertAfter(ListNode node, ListNode newNode) {
    node.next = newNode;
    newNode.next = node.next;
}`,
          line: [2, 3],
          fix: `newNode.next = node.next;
node.next = newNode;`,
          explain: 'Once `node.next = newNode` runs, the old successor is lost and `node.next` **is** `newNode`. Link the new node to the rest of the list first, then hook it in.',
        },
        {
          type: 'code',
          prompt: 'Remove every node whose value equals `val` and return the new head. `ListNode` is predefined (fields `val`, `next`, constructors `ListNode(int)` and `ListNode(int, ListNode)`).',
          signature: 'ListNode removeElements(ListNode head, int val)',
          needs: ['ListNode'],
          starter: starter('ListNode removeElements(ListNode head, int val)'),
          tests: [
            { args: [[1, 2, 6, 3, 4, 5, 6], 6], expected: [1, 2, 3, 4, 5] },
            { args: [[], 1], expected: [] },
            { args: [[7, 7, 7, 7], 7], expected: [] },
            { args: [[7, 1, 7], 7], expected: [1] },
            { args: [[1, 2, 3], 4], expected: [1, 2, 3] },
          ],
          solution: `class Solution {
    public ListNode removeElements(ListNode head, int val) {
        ListNode dummy = new ListNode(0);
        dummy.next = head;
        ListNode prev = dummy;
        while (prev.next != null) {
            if (prev.next.val == val) prev.next = prev.next.next;
            else prev = prev.next;
        }
        return dummy.next;
    }
}`,
          explain: 'The dummy node means removing the head is no different from removing anything else. Only advance `prev` when you **didn\'t** delete, because the new `prev.next` still needs checking. (LeetCode 203.)',
        },
        {
          type: 'mcq',
          prompt: 'How long does it take to reach the k-th node of a singly linked list?',
          options: ['O(1)', 'O(log k)', 'O(k)', 'O(k²)'],
          answer: 2,
          explain: 'No random access: you follow `next` k times. That\'s the trade-off against arrays (O(1) indexing) in exchange for cheap insertion and removal at a known node.',
        },
      ],
    },
    {
      id: 'trees',
      title: 'Binary trees',
      summary: 'Recursive DFS, traversal orders, BSTs and level-order BFS.',
      notes: `
~~~java
class TreeNode {
    int val;
    TreeNode left, right;
    TreeNode(int val) { this.val = val; }
}
~~~

Most tree problems follow one recursive template:
~~~java
int solve(TreeNode node) {
    if (node == null) return /* answer for an empty tree */;
    int l = solve(node.left);
    int r = solve(node.right);
    return /* combine node.val, l, r */;
}
// e.g. max depth: if null return 0; return 1 + Math.max(l, r);
~~~

### Traversal orders (DFS)
- **Pre-order**: node, left, right. Good for copying or serializing.
- **In-order**: left, node, right. On a BST this gives **sorted** order.
- **Post-order**: left, right, node. Children before parent (heights, deletes).

### Binary search tree (BST)
Everything in the left subtree is smaller, everything in the right is larger. Search goes one way at each node: O(height), which is O(log n) when balanced.

### Level order (BFS) uses a queue
~~~java
Queue<TreeNode> q = new ArrayDeque<>();
q.offer(root);
while (!q.isEmpty()) {
    TreeNode n = q.poll();
    if (n.left != null) q.offer(n.left);
    if (n.right != null) q.offer(n.right);
}
~~~
`,
      questions: [
        {
          type: 'output',
          code: `class Node {
    int val;
    Node left, right;
    Node(int val, Node left, Node right) { this.val = val; this.left = left; this.right = right; }
}
static void inorder(Node n) {
    if (n == null) return;
    inorder(n.left);
    System.out.print(n.val + " ");
    inorder(n.right);
}

//        4
//       / \\
//      2   6
//     / \\
//    1   3
Node root = new Node(4, new Node(2, new Node(1, null, null), new Node(3, null, null)), new Node(6, null, null));
inorder(root);`,
          answer: '1 2 3 4 6',
          explain: 'In-order visits left subtree, node, right subtree. On a BST like this one, that prints the values sorted.',
        },
        {
          type: 'mcq',
          prompt: 'For the same tree (4 at the root, 2 and 6 as its children, 1 and 3 under 2), what is the **pre-order** traversal?',
          options: ['`1 2 3 4 6`', '`4 2 1 3 6`', '`1 3 2 6 4`', '`4 2 6 1 3`'],
          answer: 1,
          explain: 'Pre-order: node first, then left subtree, then right. 4, then (2, 1, 3), then 6. (`4 2 6 1 3` is level order; `1 3 2 6 4` is post-order.)',
        },
        {
          type: 'fill',
          prompt: 'Complete `maxDepth` (the number of nodes on the longest root-to-leaf path).',
          setup: TREENODE,
          code: `static int maxDepth(TreeNode root) {
    if (root == null) return ___;
    return 1 + Math.max(maxDepth(root.left), maxDepth(root.___));
}`,
          teardown: 'System.out.println(maxDepth(new TreeNode(1, new TreeNode(2, new TreeNode(3), null), new TreeNode(4))));',
          blanks: [['0'], ['right']],
          expect: '3',
          explain: 'An empty tree has depth 0. Otherwise it\'s this node (1) plus the deeper of the two subtrees.',
        },
        {
          type: 'code',
          prompt: 'Return the number of **leaves** (nodes with no children). `TreeNode` is predefined, and tests show trees in level order with `null` for missing children.',
          signature: 'int countLeaves(TreeNode root)',
          needs: ['TreeNode'],
          starter: starter('int countLeaves(TreeNode root)'),
          tests: [
            { args: [[1, 2, 3, 4, 5]], expected: 3 },
            { args: [[]], expected: 0 },
            { args: [[1]], expected: 1 },
            { args: [[1, 2, null, 3, null, 4]], expected: 1 },
            { args: [[5, 3, 8, 1, 4, 7, 9]], expected: 4 },
          ],
          solution: `class Solution {
    public int countLeaves(TreeNode root) {
        if (root == null) return 0;
        if (root.left == null && root.right == null) return 1;
        return countLeaves(root.left) + countLeaves(root.right);
    }
}`,
          explain: 'Two base cases: an empty tree has 0 leaves, and a node with no children **is** a leaf. Otherwise, add up the leaves from both sides.',
        },
        {
          type: 'mcq',
          prompt: 'Searching a **balanced** binary search tree with n nodes takes…',
          options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
          answer: 1,
          explain: 'Each comparison discards one subtree, about half the remaining nodes. (A badly unbalanced BST degrades to O(n), like a linked list.)',
        },
        {
          type: 'order',
          prompt: 'Arrange a level-order (BFS) traversal that prints `4 2 6 1 3`.',
          setup: `${TREENODE}
TreeNode root = new TreeNode(4, new TreeNode(2, new TreeNode(1), new TreeNode(3)), new TreeNode(6));`,
          lines: [
            'Queue<TreeNode> queue = new ArrayDeque<>();',
            'queue.offer(root);',
            'while (!queue.isEmpty()) {',
            '    TreeNode node = queue.poll();',
            '    System.out.print(node.val + " ");',
            '    if (node.left != null) queue.offer(node.left);',
            '    if (node.right != null) queue.offer(node.right);',
            '}',
          ],
          expect: '4 2 6 1 3',
          explain: 'A queue processes nodes in the order they were discovered, which visits the tree level by level. Swap the queue for a stack and you get a depth-first order instead.',
        },
        {
          type: 'bug',
          prompt: 'Inserting a smaller value never shows up in the tree. Which line?',
          setup: TREENODE,
          code: `static TreeNode insert(TreeNode root, int val) {
    if (root == null) return new TreeNode(val);
    if (val < root.val) insert(root.left, val);
    else root.right = insert(root.right, val);
    return root;
}`,
          line: 3,
          fix: 'if (val < root.val) root.left = insert(root.left, val);',
          explain: 'When `root.left` is `null`, the recursive call creates a new node and **returns** it, but the result is dropped. Assign it back, like the right-hand branch does.',
        },
      ],
    },
  ],
};

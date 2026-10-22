// Authoring helpers for Java content.
const DEFAULTS = {
  int: '0', long: '0', double: '0.0', float: '0f', boolean: 'false', char: "' '", String: '""', void: null,
};

function defaultReturn(type) {
  if (type in DEFAULTS) return DEFAULTS[type];
  if (/\[\]$/.test(type)) return `new ${type.replace(/\[\]/, '[0]')}`;
  if (/^List</.test(type)) return 'new ArrayList<>()';
  return 'null';
}

// Build starter code for `class Solution { public <sig> { ... } }`
export function starter(signature, { comment = 'your code here', imports = null, header = '' } = {}) {
  const ret = signature.trim().split(/\s+/)[0];
  const r = defaultReturn(ret);
  const needsUtil = imports ?? /\b(List|Map|Set|ArrayList|HashMap|HashSet|Deque|Queue)\b/.test(signature);
  const body = `        // ${comment}\n` + (r === null ? '' : `        return ${r};\n`);
  return `${needsUtil ? 'import java.util.*;\n\n' : ''}${header}class Solution {\n    public ${signature} {\n${body}    }\n}\n`;
}

export const LISTNODE_HEADER = `/**
 * ListNode is already defined for you:
 * class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { ... }
 * }
 */
`;

export const TREENODE_HEADER = `/**
 * TreeNode is already defined for you:
 * class TreeNode {
 *     int val;
 *     TreeNode left, right;
 *     TreeNode(int val) { this.val = val; }
 *     TreeNode(int val, TreeNode left, TreeNode right) { ... }
 * }
 */
`;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// For problems that modify an array argument in place.
export function inPlace(argIndex = 0) {
  return (ret, args, tc) => ({ pass: same(args[argIndex], tc.expected), got: args[argIndex] });
}

// For "return k, and the first k elements must be ..." problems.
export function firstK(argIndex = 0) {
  return (ret, args, tc) => {
    const got = Array.isArray(args[argIndex]) && typeof ret === 'number' ? args[argIndex].slice(0, Math.max(0, ret)) : ret;
    return { pass: ret === tc.expected.length && same(got, tc.expected), got };
  };
}

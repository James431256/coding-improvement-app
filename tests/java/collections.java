import java.util.*;
public class Main {
    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>();
        for (int i = 0; i < 6; i++) list.add(i * 10);
        list.remove(1);
        list.remove(Integer.valueOf(40));
        list.add(0, -5);
        System.out.println(list + " " + list.size() + " " + list.get(2));
        System.out.println(list.contains(50) + " " + list.indexOf(30));
        list.set(0, 1);
        Collections.sort(list, Collections.reverseOrder());
        System.out.println(list);
        Collections.reverse(list);
        System.out.println(list + " max=" + Collections.max(list));
        Map<String, Integer> m = new HashMap<>();
        String[] words = "the quick brown fox jumps over the lazy dog the end".split(" ");
        for (String w : words) m.put(w, m.getOrDefault(w, 0) + 1);
        System.out.println(m);
        System.out.println(m.get("the") + " " + m.get("cat") + " " + m.containsKey("fox"));
        for (Map.Entry<String, Integer> e : m.entrySet()) {
            if (e.getValue() > 1) System.out.println(e.getKey() + " -> " + e.getValue());
        }
        Map<Character, Integer> freq = new HashMap<>();
        for (char c : "mississippi".toCharArray()) freq.merge(c, 1, Integer::sum);
        System.out.println(freq);
        Map<Integer, String> nums = new HashMap<>();
        for (int i = 20; i >= 0; i -= 3) nums.put(i, "v" + i);
        System.out.println(nums);
        System.out.println(nums.keySet());
        System.out.println(nums.values());
        Map<String, Integer> tm = new TreeMap<>(m);
        System.out.println(tm);
        Map<String, Integer> lhm = new LinkedHashMap<>();
        lhm.put("z", 1); lhm.put("a", 2); lhm.put("m", 3); lhm.put("z", 4);
        System.out.println(lhm);
        Set<Integer> set = new HashSet<>();
        for (int x : new int[]{5, 3, 5, 1, 3, 100, 17, 33}) set.add(x);
        System.out.println(set + " " + set.size());
        System.out.println(set.add(5) + " " + set.add(6));
        Set<String> hs = new HashSet<>(Arrays.asList("banana", "apple", "cherry", "date", "elderberry", "fig"));
        System.out.println(hs);
        TreeSet<Integer> ts = new TreeSet<>(set);
        System.out.println(ts + " " + ts.first() + " " + ts.last() + " " + ts.floor(4) + " " + ts.ceiling(4));
        Deque<Integer> stack = new ArrayDeque<>();
        stack.push(1); stack.push(2); stack.push(3);
        System.out.println(stack + " " + stack.peek() + " " + stack.pop() + " " + stack);
        Stack<Integer> st = new Stack<>();
        st.push(1); st.push(2); st.push(3);
        System.out.println(st + " " + st.peek() + " " + st.pop() + " " + st);
        Queue<String> q = new LinkedList<>();
        q.offer("a"); q.offer("b"); q.add("c");
        System.out.println(q.poll() + " " + q.peek() + " " + q);
        PriorityQueue<Integer> pq = new PriorityQueue<>();
        for (int x : new int[]{5, 1, 8, 3, 2, 9}) pq.add(x);
        System.out.println(pq);
        StringBuilder out = new StringBuilder();
        while (!pq.isEmpty()) out.append(pq.poll()).append(' ');
        System.out.println(out.toString().trim());
        PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Collections.reverseOrder());
        maxHeap.addAll(List.of(4, 9, 2));
        System.out.println(maxHeap.poll());
        PriorityQueue<int[]> pq2 = new PriorityQueue<>((x, y) -> x[1] - y[1]);
        pq2.offer(new int[]{1, 50}); pq2.offer(new int[]{2, 10}); pq2.offer(new int[]{3, 30});
        System.out.println(pq2.poll()[0]);
        Map<String, List<String>> groups = new HashMap<>();
        for (String w : new String[]{"eat", "tea", "tan", "ate", "nat", "bat"}) {
            char[] cs = w.toCharArray();
            Arrays.sort(cs);
            groups.computeIfAbsent(new String(cs), k -> new ArrayList<>()).add(w);
        }
        System.out.println(groups);
        List<List<Integer>> nested = new ArrayList<>();
        nested.add(new ArrayList<>(List.of(1, 2)));
        nested.add(List.of(3));
        System.out.println(nested);
        Iterator<Integer> it = list.iterator();
        while (it.hasNext()) if (it.next() % 20 == 0) it.remove();
        System.out.println(list);
        list.removeIf(x -> x > 40);
        System.out.println(list);
        try {
            for (Integer x : list) if (x == 1) list.remove(x);
        } catch (ConcurrentModificationException e) {
            System.out.println("CME!");
        }
        Map<Integer, Integer> counts = new HashMap<>();
        int[] arr = {1, 1, 2, 3, 3, 3};
        for (int x : arr) counts.put(x, counts.getOrDefault(x, 0) + 1);
        int best = -1, bestC = 0;
        for (int key : counts.keySet()) if (counts.get(key) > bestC) { bestC = counts.get(key); best = key; }
        System.out.println(best + " x" + bestC);
        List<String> names = new ArrayList<>(List.of("bob", "Alice", "carol"));
        names.sort(String.CASE_INSENSITIVE_ORDER);
        System.out.println(names);
        names.sort(null);
        System.out.println(names);
        System.out.println(List.of(1, 2).equals(Arrays.asList(1, 2)));
        Set<List<Integer>> seen = new HashSet<>();
        seen.add(List.of(1, 2)); seen.add(Arrays.asList(1, 2));
        System.out.println(seen.size());
        Map<String, Integer> scores = new HashMap<>();
        scores.put("x", 1);
        scores.putIfAbsent("x", 5);
        scores.putIfAbsent("y", 7);
        System.out.println(scores + " " + scores.remove("x") + " " + scores);
        int total = 0;
        for (int v : scores.values()) total += v;
        System.out.println(total);
        List<Integer> evens = new ArrayList<>();
        for (int i = 0; i <= 10; i += 2) evens.add(i);
        System.out.println(evens.subList(1, 3));
        Integer big1 = 127, big2 = 127;
        System.out.println(big1.equals(big2));
        System.out.println(Collections.frequency(List.of(1, 2, 1, 1), 1));
        Deque<Character> dq = new ArrayDeque<>();
        dq.offerLast('a'); dq.offerFirst('b'); dq.addLast('c');
        System.out.println(dq + " " + dq.pollLast() + " " + dq.peekFirst());
    }
}

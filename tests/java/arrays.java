import java.util.*;
public class Main {
    static void modify(int[] arr) { arr[0] = 99; }
    static void reassign(int[] arr) { arr = new int[]{-1}; }
    static int sum(int... nums) { int s = 0; for (int n : nums) s += n; return s; }
    public static void main(String[] args) {
        int[] a = {5, 3, 8, 1};
        System.out.println(a.length);
        System.out.println(Arrays.toString(a));
        Arrays.sort(a);
        System.out.println(Arrays.toString(a));
        int[] b = new int[3];
        System.out.println(Arrays.toString(b));
        String[] s = new String[2];
        System.out.println(Arrays.toString(s));
        boolean[] bs = new boolean[2];
        double[] ds = new double[2];
        char[] cs = new char[2];
        System.out.println(bs[0] + " " + ds[1] + " " + (int) cs[0]);
        modify(a);
        System.out.println(a[0]);
        reassign(a);
        System.out.println(a[0]);
        int[][] grid = new int[3][4];
        grid[1][2] = 7;
        System.out.println(Arrays.deepToString(grid));
        int[][] jag = {{1}, {2, 3}, {4, 5, 6}};
        System.out.println(jag[2].length + " " + jag.length);
        for (int[] row : jag) {
            for (int v : row) System.out.print(v + " ");
            System.out.println();
        }
        int[] c = a;
        c[1] = 42;
        System.out.println(a[1]);
        int[] copy = Arrays.copyOf(a, 6);
        System.out.println(Arrays.toString(copy));
        System.out.println(Arrays.toString(Arrays.copyOfRange(a, 1, 3)));
        int[] filled = new int[4];
        Arrays.fill(filled, 7);
        System.out.println(Arrays.toString(filled));
        System.out.println(Arrays.equals(new int[]{1,2}, new int[]{1,2}));
        System.out.println(new int[]{1,2} == new int[]{1,2});
        System.out.println(sum() + " " + sum(1) + " " + sum(1, 2, 3));
        Integer[] boxed = {3, 1, 2};
        Arrays.sort(boxed, Collections.reverseOrder());
        System.out.println(Arrays.toString(boxed));
        String[] words = {"pear", "fig", "banana", "kiwi"};
        Arrays.sort(words);
        System.out.println(Arrays.toString(words));
        Arrays.sort(words, (x, y) -> x.length() - y.length());
        System.out.println(Arrays.toString(words));
        Arrays.sort(words, Comparator.comparing(String::length).thenComparing(Comparator.reverseOrder()));
        System.out.println(Arrays.toString(words));
        int[][] pairs = {{3, 1}, {1, 2}, {2, 0}};
        Arrays.sort(pairs, (p, q) -> p[0] - q[0]);
        System.out.println(Arrays.deepToString(pairs));
        Arrays.sort(pairs, (p, q) -> Integer.compare(p[1], q[1]));
        System.out.println(Arrays.deepToString(pairs));
        System.out.println(Arrays.stream(new int[]{4, 5, 6}).sum());
        System.out.println(Arrays.stream(new int[]{4, 5, 6}).max().getAsInt());
        System.out.println(Arrays.binarySearch(new int[]{1, 3, 5, 7}, 5));
        List<Integer> list = Arrays.asList(1, 2, 3);
        System.out.println(list);
        int[] arr2 = {1, 2, 3, 4, 5};
        int lo = 0, hi = arr2.length - 1;
        while (lo < hi) { int t = arr2[lo]; arr2[lo] = arr2[hi]; arr2[hi] = t; lo++; hi--; }
        System.out.println(Arrays.toString(arr2));
        int[] prefix = new int[arr2.length + 1];
        for (int i = 0; i < arr2.length; i++) prefix[i + 1] = prefix[i] + arr2[i];
        System.out.println(Arrays.toString(prefix));
        char[][] board = new char[2][2];
        for (char[] row : board) Arrays.fill(row, '.');
        board[0][1] = 'X';
        for (char[] row : board) System.out.println(new String(row));
        int[] src = {1, 2, 3, 4, 5};
        int[] dst = new int[5];
        System.arraycopy(src, 1, dst, 0, 3);
        System.out.println(Arrays.toString(dst));
        int[] cl = src.clone();
        cl[0] = 100;
        System.out.println(src[0] + " " + cl[0]);
        long[] ls = new long[2];
        ls[0] += 5;
        System.out.println(ls[0]);
        System.out.println(Arrays.asList(words).indexOf("fig"));
    }
}

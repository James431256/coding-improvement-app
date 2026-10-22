import java.util.*;
public class Main {
    static int fib(int n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }
    static long fact(int n) { return n <= 1 ? 1 : n * fact(n - 1); }
    static Map<Integer, Long> memo = new HashMap<>();
    static long fibm(int n) {
        if (n < 2) return n;
        if (memo.containsKey(n)) return memo.get(n);
        long r = fibm(n - 1) + fibm(n - 2);
        memo.put(n, r);
        return r;
    }
    static boolean isPal(String s, int i, int j) { return i >= j || (s.charAt(i) == s.charAt(j) && isPal(s, i + 1, j - 1)); }
    static void perms(String prefix, String rest, List<String> out) {
        if (rest.isEmpty()) { out.add(prefix); return; }
        for (int i = 0; i < rest.length(); i++) perms(prefix + rest.charAt(i), rest.substring(0, i) + rest.substring(i + 1), out);
    }
    static int sumDigits(int n) { return n == 0 ? 0 : n % 10 + sumDigits(n / 10); }
    static int countDown(int n) { if (n == 0) return 0; return 1 + countDown(n - 1); }
    public static void main(String[] args) {
        System.out.println(fib(20));
        System.out.println(fact(20));
        System.out.println(fact(21));
        System.out.println(fibm(80));
        System.out.println(isPal("racecar", 0, 6) + " " + isPal("abca", 0, 3));
        List<String> out = new ArrayList<>();
        perms("", "abc", out);
        System.out.println(out);
        System.out.println(sumDigits(98765));
        System.out.println(countDown(300));
        int[] memo2 = new int[46];
        System.out.println(climb(45, memo2));
    }
    static int climb(int n, int[] memo) {
        if (n <= 2) return n;
        if (memo[n] != 0) return memo[n];
        return memo[n] = climb(n - 1, memo) + climb(n - 2, memo);
    }
}

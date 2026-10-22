import java.util.*;
import java.util.stream.*;
public class Main {
    public static void main(String[] args) {
        List<Integer> nums = List.of(5, 2, 8, 1, 9, 3);
        System.out.println(nums.stream().filter(x -> x % 2 == 1).map(x -> x * x).collect(Collectors.toList()));
        System.out.println(nums.stream().mapToInt(Integer::intValue).sum());
        System.out.println(nums.stream().sorted().toList());
        System.out.println(IntStream.rangeClosed(1, 5).map(x -> x * 2).boxed().collect(Collectors.toList()));
        System.out.println(Stream.of("a", "b", "c").collect(Collectors.joining(", ", "[", "]")));
        System.out.println(nums.stream().max(Integer::compare).get());
        System.out.println(nums.stream().count());
        System.out.println(IntStream.of(3, 1, 2).average().getAsDouble());
        Map<Integer, List<String>> byLen = Stream.of("aa", "b", "cc", "ddd").collect(Collectors.groupingBy(String::length));
        System.out.println(byLen);
        Random rnd = new Random(42);
        System.out.println(rnd.nextInt(100) + " " + rnd.nextInt(100) + " " + rnd.nextInt(10));
        Optional<String> first = Stream.of("x", "yy").filter(s -> s.length() > 1).findFirst();
        System.out.println(first.isPresent() + " " + first.get());
        System.out.println(Integer.MAX_VALUE + Integer.MAX_VALUE);
        System.out.println(Math.abs(Integer.MIN_VALUE));
        System.out.println(Objects.equals(null, null));
        long total = 0;
        for (int i = 0; i < 100000; i++) total += i;
        System.out.println(total);
        System.out.println(Long.parseLong("9000000000") + 1);
        System.out.println(Math.floorMod(-7, 3) + " " + (-7 % 3));
        System.out.println(Character.isLetter('é'));
        System.out.println(Integer.bitCount(255) + " " + Integer.toBinaryString(-1).length());
        StringBuilder sb = new StringBuilder();
        for (String w : "the sky is blue".split(" ")) sb.insert(0, w + " ");
        System.out.println(sb.toString().trim());
        String text = "hello world";
        Map<Character, Integer> cnt = new TreeMap<>();
        for (char c : text.toCharArray()) if (c != ' ') cnt.put(c, cnt.getOrDefault(c, 0) + 1);
        System.out.println(cnt);
        int x = 5;
        x <<= 2;
        x |= 1;
        x ^= 3;
        System.out.println(x);
        double avg = (double) (1 + 2) / 2;
        System.out.println(avg);
        System.out.println(0.1f + 0.2f);
        System.out.println((float) 0.1);
    }
}

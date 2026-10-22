import java.util.*;
interface Shape { double area(); default String describe() { return "Shape with area " + String.format("%.2f", area()); } }
abstract class Animal {
    protected String name;
    private static int count = 0;
    Animal(String name) { this.name = name; count++; }
    abstract String sound();
    public String toString() { return name + " says " + sound(); }
    static int getCount() { return count; }
}
class Dog extends Animal {
    Dog(String n) { super(n); }
    String sound() { return "Woof"; }
}
class Puppy extends Dog {
    Puppy(String n) { super(n + " Jr."); }
    @Override String sound() { return super.sound() + "!"; }
}
class Circle implements Shape {
    private final double r;
    Circle(double r) { this.r = r; }
    public double area() { return Math.PI * r * r; }
}
class Point implements Comparable<Point> {
    final int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
    @Override public boolean equals(Object o) {
        if (!(o instanceof Point)) return false;
        Point p = (Point) o;
        return x == p.x && y == p.y;
    }
    @Override public int hashCode() { return Objects.hash(x, y); }
    @Override public String toString() { return "(" + x + "," + y + ")"; }
    public int compareTo(Point o) { return x != o.x ? x - o.x : y - o.y; }
}
class Counter {
    private int value;
    Counter() { this(10); }
    Counter(int start) { value = start; }
    void inc() { value++; }
    int get() { return value; }
}
enum Color { RED, GREEN, BLUE; Color next() { return values()[(ordinal() + 1) % values().length]; } }
record Pair(String a, int b) {}
class BankAccount {
    private double balance;
    void withdraw(double amt) {
        if (amt > balance) throw new IllegalArgumentException("Insufficient funds");
        balance -= amt;
    }
}
class MyException extends Exception {
    MyException(String msg) { super(msg); }
}
public class Main {
    static void risky(int n) throws MyException { if (n > 2) throw new MyException("too big: " + n); }
    static void change(Counter c) { c.inc(); c = new Counter(); c.inc(); }
    public static void main(String[] args) {
        List<Animal> zoo = new ArrayList<>();
        zoo.add(new Dog("Rex"));
        zoo.add(new Puppy("Rex"));
        for (Animal a : zoo) System.out.println(a);
        System.out.println(Animal.getCount());
        Shape s = new Circle(2);
        System.out.println(s.describe());
        Set<Point> pts = new HashSet<>();
        pts.add(new Point(1, 2)); pts.add(new Point(1, 2)); pts.add(new Point(0, 5));
        System.out.println(pts.size() + " " + pts.contains(new Point(0, 5)));
        List<Point> pl = new ArrayList<>(List.of(new Point(3, 1), new Point(1, 9), new Point(1, 2)));
        Collections.sort(pl);
        System.out.println(pl);
        Point p1 = new Point(1, 1), p2 = new Point(1, 1);
        System.out.println((p1 == p2) + " " + p1.equals(p2));
        Counter c = new Counter();
        change(c);
        System.out.println(c.get());
        Color col = Color.BLUE;
        System.out.println(col + " " + col.ordinal() + " " + col.next() + " " + Color.valueOf("GREEN").name());
        switch (col) {
            case RED: System.out.println("r"); break;
            case BLUE: System.out.println("b");
            case GREEN: System.out.println("fallthrough g"); break;
        }
        for (Color x : Color.values()) System.out.print(x + " ");
        System.out.println();
        Pair pr = new Pair("k", 3);
        System.out.println(pr + " " + pr.a() + " " + pr.equals(new Pair("k", 3)));
        try {
            new BankAccount().withdraw(5);
        } catch (IllegalArgumentException e) {
            System.out.println("Caught: " + e.getMessage());
        } finally {
            System.out.println("finally runs");
        }
        try { risky(1); risky(5); } catch (MyException e) { System.out.println(e.getMessage() + " | " + e); }
        try {
            int[] arr = new int[2];
            arr[2] = 1;
        } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println(e.getMessage());
        }
        try {
            String str = null;
            str.length();
        } catch (NullPointerException e) {
            System.out.println("NPE");
        }
        try {
            Object o = "hi";
            Integer i = (Integer) o;
        } catch (ClassCastException e) {
            System.out.println("CCE");
        }
        try { Integer.parseInt("12a"); } catch (NumberFormatException e) { System.out.println(e.getMessage()); }
        try { System.out.println(10 / 0); } catch (ArithmeticException e) { System.out.println(e); }
        Comparator<String> byLen = new Comparator<String>() {
            @Override public int compare(String a, String b) { return a.length() - b.length(); }
        };
        List<String> ws = new ArrayList<>(List.of("ccc", "a", "bb"));
        ws.sort(byLen);
        System.out.println(ws);
        ws.sort(byLen.reversed());
        System.out.println(ws);
        Runnable r = () -> System.out.println("run!");
        r.run();
        java.util.function.Function<Integer, Integer> dbl = x -> x * 2;
        System.out.println(dbl.apply(21));
        java.util.function.BiFunction<Integer, Integer, Integer> add = (x, y) -> x + y;
        System.out.println(add.apply(2, 3));
        Object o = new Dog("Fido");
        if (o instanceof Dog d) System.out.println("pattern: " + d.name);
        System.out.println(o instanceof Animal);
        int day = 3;
        String name = switch (day) {
            case 1, 7 -> "weekend";
            case 2, 3, 4, 5, 6 -> {
                String t = "week";
                yield t + "day";
            }
            default -> "??";
        };
        System.out.println(name);
        String cmd = "stop";
        switch (cmd) {
            case "go" -> System.out.println("going");
            case "stop" -> System.out.println("stopping");
            default -> System.out.println("unknown");
        }
        outer:
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                if (j == 2) continue outer;
                if (i == 2) break outer;
                System.out.print(i + "" + j + " ");
            }
        }
        System.out.println();
        int n = 0;
        do { n++; } while (n < 5);
        System.out.println(n);
    }
}

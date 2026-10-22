export default {
  id: 'u5',
  title: 'Objects & classes',
  blurb: 'The OOP refresher: constructors and this, inheritance and interfaces, equals/hashCode, comparators and exceptions.',
  lessons: [
    {
      id: 'classes',
      title: 'Classes, constructors & this',
      summary: 'Fields, constructors, static members and object references.',
      notes: `
~~~java
class BankAccount {
    private final String owner;     // set once
    private double balance;         // defaults to 0.0
    private static int count = 0;   // shared by ALL accounts

    BankAccount(String owner) {     // constructor: same name, no return type
        this.owner = owner;         // this.owner is the field, owner is the parameter
        count++;
    }

    void deposit(double amt) { balance += amt; }
    double getBalance() { return balance; }

    @Override
    public String toString() { return owner + ": " + balance; }
}
~~~

- \`new BankAccount("Ada")\` allocates an object and runs the constructor.
- **No constructor written?** Java gives you a free no-arg one. Write any constructor and that free one disappears.
- \`this(...)\` calls another constructor of the same class (it must be the first line).
- \`static\` fields and methods belong to the class, not to individual objects.
- Variables of class type hold **references**. Assigning one variable to another doesn't copy the object.
- Make fields \`private\` and expose methods. That's encapsulation.
- Without \`toString()\`, printing an object gives \`ClassName@1b6d3586\`.
`,
      questions: [
        {
          type: 'output',
          code: `class Counter {
    private int count;
    void increment() { count++; }
    int get() { return count; }
}

Counter a = new Counter();
Counter b = new Counter();
a.increment();
a.increment();
b.increment();
System.out.println(a.get() + " " + b.get());`,
          answer: '2 1',
          explain: 'Each object has its own copy of every non-static field.',
        },
        {
          type: 'output',
          code: `class Ticket {
    static int issued = 0;
    int number;
    Ticket() {
        issued++;
        number = issued;
    }
}

Ticket t1 = new Ticket();
Ticket t2 = new Ticket();
Ticket t3 = new Ticket();
System.out.println(t2.number + " " + Ticket.issued);`,
          answer: '2 3',
          explain: '`issued` is `static`, so there\'s one shared counter. Each ticket copies the current value into its own `number` field.',
        },
        {
          type: 'fill',
          prompt: 'Complete the constructor so the fields get set.',
          code: `class Point {
    int x, y;
    Point(int x, int y) {
        ___.x = x;
        ___.y = y;
    }
}

Point p = new Point(3, 4);
System.out.println(p.x + p.y);`,
          blanks: [['this'], ['this']],
          expect: '7',
          explain: 'The parameters have the same names as the fields, so `this.x` is needed to mean the field.',
        },
        {
          type: 'bug',
          prompt: 'This prints `null`. Which line is the problem?',
          code: `class Person {
    String name;
    Person(String name) {
        name = name;
    }
}

Person p = new Person("Ada");
System.out.println(p.name);`,
          line: 4,
          fix: 'this.name = name;',
          expect: 'Ada',
          explain: 'Inside the constructor, `name` means the **parameter** (it shadows the field), so this assigns the parameter to itself. `this.name` targets the field.',
        },
        {
          type: 'output',
          code: `class Box {
    int value;
}

Box a = new Box();
a.value = 1;
Box b = a;
b.value = 2;
System.out.println(a.value);`,
          answer: '2',
          explain: '`b = a` copies the reference. There\'s only one `Box`, reachable through two variables.',
        },
        {
          type: 'mcq',
          prompt: 'A class defines **only** `Car(String model) { ... }`. What does `new Car()` do?',
          options: [
            'Creates a Car with model `null`',
            'Compile error: no constructor matches',
            'Creates a Car with model `""`',
            'Throws NullPointerException',
          ],
          answer: 1,
          explain: 'The free default constructor only exists when you write **no** constructors. Once you add one, you have to add a no-arg version yourself if you want it.',
        },
        {
          type: 'order',
          prompt: 'Assemble a `Book` class whose `toString` gives `Book: Dune`.',
          lines: [
            'class Book {',
            '    private final String title;',
            '    Book(String title) {',
            '        this.title = title;',
            '    }',
            '    @Override',
            '    public String toString() {',
            '        return "Book: " + title;',
            '    }',
            '}',
          ],
          teardown: 'System.out.println(new Book("Dune"));',
          expect: 'Book: Dune',
          explain: 'Fields, then constructor, then methods. `@Override` sits directly above the method it annotates, and `toString` must be `public`.',
        },
      ],
    },
    {
      id: 'inheritance',
      title: 'Inheritance, interfaces & polymorphism',
      summary: 'extends vs implements, overriding, dynamic dispatch.',
      notes: `
~~~java
interface Shape {                 // a contract: what, not how
    double area();
    default String describe() { return "area " + area(); }
}

abstract class Animal {           // partial implementation, can't be instantiated
    abstract String sound();
    String speak() { return "The animal says " + sound(); }
}

class Dog extends Animal {        // one superclass max
    @Override String sound() { return "Woof"; }
}

class Square implements Shape, Comparable<Square> {  // many interfaces OK
    ...
}
~~~

- **Polymorphism**: \`Animal a = new Dog(); a.speak();\` runs the **Dog** version of \`sound()\`. The method is chosen by the object's *actual* class at runtime.
- But the **declared** type decides what you're *allowed* to call. If \`fetch()\` only exists in \`Dog\`, then \`a.fetch()\` won't compile.
- Constructors chain upwards: \`super(...)\` runs first (Java inserts \`super()\` if you don't).
- Interface methods are implicitly \`public\`, so implementations must be \`public\` too.
- \`instanceof\` checks the type, and pattern matching binds a variable: \`if (a instanceof Dog d) d.fetch();\`
`,
      questions: [
        {
          type: 'output',
          code: `class Animal {
    String sound() { return "..."; }
}
class Dog extends Animal {
    @Override
    String sound() { return "Woof"; }
}
class Cat extends Animal {
    @Override
    String sound() { return "Meow"; }
}

Animal[] pets = {new Dog(), new Cat(), new Animal()};
for (Animal a : pets) System.out.print(a.sound() + " ");`,
          answer: 'Woof Meow ...',
          explain: 'Each call runs the version belonging to the object\'s real class, even though the array type is `Animal`.',
        },
        {
          type: 'output',
          code: `class A {
    A() { System.out.println("A"); }
}
class B extends A {
    B() { System.out.println("B"); }
}
class C extends B {
    C() {
        super();
        System.out.println("C");
    }
}

new C();`,
          answer: 'A\nB\nC',
          explain: 'Every constructor first runs its superclass constructor (explicitly with `super()` or implicitly), so construction goes from the top of the hierarchy down.',
        },
        {
          type: 'mcq',
          prompt: 'Which statement is true?',
          options: [
            'A class can extend several classes but implement only one interface',
            'A class can implement several interfaces but extend only one class',
            'Interfaces can\'t have any method bodies',
            'Abstract classes can be instantiated with `new`',
          ],
          answer: 1,
          explain: 'Single inheritance of classes, multiple inheritance of interfaces. (Interfaces *can* have `default` and `static` methods with bodies.)',
        },
        {
          type: 'fill',
          prompt: 'Connect the types correctly.',
          code: `interface Shape {
    double area();
}
class Rect ___ Shape {
    double w, h;
    Rect(double w, double h) { this.w = w; this.h = h; }
    public double area() { return w * h; }
}
class Square ___ Rect {
    Square(double side) {
        ___(side, side);
    }
}

Shape s = new Square(3);
System.out.println(s.area());`,
          blanks: [['implements'], ['extends'], ['super']],
          expect: '9.0',
          explain: 'Classes `implements` interfaces and `extends` classes. `super(...)` calls the parent constructor.',
        },
        {
          type: 'bug',
          prompt: 'This doesn\'t compile. Which line?',
          code: `interface Greeter {
    String greet(String name);
}
class Polite implements Greeter {
    String greet(String name) {
        return "Good day, " + name;
    }
}`,
          line: 5,
          fix: 'public String greet(String name) {',
          explain: 'Interface methods are implicitly `public`. An implementation can\'t reduce visibility ("attempting to assign weaker access privileges").',
        },
        {
          type: 'output',
          code: `class Base {
    String name() { return "Base"; }
    String hello() { return "Hello from " + name(); }
}
class Child extends Base {
    @Override
    String name() { return "Child"; }
}

Base b = new Child();
System.out.println(b.hello());`,
          answer: 'Hello from Child',
          explain: '`hello()` is inherited from `Base`, but the `name()` call inside it is still dispatched dynamically, to `Child.name()`.',
        },
        {
          type: 'mcq',
          prompt: '`Dog` adds a method `fetch()` that `Animal` doesn\'t have. What happens here?',
          code: `Animal a = new Dog();
a.fetch();`,
          options: ['It calls Dog.fetch()', 'Compile error: cannot find symbol fetch() in Animal', 'ClassCastException at runtime', 'It silently does nothing'],
          answer: 1,
          explain: 'The compiler only knows `a` is an `Animal`. Cast first: `((Dog) a).fetch()`, or use `if (a instanceof Dog d) d.fetch();`.',
        },
      ],
    },
    {
      id: 'equality-exceptions',
      title: 'equals, hashCode, Comparable & exceptions',
      summary: 'What collections expect from your objects, and handling errors.',
      notes: `
### equals & hashCode, always together
\`HashSet\`/\`HashMap\` find things by \`hashCode()\`, then confirm with \`equals()\`. If you override one, override both, or "equal" objects end up as duplicates.

~~~java
@Override public boolean equals(Object o) {          // parameter MUST be Object
    if (!(o instanceof Point p)) return false;
    return x == p.x && y == p.y;
}
@Override public int hashCode() { return Objects.hash(x, y); }
~~~

> Tip: A \`record Point(int x, int y) {}\` generates the constructor, accessors, \`equals\`, \`hashCode\` and \`toString\` for you.

### Ordering
- \`Comparable<T>\`: the object's *natural* order, \`compareTo(other)\`. Returns negative, zero, or positive.
- \`Comparator<T>\`: an external order. \`(a, b) -> a.length() - b.length()\`, \`Comparator.comparing(Person::age)\`, \`.reversed()\`, \`.thenComparing(...)\`.
- Prefer \`Integer.compare(a, b)\` to \`a - b\`, which can overflow.

### Exceptions
~~~java
try {
    risky();
} catch (NumberFormatException | ArithmeticException e) {
    System.out.println("bad: " + e.getMessage());
} finally {
    cleanup();   // always runs
}
~~~
- **Checked** (e.g. \`IOException\`) must be caught or declared with \`throws\`.
- **Unchecked** (\`RuntimeException\` subclasses such as \`NullPointerException\`, \`IllegalArgumentException\`, \`ArrayIndexOutOfBoundsException\`) don't need to be.
- \`throw new IllegalArgumentException("n must be positive");\`
`,
      questions: [
        {
          type: 'mcq',
          prompt: '`Point` has `x` and `y` fields but does **not** override `equals` or `hashCode`. What is printed?',
          code: `Set<Point> set = new HashSet<>();
set.add(new Point(1, 2));
set.add(new Point(1, 2));
System.out.println(set.size());`,
          options: ['`1`', '`2`', '`0`', 'Compile error'],
          answer: 1,
          explain: 'Without overrides, `equals` means "same object", so two separately created points are different elements.',
        },
        {
          type: 'output',
          code: `try {
    int[] a = new int[2];
    a[5] = 1;
    System.out.println("after");
} catch (ArrayIndexOutOfBoundsException e) {
    System.out.println("caught");
} finally {
    System.out.println("done");
}`,
          answer: 'caught\ndone',
          explain: 'The exception skips the rest of the `try` block, the matching `catch` runs, and `finally` always runs.',
        },
        {
          type: 'output',
          code: `List<String> words = new ArrayList<>(List.of("pear", "fig", "banana"));
words.sort((a, b) -> a.length() - b.length());
System.out.println(words);`,
          answer: '[fig, pear, banana]',
          explain: 'The comparator orders by length: 3, 4, 6.',
        },
        {
          type: 'fill',
          prompt: 'Give players a natural order by score (lowest first).',
          code: `class Player implements Comparable<Player> {
    String name; int score;
    Player(String name, int score) { this.name = name; this.score = score; }
    public int compareTo(Player o) {
        return Integer.___(this.score, o.score);
    }
}

List<Player> ps = new ArrayList<>(List.of(new Player("A", 30), new Player("B", 10)));
Collections.sort(ps);
System.out.println(ps.get(0).name);`,
          blanks: [['compare']],
          expect: 'B',
          explain: '`Integer.compare` returns negative/zero/positive and can\'t overflow the way `this.score - o.score` can with extreme values.',
        },
        {
          type: 'mcq',
          prompt: 'Which of these exceptions **must** be caught or declared with `throws`?',
          options: ['`NullPointerException`', '`IOException`', '`ArithmeticException`', '`IllegalArgumentException`'],
          answer: 1,
          explain: '`IOException` is a checked exception. The other three extend `RuntimeException` (unchecked).',
        },
        {
          type: 'output',
          code: `static int parse(String s) {
    try {
        return Integer.parseInt(s);
    } catch (NumberFormatException e) {
        return -1;
    }
}

System.out.println(parse("42") + parse("4x2"));`,
          answer: '41',
          explain: '`"4x2"` can\'t be parsed, so the catch returns -1. `42 + (-1) = 41`.',
        },
        {
          type: 'bug',
          prompt: 'Two `Point(1, 2)` objects are still treated as different by `HashSet`. Which line is wrong?',
          code: `class Point {
    int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
    public boolean equals(Point other) {
        return x == other.x && y == other.y;
    }
    public int hashCode() { return 31 * x + y; }
}`,
          line: 4,
          fix: `@Override public boolean equals(Object o) {
    if (!(o instanceof Point other)) return false;`,
          explain: '`equals(Point)` **overloads** instead of overriding `equals(Object)`, so collections never call it. Adding `@Override` would have made the compiler catch this.',
        },
      ],
    },
  ],
};

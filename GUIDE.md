# A Guide to `Make With`: A Friendly, Functional Approach to Building Objects

For developers rooted in traditional Object-Oriented Programming (OOP), JavaScript classes feel like solid ground. They provide structure, encapsulation, and a familiar syntax. But they also come with JavaScript's most notorious feature—the `this` keyword—and the sometimes rigid hierarchies of class-based inheritance.

`Make With` offers a different path, one built on clarity, predictability, and flexibility. It empowers you to build complex, stateful objects using simple, composable functions instead of class blueprints.

This guide will gently walk you through this paradigm shift. We'll start simple, directly comparing each concept to its OOP equivalent, and show you how this functional approach can lead to code that is easier to test, reason about, and maintain.

<br />

## Part 1: The 'Constructor' & `this` — A Simpler Beginning

Every class starts with a `constructor` to initialize its state and uses `this` to access it. Let's see how `Make With` provides a clearer alternative.

#### The Familiar Way: The Class `constructor`

Let's model a simple user session. With a class, it looks like this:

```typescript
// The "Class" way
class UserSession {
  private user: string;
  private token: string;

  constructor(user: string, token: string) {
    this.user = user;
    this.token = token;
    // 'this' is the context, implicitly created by the 'new' keyword.
  }

  getGreeting() {
    // We must use 'this' to access the session's state.
    return `Hello, ${this.user}. Your token is ${this.token.slice(0, 4)}...`;
  }
}

const session = new UserSession('alice', 'xyz-789-abc');
console.log(session.getGreeting());
```

This is standard practice, but it relies entirely on the magic of `this`. If `getGreeting` were used as a callback or event handler, its `this` context could break, leading to confusing bugs.

#### The `Make With` Way: Explicit State with `provideTo`

`Make With` does away with `this` entirely. **State is never implicit; it is always passed as the first argument to your functions.**

The `provideTo` function is the direct, explicit replacement for a constructor. You provide it the state, and then an object containing the functions (methods) that will operate on that state.

```typescript
import { provideTo } from '@doeixd/make-with';

// The "Make With" way
const sessionState = { user: 'alice', token: 'xyz-789-abc' };

// Our "method" is now just a pure function.
// It receives the state explicitly as its first argument.
const session = provideTo(sessionState)({
  getGreeting: (state) => {
    // 'state' is the sessionState object. No magic, no 'this'.
    return `Hello, ${state.user}. Your token is ${state.token.slice(0, 4)}...`;
  }
});

console.log(session.getGreeting());
```

**Key Difference:** The `getGreeting` function is now decoupled from its state. You could export it and test it in complete isolation simply by passing it a mock state object—no class instantiation required.



<br />

## Part 2: State Changes — Immutability over Mutation

Objects are rarely static. Their state changes. Classes typically mutate their internal properties directly. `Make With` encourages an immutable approach, which can lead to more predictable and bug-free code.

#### The Familiar Way: Direct State Mutation

Let's build a shopping cart. A class would modify its internal `items` array.

```typescript
// The "Class" way
class ShoppingCart {
  public items: string[];
  constructor() {
    this.items = [];
  }
  addItem(item: string) {
    // Direct mutation: this.items is changed in place.
    this.items.push(item);
  }
}

const cart = new ShoppingCart();
cart.addItem('apples'); // Mutates the 'cart' object
cart.addItem('milk');   // Mutates it again
console.log(cart.items); // -> ['apples', 'milk']
```

This is simple, but it can be a source of subtle bugs. If you pass the `cart` object to another part of your application, that part can modify it, causing unexpected side effects elsewhere. You no longer have a clear, traceable data flow.

#### The `Make With` Way: Chainable, Immutable Updates

`Make With` handles state changes with the `makeChainable` helper. When you wrap methods in it, you are telling the library:

1.  This method’s job is to compute and return a **new state object**.
2.  When called, this method should return a **new API instance** bound to that new state.

```typescript
import { provideTo, makeChainable } from '@doeixd/make-with';

// The "Make With" way
const shoppingCart = provideTo({ items: [] as string[] })({
  // Mark methods that change state as chainable
  ...makeChainable({
    addItem: (state, item: string) => {
      // Return a NEW state object, leaving the original untouched.
      return { items: [...state.items, item] };
    }
  }),
  // This is just a "getter"
  getItems: (state) => state.items,
});

const cartV1 = shoppingCart.addItem('apples'); // Returns a brand new cart API
const cartV2 = cartV1.addItem('milk');       // Returns yet another new cart API

// The original is completely untouched!
console.log(shoppingCart.getItems()); // -> []
console.log(cartV2.getItems());       // -> ['apples', 'milk']
```

This pattern gives you a clear history of state. It can make debugging easier (you can log each state version) and helps prevent a category of bugs related to shared mutable state.


<br />

## Part 3: Code Reuse — Flexible Composition over Rigid Inheritance

This is where the functional approach truly shines. Class-based inheritance is powerful but often creates brittle, tightly-coupled code. Functional composition offers a vastly more flexible way to share and extend behavior.

#### The Familiar Way: The `extends` Keyword

Imagine you have a base `ApiClient` and you want to create a version that adds logging to every request. With classes, you’d use `extends` and `super`.

```typescript
// The "Class" way - rigid and coupled
class ApiClient {
  fetch(endpoint: string) {
    console.log(`Fetching from ${endpoint}...`);
    return { data: 'some data' };
  }
}

class LoggedApiClient extends ApiClient {
  fetch(endpoint: string) {
    console.log(`[LOG] Request started: ${endpoint}`);
    const result = super.fetch(endpoint); // Tightly coupled to the parent
    console.log(`[LOG] Request finished.`);
    return result;
  }
}
```

This works, but it locks you into a rigid hierarchy. What if you also want a `CachedApiClient`? Or a `AuthenticatedApiClient`? You can quickly end up with complex, hard-to-manage inheritance chains.

#### The `Make With` Way: Stacking Behaviors like Layers

`Make With` treats behaviors as independent, stackable "layers." The `makeLayered` builder creates an API step-by-step, and the `compose` helper allows one layer to enhance the functionality of a previous one.

```typescript
import { makeLayered, compose } from '@doeixd/make-with';

// Layer 1: The core logic is just a plain object of functions.
const coreApiLogic = {
  fetch: (s, endpoint: string) => {
    console.log(`Fetching from ${endpoint}...`);
    return { data: 'some data' };
  }
};

// Layer 2: A reusable logging "enhancer".
// `compose` lets a new function wrap and call the previous version.
const withLogging = compose({
  fetch: (s, endpoint: string, previousFetch) => {
    console.log(`[LOG] Request started: ${endpoint}`);
    const result = previousFetch(s, endpoint); // No 'super()', just call the previous function
    console.log(`[LOG] Request finished.`);
    return result;
  }
});

// Now, build the final object by stacking the layers.
const finalApiClient = makeLayered({}) // Start with some state (even empty)
  (coreApiLogic)   // Add the base method
  (withLogging)    // Add the logging layer on top
  ();              // Finalize the object

finalApiClient.fetch('/users');
```

The beauty of this approach is that `withLogging` is completely generic. You can apply it to *any* object that has a `fetch` method. You can reorder layers, remove them, or even add them conditionally at runtime—something impossible with static inheritance.


### Addressing the Skeptic: Answering Common Questions

If you're coming from an OOP background, you probably have some questions. Let's tackle them head-on with honesty about the trade-offs.

> **1. "This seems more verbose than just writing a class. Why the extra ceremony?"**

It's true that `provideTo({})({...})` is a bit wordier than `class {}`. This isn't just ceremony; it's **explicitness**. It forces a clear separation between *state* (the data) and *behavior* (the functions). We believe this upfront clarity pays for itself in readability and long-term maintenance. Your logic isn't trapped inside a class instance; it's a library of portable functions.

> **2. "How do I create private state? Classes have `private` fields."**

The most powerful privacy tool in JavaScript isn't a keyword; it's the **closure**. You can achieve perfect encapsulation by creating your object inside a factory function, where its state is protected by the function's scope.

```typescript
function createSecretCounter() {
  // This state is "private". It only exists inside this function's scope.
  const privateState = { count: 0, secret: Math.random() };

  // The returned object's methods can "see" privateState because they are
  // defined within the same closure. The outside world cannot access it.
  return provideTo(privateState)({
    ...makeChainable({
      increment: (s) => ({ ...s, count: s.count + 1 }),
    }),
    getCount: (s) => s.count,
    // We choose NOT to expose the secret.
  });
}

const counter = createSecretCounter();
console.log(counter.getCount()); // -> 0
// console.log(counter.privateState); // -> undefined. It's truly private!
```

> **3. "Isn't this just recreating classes but with more steps?"**

While the end result is similar (an object with state and methods), the fundamental model is different. It’s the difference between a **welded machine** and a set of **Lego bricks**.

*   A **class** welds state and methods into a single, inseparable unit.
*   **`Make With`** gives you a box of Lego bricks (your pure functions) and lets you snap them together with a state object however you see fit.

This compositional model is what makes it so much more flexible and testable.

> **4. "What about organization? Won't my project become a mess of loose functions?"**

Not at all! You should apply the same organizational principles you already use. Instead of having a `services/` directory full of class files, you'll have a `services/` directory where each file exports a set of related, pure functions and perhaps a factory to assemble them.

```typescript
// services/user-service-logic.ts
export const getUser = (s, id) => { /*...*/ };
export const updateUser = (s, id, data) => ({ ...s, ...data });

// services/user-service.ts
import { provideTo, makeChainable } from '@doeixd/make-with';
import * as logic from './user-service-logic';

export const createUserService = (initialState) => {
  return provideTo(initialState)({
    ...makeChainable({
      updateUser: logic.updateUser,
    }),
    getUser: logic.getUser
  });
};
```

This scales beautifully and encourages a clean separation of concerns.



### In Practice: A Side-by-Side Comparison

Let's convert a complete, non-trivial class to the `Make With` pattern.

#### The `ShoppingCart` Class

```typescript
class ShoppingCart {
  private _items: Map<string, { price: number; qty: number }>;

  constructor() {
    this._items = new Map();
  }

  // A chainable method that mutates state
  addItem(name: string, price: number) {
    const existing = this._items.get(name) || { price, qty: 0 };
    this._items.set(name, { ...existing, qty: existing.qty + 1 });
    return this; // Return 'this' for chaining
  }

  // A getter
  get total() {
    let total = 0;
    for (const item of this._items.values()) {
      total += item.price * item.qty;
    }
    return total;
  }

  // A regular method
  getItemCount() {
    return this._items.size;
  }
}

// Usage:
const myCart = new ShoppingCart();
const total = myCart.addItem('apple', 1.50).addItem('milk', 3.00).addItem('apple', 1.50).total;
console.log(`Total: $${total.toFixed(2)}`); // -> Total: $6.00
```

#### The `ShoppingCart` with `Make With`

```typescript
import { provideTo, makeChainable } from '@doeixd/make-with';

// 1. Define the state interface.
interface CartState {
  items: ReadonlyMap<string, { price: number; qty: number }>;
}

// 2. Define the initial state.
const initialState: CartState = { items: new Map() };

// 3. Create the object using the builders.
const shoppingCart = provideTo(initialState)({
  // 4. Wrap state-changing logic in `makeChainable`.
  // These are now pure functions that return a *new* state.
  ...makeChainable({
    addItem: (state, name: string, price: number) => {
      const newItems = new Map(state.items); // Create a mutable copy
      const existing = newItems.get(name) || { price, qty: 0 };
      newItems.set(name, { ...existing, qty: existing.qty + 1 });
      return { items: newItems }; // Return the new state
    },
  }),

  // 5. "Getters" and other methods are just regular functions.
  getTotal: (state) => {
    let total = 0;
    for (const item of state.items.values()) {
      total += item.price * item.qty;
    }
    return total;
  },
  getItemCount: (state) => state.items.size,
});

// Usage (looks almost identical, but is fully immutable):
const newCart = shoppingCart.addItem('apple', 1.50).addItem('milk', 3.00).addItem('apple', 1.50);
const finalTotal = newCart.getTotal();
console.log(`Total: $${finalTotal.toFixed(2)}`); // -> Total: $6.00
```

**A Quick Note on Getters:** Notice the class uses `myCart.total` (a getter property), while the functional version uses `newCart.getTotal()` (a method call). While it's possible to emulate getters with `Make With`, using simple methods is often more direct and aligns better with the functional pattern. The result is the same, with a minor, predictable difference in the calling syntax.

### Some Thoughts

Moving from classes to functional composition is a shift in perspective. It’s less about a rigid blueprint and more about a **flexible recipe**. You start with simple ingredients (pure functions) and compose them into powerful, stateful modules.

`Make With` provides the simple, un-magical tools to make this style of development intuitive and robust, empowering you to write code that is a pleasure to build and maintain.


## The Complete Translation Guide: From Classes to `Make With`

If you've spent years working with classes, you have a powerful mental model for how objects work. This guide's purpose is to map every feature you're familiar with from the class-based world to its equivalent in the `Make With` paradigm.

Our goal isn't to say one is "bad" and the other is "good," but to show how the functional composition approach re-imagines these concepts, often with benefits in clarity and flexibility. We'll use a simple `Counter` for most examples.


#### 1. Concept: The Constructor & Public Properties

*   **What it is:** The `constructor` is a special method for creating and initializing an object. Public properties are the state variables accessible from outside the class.

*   **The Class-Based Approach:**
    ```typescript
    class Counter {
      public count: number;
      public readonly name: string;

      constructor(initialCount: number = 0, name: string) {
        this.count = initialCount;
        this.name = name; // A read-only property
      }
    }
    const myCounter = new Counter(5, 'My Counter');
    console.log(myCounter.count); // -> 5
    myCounter.count = 10; // Publicly accessible and mutable
    ```

*   **The `Make With` Approach:**
    ```typescript
    import { provideTo } from '@doeixd/make-with';

    // State initialization is just creating a plain object.
    const counterState = {
      count: 5,
      name: 'My Counter' // Immutability is a pattern, not a keyword
    };

    // `provideTo` is the "constructor." It binds the state to functions.
    const myCounter = provideTo(counterState)({
      // We'll add methods in the next step
    });

    // Accessing state is usually done via "getter" methods for encapsulation.
    // For example: { getCount: (s) => s.count }
    ```

*   **Discussion & Philosophy:**
    Instead of a `constructor` function that populates a `this` context, `Make With` separates the **data (the state object)** from the **behavior (the functions)**. The "construction" is the act of binding them together with `provideTo`. This makes the state a simple, plain object that is easy to create, serialize (e.g., to JSON), and test.


#### 2. Concept: Public Methods

*   **What it is:** Functions attached to the class instance that operate on its state.

*   **The Class-Based Approach:**
    ```typescript
    class Counter {
      count: number = 0;
      increment() {
        this.count++;
      }
      get() {
        return this.count;
      }
    }
    const myCounter = new Counter();
    myCounter.increment();
    console.log(myCounter.get()); // -> 1
    ```

*   **The `Make With` Approach:**
    ```typescript
    const myCounter = provideTo({ count: 0 })({
      ...makeChainable({
        increment: (state) => ({ count: state.count + 1 }),
      }),
      get: (state) => state.count,
    });

    const newCounter = myCounter.increment();
    console.log(newCounter.get()); // -> 1
    ```

*   **Discussion & Philosophy:**
    A class method is intrinsically tied to its class and `this` context. A `Make With` method is just a **pure function** that receives state as its first argument. This makes it incredibly portable. You can export the `increment` logic `(state) => ({ count: state.count + 1 })` and use it anywhere, completely independent of the `Counter` object.


#### 3. Concept: Getters and Setters

*   **What it is:** Special "accessor" methods that look like properties but execute code when accessed or assigned.

*   **The Class-Based Approach:**
    ```typescript
    class Counter {
      private _value: number = 0;

      get value() {
        console.log('Getting value...');
        return this._value;
      }

      set value(newValue: number) {
        console.log('Setting value...');
        this._value = newValue;
      }
    }
    const myCounter = new Counter();
    myCounter.value = 5; // Calls the setter
    console.log(myCounter.value); // Calls the getter
    ```

*   **The `Make With` Approach:**
    ```typescript
    const myCounter = provideTo({ value: 0 })({
      ...makeChainable({
        // A "setter" is just a regular state-changing method.
        setValue: (state, newValue: number) => ({ value: newValue }),
      }),
      // A "getter" is a regular method that retrieves data.
      getValue: (state) => state.value,
    });

    const newCounter = myCounter.setValue(5);
    console.log(newCounter.getValue());
    ```

*   **Discussion & Philosophy:**
    `Make With` consciously avoids the syntactic sugar of getters/setters in favor of explicit method calls.
    *   **Limitation:** You lose the `myCounter.value` syntax, which can be very convenient. This is a deliberate trade-off.
    *   **Benefit:** The intent becomes clearer. `myCounter.getValue()` is unambiguously a function call that might do work, whereas `myCounter.value` looks like a simple property access. This explicitness can prevent subtle bugs where a "simple" property access is actually executing complex logic.

#### 4. Concept: Private Fields and Methods (`#`)

*   **What it is:** True encapsulation. Fields and methods marked with `#` are completely inaccessible outside the class.

*   **The Class-Based Approach:**
    ```typescript
    class SecretAgent {
      #realName: string;
      constructor(realName: string) {
        this.#realName = realName;
      }
      #getClearance() {
        return 'Top Secret';
      }
      getMission() {
        return `Your mission, ${this.#realName}, is to use clearance: ${this.#getClearance()}`;
      }
    }
    const agent = new SecretAgent('John Doe');
    // console.log(agent.#realName); // -> SyntaxError
    ```

*   **The `Make With` Approach (using Closures):**
    ```typescript
    function createSecretAgent(realName: string) {
      // These are "private" because they only exist inside this factory's scope.
      const privateState = { realName };
      const getClearance = () => 'Top Secret';

      // The returned object's methods can "see" the private variables because
      // they are a "closure"—they close over the scope they were created in.
      return provideTo(privateState)({
        getMission: (state) => {
          return `Your mission, ${state.realName}, is to use clearance: ${getClearance()}`;
        }
      });
    }
    const agent = createSecretAgent('John Doe');
    // There is no way to access `realName` or `getClearance` from here.
    ```

*   **Discussion & Philosophy:**
    This reveals a core difference. Classes use dedicated syntax (`#`) for privacy. `Make With` leverages a fundamental JavaScript feature: **closures**. A closure is arguably a more powerful and "native" form of privacy in JavaScript. By wrapping your object creation in a factory function, you gain perfect encapsulation without needing special syntax.


#### 5. Concept: Static Methods and Properties

*   **What it is:** Methods and properties that belong to the *class itself*, not to an *instance* of the class. They are often used for utility functions.

*   **The Class-Based Approach:**
    ```typescript
    class UnitConverter {
      static LBS_TO_KG = 0.453592;

      static poundsToKilos(pounds: number) {
        return pounds * this.LBS_TO_KG;
      }
    }
    const kilos = UnitConverter.poundsToKilos(10);
    ```

*   **The `Make With` Approach:**
    ```typescript
    // Static properties are just exported constants.
    export const LBS_TO_KG = 0.453592;

    // Static methods are just regular, exported functions.
    export function poundsToKilos(pounds: number): number {
      return pounds * LBS_TO_KG;
    }

    const kilos = poundsToKilos(10);
    ```

*   **Discussion & Philosophy:**
    `Make With` dramatically simplifies this concept. Classes often act as a "namespace" for related utility functions. The functional approach says: if a function doesn't depend on instance state, it shouldn't be attached to an object-creation mechanism at all. It can just be a simple, standalone function. This leads to cleaner, more modular code where your utilities are separate from your stateful object factories.


#### 6. Concept: Type Checking with `instanceof`

*   **What it is:** A way to check if an object was created from a specific class.

*   **The Class-Based Approach:**
    ```typescript
    const myCounter = new Counter();
    console.log(myCounter instanceof Counter); // -> true
    ```

*   **The `Make With` Approach (using Structural Typing):**
    ```typescript
    // There is no "class" to check against.
    // Instead, we check for the object's *shape* or *capabilities*.
    function isCounter(obj: any): obj is CounterAPI { // (assuming CounterAPI type)
      return obj && typeof obj.increment === 'function' && typeof obj.get === 'function';
    }

    const myCounter = createCounter(); // from a factory
    console.log(isCounter(myCounter)); // -> true
    ```
    *For cases where you absolutely need a "brand":*
    ```typescript
    const CounterSymbol = Symbol('CounterAPI');
    const createCounter = () => provideTo({ count: 0 })({
      [CounterSymbol]: true,
      // ...methods
    });
    const myCounter = createCounter();
    // console.log(myCounter[CounterSymbol] === true); // -> true
    ```

*   **Discussion & Philosophy:**
    This is a fundamental paradigm shift. `instanceof` represents **nominal typing** (checking *what it's called*). The functional approach encourages **structural typing** (checking *what it can do*), which is more aligned with JavaScript's dynamic nature and the philosophy of TypeScript. You should care less about what an object *is* and more about whether it *has the methods you need to do the job*. This leads to more flexible and decoupled code. The `Symbol` approach is a pragmatic escape hatch for the rare cases where brand-checking is unavoidable.


    <br />
    <br />

    # From Objects to Functions: A Guide to Functional Composition with `Make With`

*For developers who think in classes, methods, and inheritance*

If you've built your career on solid OOP principles—encapsulation, inheritance, polymorphism—this guide respects that expertise. You're not here because classes are "wrong," but because you've likely hit some walls: complex inheritance hierarchies, `this` binding nightmares, or difficulty testing tightly coupled code.

`Make With` isn't asking you to throw away everything you know. Instead, it's offering you **functional composition** as a powerful alternative that solves many problems you've probably encountered, while keeping the mental models you're comfortable with.

## Your OOP Instincts Are Still Valid

Before we dive in, let's acknowledge what you already know that translates perfectly:

- **Encapsulation** → Still crucial, just achieved differently
- **Single Responsibility** → Even more important with functions
- **Composition over Inheritance** → This is literally what we're doing
- **Interface segregation** → Functions naturally have focused interfaces
- **Dependency injection** → Easier when everything is a function

The core principles remain. We're just changing the implementation strategy.

## The Problems You've Definitely Encountered

### Problem 1: The `this` Nightmare

You've been here:

```typescript
class EventHandler {
  constructor(private name: string) {}
  
  handleClick() {
    console.log(`${this.name} was clicked`);
  }
  
  setupButton() {
    // This breaks - 'this' gets lost
    button.addEventListener('click', this.handleClick);
    
    // You have to do this awkward binding
    button.addEventListener('click', this.handleClick.bind(this));
    // or this arrow function wrapper
    button.addEventListener('click', () => this.handleClick());
  }
}
```

**Your Thought Process:** *"I just want to call a method. Why is `this` so complicated?"*

**Functional Composition Solution:**
```typescript
import { provideTo } from '@doeixd/make-with';

const createEventHandler = (name: string) => 
  provideTo({ name })({
    handleClick: (state) => {
      console.log(`${state.name} was clicked`);
    },
    setupButton: (state, button: HTMLButtonElement, handleClick) => {
      // No binding needed - it's just a function that takes state
      button.addEventListener('click', () => handleClick(state));
    }
  });
```

**Why This Feels Better:** The state is explicit. No mysterious context switching. You pass what you need, when you need it.

### Problem 2: Testing Nightmare with Deep Dependencies

You know this pain:

```typescript
class UserService {
  constructor(
    private db: Database,
    private emailService: EmailService,
    private logger: Logger,
    private config: Config
  ) {}
  
  async createUser(userData: UserData) {
    // Complex method mixing business logic with dependencies
    this.logger.info('Creating user');
    const user = await this.db.save(userData);
    await this.emailService.sendWelcome(user.email);
    return user;
  }
}

// Testing requires mocking EVERYTHING
const service = new UserService(mockDb, mockEmail, mockLogger, mockConfig);
```

**Your Thought Process:** *"I just want to test the business logic. Why do I need to mock the entire world?"*

**Functional Composition Solution:**
```typescript
// Pure business logic - easily testable
export const createUserLogic = (userData: UserData): User => {
  // Validation and transformation logic here
  return { ...userData, id: generateId(), createdAt: new Date() };
};

// Composable service with injected dependencies
const createUserService = (dependencies: Dependencies) => 
  provideTo(dependencies)({
    createUser: async (deps, userData: UserData) => {
      deps.logger.info('Creating user');
      const user = createUserLogic(userData); // Pure function - easy to test
      const savedUser = await deps.db.save(user);
      await deps.emailService.sendWelcome(user.email);
      return savedUser;
    }
  });

// Test just the logic
test('createUserLogic', () => {
  const result = createUserLogic({ name: 'John', email: 'john@test.com' });
  expect(result).toHaveProperty('id');
  expect(result).toHaveProperty('createdAt');
});
```

**Why This Feels Better:** You can test business logic in complete isolation. Dependencies are explicit, not hidden in constructor injection.

### Problem 3: The Inheritance Trap

You've built something like this:

```typescript
class Animal {
  move() { console.log('Moving'); }
}

class Mammal extends Animal {
  breathe() { console.log('Breathing'); }
}

class Dog extends Mammal {
  bark() { console.log('Woof'); }
}

class FlyingDog extends Dog {
  // Wait... this doesn't make sense
  // But I need flying behavior...
  // Do I need FlyingMammal? FlyingAnimal?
  // Multiple inheritance would be nice...
}
```

**Your Thought Process:** *"Inheritance seemed logical until I needed to share behavior across different hierarchies. Now I'm stuck."*

**Functional Composition Solution:**
```typescript
import { makeLayered, compose } from '@doeixd/make-with';

// Individual behaviors as composable pieces
const moveable = {
  move: (state) => { console.log('Moving'); return state; }
};

const breathable = {
  breathe: (state) => { console.log('Breathing'); return state; }
};

const barkable = {
  bark: (state) => { console.log('Woof'); return state; }
};

const flyable = {
  fly: (state) => { console.log('Flying'); return state; }
};

// Compose exactly what you need
const createDog = () => makeLayered({})
  (moveable)
  (breathable)
  (barkable)
  ();

const createFlyingDog = () => makeLayered({})
  (moveable)
  (breathable)
  (barkable)
  (flyable)  // Just add flying - no inheritance conflicts
  ();

const createBird = () => makeLayered({})
  (moveable)
  (breathable)  // Birds breathe too
  (flyable)
  ();
```

**Why This Feels Better:** You compose exactly the behaviors you need. No forcing square pegs into round inheritance holes. Want a flying dog? Just add flying. Want a swimming dog? Add swimming. No diamond problems, no awkward hierarchies.

## Addressing Your Specific Concerns

### "But I Like My Classes Clean and Organized"

**Your Concern:** *"Classes keep everything together. This functional stuff looks scattered."*

**Response:** You can have the same organization, just structured differently:

```typescript
// user/types.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface UserServiceState {
  users: User[];
  currentUser?: User;
}

// user/logic.ts - Pure business logic
export const validateEmail = (email: string): boolean => {
  return /\S+@\S+\.\S+/.test(email);
};

export const createUser = (userData: Omit<User, 'id'>): User => {
  return {
    ...userData,
    id: crypto.randomUUID()
  };
};

export const findUserByEmail = (users: User[], email: string): User | undefined => {
  return users.find(u => u.email === email);
};

// user/behaviors.ts - Stateful behaviors
import { makeChainable } from '@doeixd/make-with';
import * as logic from './logic';

export const userBehaviors = makeChainable({
  addUser: (state: UserServiceState, userData: Omit<User, 'id'>) => {
    const user = logic.createUser(userData);
    return {
      ...state,
      users: [...state.users, user]
    };
  },
  
  setCurrentUser: (state: UserServiceState, email: string) => {
    const user = logic.findUserByEmail(state.users, email);
    return { ...state, currentUser: user };
  }
});

// user/index.ts - Factory
import { provideTo } from '@doeixd/make-with';
import { userBehaviors } from './behaviors';
import * as logic from './logic';

export const createUserService = (initialUsers: User[] = []) =>
  provideTo({ users: initialUsers })({
    ...userBehaviors,
    // Read-only operations
    validateEmail: (_, email: string) => logic.validateEmail(email),
    getCurrentUser: (state) => state.currentUser,
    getAllUsers: (state) => state.users
  });
```

**The Result:** Same organization, better separation of concerns. Logic is testable in isolation, behaviors are composable, and the public API is clean.

### "What About Performance? All This Immutability..."

**Your Concern:** *"Creating new objects every time sounds expensive. My app needs to be fast."*

**Response:** Let's be realistic about performance:

```typescript
// Yes, this creates new objects
const updateUser = (state, userId, updates) => ({
  ...state,
  users: state.users.map(user => 
    user.id === userId ? { ...user, ...updates } : user
  )
});

// But modern JavaScript engines are optimized for this
// And you can optimize when needed:

import { produce } from 'immer'; // Structural sharing

const updateUserOptimized = (state, userId, updates) => 
  produce(state, draft => {
    const user = draft.users.find(u => u.id === userId);
    if (user) Object.assign(user, updates);
  });
```

**Reality Check:** 
- Most apps aren't performance-bound by object creation
- Immutability prevents many bugs that are expensive to debug
- You can optimize hot paths when profiling shows they need it
- The predictability usually outweighs the cost

### "How Do I Handle Complex State Changes?"

**Your Concern:** *"Sometimes I need to coordinate multiple changes across different parts of my object."*

**Response:** Functional composition actually makes this cleaner:

```typescript
// Instead of complex methods that do everything...
class OrderService {
  processOrder(order: Order) {
    // Validate
    if (!this.validateOrder(order)) throw new Error('Invalid');
    
    // Update inventory
    this.updateInventory(order.items);
    
    // Calculate pricing
    this.calculatePricing(order);
    
    // Send notifications
    this.sendNotifications(order);
    
    // Update status
    this.updateStatus(order, 'processed');
  }
}

// Compose smaller, focused functions
const createOrderService = (dependencies) => provideTo(dependencies)({
  ...makeChainable({
    processOrder: (deps, order: Order) => {
      // Each step is a pure function that returns the next state
      const validated = validateOrder(order);
      const withInventory = updateInventory(validated, deps.inventory);
      const withPricing = calculatePricing(withInventory, deps.pricing);
      const withNotifications = sendNotifications(withPricing, deps.notifier);
      return updateStatus(withNotifications, 'processed');
    }
  })
});

// Each step is independently testable and reusable
export const validateOrder = (order: Order): Order => { /* ... */ };
export const updateInventory = (order: Order, inventory: Inventory): Order => { /* ... */ };
export const calculatePricing = (order: Order, pricing: PricingService): Order => { /* ... */ };
```

**Why This Is Better:** Each step is explicit, testable, and reusable. You can test the entire flow or individual steps. You can reorder, skip, or add steps easily.

### "What About Polymorphism? I Use Interfaces a Lot"

**Your Concern:** *"I rely on interfaces and polymorphism for flexibility. How do I achieve the same thing?"*

**Response:** Functional composition gives you even more flexibility:

```typescript
// Instead of interface + implementations...
interface PaymentProcessor {
  processPayment(amount: number): Promise<PaymentResult>;
}

class StripeProcessor implements PaymentProcessor {
  async processPayment(amount: number) { /* Stripe logic */ }
}

class PayPalProcessor implements PaymentProcessor {
  async processPayment(amount: number) { /* PayPal logic */ }
}

// Use function composition with strategy pattern
type PaymentStrategy = (amount: number) => Promise<PaymentResult>;

const stripeStrategy: PaymentStrategy = async (amount) => {
  // Stripe logic
};

const paypalStrategy: PaymentStrategy = async (amount) => {
  // PayPal logic
};

const createPaymentService = (strategy: PaymentStrategy) =>
  provideTo({ strategy })({
    processPayment: (state, amount: number) => state.strategy(amount),
    
    // You can even switch strategies dynamically
    ...makeChainable({
      switchTo: (state, newStrategy: PaymentStrategy) => ({
        ...state,
        strategy: newStrategy
      })
    })
  });

// Usage is just as flexible
const service = createPaymentService(stripeStrategy);
const paypalService = service.switchTo(paypalStrategy);
```

**Why This Is Even Better:** 
- Strategies are just functions - easier to test and compose
- You can switch strategies at runtime
- No need for classes that exist just to implement interfaces
- You can combine multiple strategies easily

## The Mental Model Shift

### From "Objects Have Methods" to "Functions Take State"

**Old Thinking:**
```typescript
user.updateEmail(newEmail)  // The user object updates itself
```

**New Thinking:**
```typescript
updateUserEmail(user, newEmail)  // A function transforms user state
```

This shift eliminates the mystery of "what is `this`?" and makes data flow explicit.

### From "Inheritance Hierarchies" to "Behavior Composition"

**Old Thinking:** Design a class hierarchy that models reality
```
Animal -> Mammal -> Dog -> ServiceDog
```

**New Thinking:** Compose the exact behaviors you need
```typescript
createServiceDog = () => compose(
  mobility,
  breathing, 
  loyalty,
  training,
  serviceAbilities
);
```

### From "Encapsulation via Privacy" to "Encapsulation via Closures"

**Old Thinking:** Hide implementation details with `private`
```typescript
class BankAccount {
  private balance: number;
  private accountNumber: string;
}
```

**New Thinking:** Use closures for true privacy
```typescript
function createBankAccount(initialBalance: number) {
  // This is truly private - not accessible outside this scope
  const secrets = { balance: initialBalance, accountNumber: generateId() };
  
  return provideTo(secrets)({
    getBalance: (state) => state.balance,
    // accountNumber is never exposed
  });
}
```

## Real-World Migration Example

Let's take a complex class and migrate it step by step:

**Original Class:**
```typescript
class DocumentProcessor {
  private plugins: Plugin[] = [];
  private cache = new Map();
  
  constructor(private config: Config) {}
  
  addPlugin(plugin: Plugin) {
    this.plugins.push(plugin);
    return this;
  }
  
  async processDocument(doc: Document): Promise<ProcessedDocument> {
    const cacheKey = this.getCacheKey(doc);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    let result = doc;
    for (const plugin of this.plugins) {
      result = await plugin.process(result, this.config);
    }
    
    const processed = this.finalizeDocument(result);
    this.cache.set(cacheKey, processed);
    return processed;
  }
  
  private getCacheKey(doc: Document): string {
    return `${doc.id}-${doc.version}`;
  }
  
  private finalizeDocument(doc: Document): ProcessedDocument {
    return { ...doc, processedAt: new Date() };
  }
}
```

**Step 1: Extract Pure Logic**
```typescript
// Pure functions - easily testable
export const getCacheKey = (doc: Document): string => 
  `${doc.id}-${doc.version}`;

export const finalizeDocument = (doc: Document): ProcessedDocument => ({
  ...doc,
  processedAt: new Date()
});

export const processWithPlugins = async (
  doc: Document, 
  plugins: Plugin[], 
  config: Config
): Promise<Document> => {
  let result = doc;
  for (const plugin of plugins) {
    result = await plugin.process(result, config);
  }
  return result;
};
```

**Step 2: Create Functional Version**
```typescript
import { provideTo, makeChainable } from '@doeixd/make-with';

interface ProcessorState {
  plugins: Plugin[];
  cache: Map<string, ProcessedDocument>;
  config: Config;
}

export const createDocumentProcessor = (config: Config) =>
  provideTo({ plugins: [], cache: new Map(), config })({
    ...makeChainable({
      addPlugin: (state, plugin: Plugin) => ({
        ...state,
        plugins: [...state.plugins, plugin]
      })
    }),
    
    processDocument: async (state, doc: Document) => {
      const cacheKey = getCacheKey(doc);
      if (state.cache.has(cacheKey)) {
        return state.cache.get(cacheKey)!;
      }
      
      const processed = await processWithPlugins(doc, state.plugins, state.config);
      const finalized = finalizeDocument(processed);
      
      // In a real app, you'd want to return new state with updated cache
      state.cache.set(cacheKey, finalized);
      return finalized;
    }
  });
```

**Step 3: Add Layers for Advanced Features**
```typescript
// Add logging layer
const withLogging = compose({
  processDocument: async (state, doc, previousProcess) => {
    console.log(`Processing document ${doc.id}`);
    const result = await previousProcess(state, doc);
    console.log(`Finished processing ${doc.id}`);
    return result;
  }
});

// Add metrics layer
const withMetrics = compose({
  processDocument: async (state, doc, previousProcess) => {
    const start = Date.now();
    const result = await previousProcess(state, doc);
    const duration = Date.now() - start;
    metrics.record('document.process.duration', duration);
    return result;
  }
});

// Compose the final processor
const processor = makeLayered({ plugins: [], cache: new Map(), config })
  (documentCore)
  (withLogging)
  (withMetrics)
  ();
```

## When to Make the Switch

### Start Here (Low Risk):
- New utility functions
- Data transformation logic
- Independent services
- Testing helpers

### Move Here Next (Medium Risk):
- Services with complex dependencies
- Objects with lots of composition needs
- Code that's hard to test due to `this` binding

### Consider Carefully (High Risk):
- Core domain models that the team knows well
- Code that interfaces heavily with OOP libraries
- Performance-critical paths (measure first)

## The Payoff

After the initial learning curve, developers typically report:

**Immediate Benefits:**
- No more `this` binding bugs
- Easier unit testing
- More predictable debugging
- Clearer data flow

**Long-term Benefits:**
- More flexible architecture
- Easier refactoring
- Better code reuse
- Reduced coupling

**Team Benefits:**
- New developers understand the code faster
- Less time debugging weird inheritance issues
- More consistent patterns across the codebase

## Deep Dive: Advanced Patterns and Real-World Concerns

### Design Patterns in Functional Composition

Your OOP experience with design patterns translates directly—often with simpler implementations:

#### Observer Pattern → Event Composition
```typescript
// Instead of complex observer interfaces...
interface Observer {
  update(event: Event): void;
}

class Subject {
  private observers: Observer[] = [];
  notify(event: Event) {
    this.observers.forEach(o => o.update(event));
  }
}

// Use functional event composition
type EventHandler<T> = (event: T) => void;

const createEventEmitter = <T>() => provideTo({ handlers: [] as EventHandler<T>[] })({
  ...makeChainable({
    subscribe: (state, handler: EventHandler<T>) => ({
      handlers: [...state.handlers, handler]
    }),
    unsubscribe: (state, handler: EventHandler<T>) => ({
      handlers: state.handlers.filter(h => h !== handler)
    })
  }),
  emit: (state, event: T) => {
    state.handlers.forEach(handler => handler(event));
    return state; // No state change for emit
  }
});

// Usage is cleaner and more flexible
const userEvents = createEventEmitter<UserEvent>();
const withLogging = userEvents.subscribe(event => console.log('User event:', event));
const withMetrics = withLogging.subscribe(event => metrics.track(event));
```

#### Strategy Pattern → Function Injection
```typescript
// Instead of strategy interfaces...
interface SortStrategy {
  sort<T>(items: T[], compareFn?: (a: T, b: T) => number): T[];
}

// Just use functions as strategies
type SortStrategy<T> = (items: T[], compareFn?: (a: T, b: T) => number) => T[];

const quickSort: SortStrategy<any> = (items, compareFn) => { /* implementation */ };
const mergeSort: SortStrategy<any> = (items, compareFn) => { /* implementation */ };

const createSorter = <T>(strategy: SortStrategy<T>) => 
  provideTo({ strategy, items: [] as T[] })({
    ...makeChainable({
      setItems: (state, items: T[]) => ({ ...state, items }),
      switchStrategy: (state, newStrategy: SortStrategy<T>) => ({ ...state, strategy: newStrategy })
    }),
    sort: (state, compareFn?: (a: T, b: T) => number) => state.strategy(state.items, compareFn)
  });
```

#### Factory Pattern → Factory Functions with Closures
```typescript
// Instead of abstract factories...
abstract class DatabaseFactory {
  abstract createConnection(): Connection;
  abstract createQuery(): Query;
}

// Use factory functions that can close over configurations
const createDatabaseFactory = (config: DatabaseConfig) => {
  // Private to this factory instance
  const connectionPool = new ConnectionPool(config);
  const queryCache = new Map();

  return {
    createConnection: () => provideTo({ pool: connectionPool })({
      query: (state, sql: string) => state.pool.execute(sql),
      close: (state) => state.pool.release()
    }),
    
    createCachedQuery: () => provideTo({ cache: queryCache })({
      execute: (state, sql: string) => {
        if (state.cache.has(sql)) return state.cache.get(sql);
        const result = connectionPool.execute(sql);
        state.cache.set(sql, result);
        return result;
      }
    })
  };
};
```

### Error Handling in Functional Composition

This is where functional composition requires careful thought:

#### Error Propagation Patterns
```typescript
// Pattern 1: Explicit error states
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

const createUserProcessor = () => provideTo({ users: [] as User[] })({
  ...makeChainable({
    processUser: (state, userData: UserData): Result<{ users: User[] }, string> => {
      try {
        const validatedUser = validateUser(userData);
        const processedUser = processUser(validatedUser);
        return {
          success: true,
          data: { users: [...state.users, processedUser] }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  })
});

// Pattern 2: Error handling layers
const withErrorRecovery = compose({
  processUser: (state, userData, previousProcess) => {
    const result = previousProcess(state, userData);
    if (!result.success && result.error === 'ValidationError') {
      // Try recovery with default values
      const defaultUserData = { ...userData, ...getDefaults() };
      return previousProcess(state, defaultUserData);
    }
    return result;
  }
});

// Pattern 3: Circuit breaker pattern
const withCircuitBreaker = (errorThreshold: number, timeoutMs: number) => {
  let errorCount = 0;
  let lastErrorTime = 0;
  
  return compose({
    processUser: (state, userData, previousProcess) => {
      const now = Date.now();
      
      // Check if circuit is open
      if (errorCount >= errorThreshold && now - lastErrorTime < timeoutMs) {
        return { success: false, error: 'Circuit breaker open' };
      }
      
      try {
        const result = previousProcess(state, userData);
        if (result.success) {
          errorCount = 0; // Reset on success
        } else {
          errorCount++;
          lastErrorTime = now;
        }
        return result;
      } catch (error) {
        errorCount++;
        lastErrorTime = now;
        return { success: false, error: 'Unexpected error' };
      }
    }
  });
};
```

### Working with Legacy OOP Code

Real codebases have constraints. Here's how to bridge the gap:

#### Wrapping Existing Classes
```typescript
// You have existing OOP code you can't change
class LegacyUserService {
  private db: Database;
  constructor(db: Database) { this.db = db; }
  
  async createUser(userData: any): Promise<User> {
    // Complex legacy logic you don't want to rewrite
    return this.db.save(userData);
  }
  
  validateUser(userData: any): boolean {
    // Legacy validation logic
    return true;
  }
}

// Wrap it functionally without rewriting
const createLegacyUserServiceWrapper = (legacyService: LegacyUserService) =>
  provideTo({ legacy: legacyService, cache: new Map() })({
    // Add new functional behaviors on top of legacy
    ...makeChainable({
      createUserWithCaching: async (state, userData: UserData) => {
        const cacheKey = `user-${userData.email}`;
        if (state.cache.has(cacheKey)) {
          return { ...state }; // Return cached
        }
        
        // Use legacy service
        const user = await state.legacy.createUser(userData);
        const newCache = new Map(state.cache);
        newCache.set(cacheKey, user);
        return { ...state, cache: newCache };
      }
    }),
    
    // Expose legacy methods functionally
    validateUser: (state, userData: UserData) => state.legacy.validateUser(userData),
    
    // Add new purely functional methods
    getUserFromCache: (state, email: string) => state.cache.get(`user-${email}`)
  });

// Bridge pattern for gradual migration
const createHybridUserService = (database: Database) => {
  const legacyService = new LegacyUserService(database);
  const functionalWrapper = createLegacyUserServiceWrapper(legacyService);
  
  // Add modern layers on top
  return makeLayered(functionalWrapper)
    (withLogging)
    (withMetrics)
    (withRetry)
    ();
};
```

#### Framework Integration Strategies
```typescript
// Working with Angular (which expects classes)
@Injectable()
export class AngularUserService {
  private functionalCore = createUserService();
  
  // Angular expects methods, so delegate to functional core
  async createUser(userData: UserData): Promise<User> {
    const result = this.functionalCore.createUser(userData);
    // Update Angular's instance with new state
    this.functionalCore = result;
    return result.getLastCreatedUser();
  }
}

// Working with React (which is more functional-friendly)
const useUserService = () => {
  const [service, setService] = useState(() => createUserService());
  
  const createUser = useCallback((userData: UserData) => {
    const newService = service.createUser(userData);
    setService(newService);
    return newService.getLastCreatedUser();
  }, [service]);
  
  return { createUser, users: service.getAllUsers() };
};
```

### When Classes Are Actually Better

Let's be honest about the trade-offs:

#### Stick with Classes When:

**1. Framework/Library Expectations**
```typescript
// React class components (legacy code)
class MyComponent extends React.Component {
  // The framework expects 'this' context
  componentDidMount() {
    this.setState({ mounted: true });
  }
  
  // Converting this to functional composition adds complexity without benefit
}

// ORM models
class User extends BaseModel {
  // ORMs often expect 'this' for method chaining
  // User.where().select().limit() patterns
}
```

**2. Performance-Critical Code with Measured Bottlenecks**
```typescript
// If profiling shows object creation is the bottleneck
class PerformanceCriticalCalculator {
  private cache = new Map();
  
  // Reusing the same instance and mutating state might be faster
  calculate(input: number): number {
    if (this.cache.has(input)) return this.cache.get(input);
    const result = expensiveCalculation(input);
    this.cache.set(input, result);
    return result;
  }
}

// Only do this if you've measured the performance difference!
```

**3. Deep Integration with OOP Libraries**
```typescript
// Libraries that expect 'this' context
class EventEmitter extends Node.EventEmitter {
  // The parent class expects 'this' to work correctly
  emit(event: string, data: any) {
    super.emit(event, data);
    this.logEvent(event, data);
  }
}
```

**4. Team Constraints**
```typescript
// If your team is strongly opposed and timeline is tight
// Sometimes the social cost outweighs the technical benefits
// Better to have working OOP code than half-migrated functional code
```

#### Choose Functional Composition When:

**1. Complex State Coordination**
```typescript
// When you have multiple interdependent state changes
const createOrderProcessor = () => makeLayered(initialState)
  (inventoryManagement)
  (pricingCalculation) 
  (paymentProcessing)
  (shippingCoordination)
  (notificationSending)
  ();
```

**2. High Testability Requirements**
```typescript
// When you need to test business logic in isolation
export const calculateShippingCost = (order: Order, rules: ShippingRules): number => {
  // Pure function - easy to test with any inputs
};

// vs testing a method that requires full object setup
```

**3. Dynamic Behavior Composition**
```typescript
// When behavior needs to change at runtime
const createDynamicService = (features: string[]) => {
  let service = makeLayered(baseState)(coreLogic);
  
  if (features.includes('caching')) service = service(withCaching);
  if (features.includes('logging')) service = service(withLogging);
  if (features.includes('retry')) service = service(withRetry);
  
  return service();
};
```

**4. Microservices/Modular Architecture**
```typescript
// When you need maximum composability across service boundaries
const userService = createUserService();
const orderService = createOrderService(userService.validateUser);
const emailService = createEmailService(userService.getUser, orderService.getOrder);
```

### The Reality Check

**Functional composition is not a silver bullet.** Here are the honest trade-offs:

**You Gain:**
- Predictable state changes
- Easier testing of business logic
- Flexible behavior composition
- No `this` binding issues
- Better debugging of state flow

**You Lose:**
- Familiar class syntax
- Some performance (usually negligible)
- Integration ease with OOP libraries
- Method chaining syntactic sugar
- Established team patterns

**You Trade:**
- Learning curve for the team
- Some verbosity for explicitness
- Memory usage for predictability
- Framework compatibility for flexibility

## Final Thoughts for OOP Developers

You're not abandoning object-oriented thinking—you're evolving it. The principles you value (encapsulation, modularity, reusability) remain central. You're just using different tools to achieve them.

Functional composition isn't about being "more pure" or following trends. It's about solving real problems you've encountered: unpredictable `this` behavior, brittle inheritance hierarchies, and difficult-to-test coupled code.

**Start pragmatically:** Pick one pain point in your current codebase and try solving it with functional composition. You might find that the explicitness and composability start to feel natural—and more importantly, start solving problems you didn't even realize you had.

**Be realistic:** If your team is resistant, your framework expects classes, or you're under time pressure, that's okay. Use classes. The goal isn't to never use classes again—it's to have functional composition as another tool in your toolkit, one that excels at building flexible, testable, and maintainable systems when the conditions are right.

**Know when to stop:** If you find yourself fighting the functional approach, step back. Sometimes a simple class really is the right answer. The best developers know when to use each tool appropriately.

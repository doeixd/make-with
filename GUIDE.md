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

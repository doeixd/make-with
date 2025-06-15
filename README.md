# 🧰 Make With

[![npm version](https://img.shields.io/npm/v/@doeixd/make-with.svg)](https://www.npmjs.com/package/@doeixd/make-with)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Make With** is a small, zero-dependency library for building stateful objects and function-composition patterns in a clean, functional, and simple way. It helps you write predictable, testable code by avoiding the complexities of `this`, classes, and manual state binding.

<br />

## ✨ Guiding Principles

This library is built on a few simple but powerful concepts:

*   **Explicit Over Implicit:** Dependencies (state, config) are always passed as an explicit argument (`subject` or `self`), completely eliminating the confusion of the `this` keyword.
*   **Functions as Building Blocks:** Your logic lives in plain, pure functions. The library provides tools to compose these functions into cohesive, testable APIs without the ceremony of classes.
*   **Immutability by Default:** State-changing operations produce a *new* API instance with the *new* state, leaving the original untouched. This leads to predictable data flow and prevents a whole category of bugs.

<br />

## 📦 Installation

```sh
npm install @doeixd/make-with
```

<br />

## 🚀 Quick Start: From Primitives to a Powerful API

This library provides composable primitives that build on each other. This journey shows how they work together to create a full-featured API.

#### Step 1: The Problem & The Simplest Primitive (`provide`)

Imagine you have functions that all need the same config. Passing it every time is repetitive. The `provide` primitive solves this by "baking in" the context.

```typescript
import { provide } from '@doeixd/make-with';

const config = { token: 'abc', baseUrl: '...' };

// `provide` takes a context and returns a function that takes your functions
const [getUser, getRepos] = provide(config)(
  (cfg, username) => `Getting user ${username} with token ${cfg.token}`,
  (cfg, username) => `Getting repos for ${username} with token ${cfg.token}`
);

// Now the calls are much cleaner.
getUser('alice');

// But you get back a simple array, which isn't a great API.
```

#### Step 2: The Need for Names (`collectFns`)

To build a proper API object, we need named methods like `api.getUser()`. The `collectFns` (`make`) primitive helps by turning loose functions into a named map.

```typescript
import { collectFns } from '@doeixd/make-with';

function myCoolFunction() {}
const myFns = collectFns(myCoolFunction); // -> { myCoolFunction: [Function: myCoolFunction] }
```

#### Step 3: The Core Utility (`provideTo`)

Now, let's combine these ideas. `provideTo` (`makeWith`) is the core utility that directly binds a context to a map of named functions, giving us the clean API we wanted from the start.

```typescript
import { provideTo } from '@doeixd/make-with';

const config = { token: 'abc', baseUrl: '...' };
const apiClient = provideTo(config)({
  getUser: (cfg, username) => { /* ... */ },
  getRepos: (cfg, username) => { /* ... */ },
});

// The result is a clean, organized, and easy-to-use object.
apiClient.getUser('alice');
```

#### Step 4: Managing Changing State (`makeChainable`)

This is great for static configs, but what about dynamic state? `makeChainable` marks methods as state updaters. When called, they return a **whole new API** bound to the new state.

```typescript
import { provideTo, makeChainable } from '@doeixd/make-with';

const counter = provideTo({ count: 0 })({
  ...makeChainable({
    increment: (s) => ({ count: s.count + 1 }),
    add: (s, amount) => ({ count: s.count + amount }),
  }),
  get: (s) => s.count,
});

// Now, it's fully chainable and immutable.
const finalCounter = counter.increment().add(5);
console.log(finalCounter.get()); // 6
console.log(counter.get()); // 0 (The original is untouched)
```

<br />

## 🧠 The Philosophy: Composition Over Confinement

`Make With` is designed around the idea that your logic should be composed of simple, portable functions, not confined within rigid structures.

### 1. Building with Functions, Not Rigid Classes

In OOP, logic is tied to class instances via `this`, making methods difficult to move or reuse. With `Make With`, your logic lives in pure functions that are completely portable.

**The `Make With` Freedom:**
```typescript
// This function can live anywhere. It has no dependency on a class.
// It's just a pure function: (state, input) => newState
const add = (state, amount) => ({ ...state, value: state.value + amount });

// Now, we can easily "provide" it to a state object.
const calculator = provideTo({ value: 10 })({
  ...makeChainable({ add }),
});

const newCalculator = calculator.add(5); // { value: 15 }
```
> **The Takeaway:** Your business logic becomes a library of composable, independently testable functions, not a collection of methods trapped inside a class.

### 2. Stackable Behaviors, Not Brittle Inheritance

Classes use inheritance to share code, which creates tight coupling. `Make With` uses layers of composition, which is far more flexible. Imagine adding logging to an API client.

**The `makeLayered` Composition Approach:**
```typescript
// A generic logging enhancer. It doesn't care what it's wrapping.
const withLogging = {
  get: async (self, path) => { // `self` is the API from the previous layers
    console.log(`[LOG] Requesting: ${path}`);
    const result = await self.get(path); // Calls the original `get` method
    console.log(`[LOG] Success!`);
    return result;
  },
};

// Now, compose the final client by stacking layers:
const client = makeLayered({ baseUrl: "..." })
  ({ get: (s, path) => fetch(`${s.baseUrl}/${path}`).then(res => res.json()) }) // Core logic
  (withLogging) // Add logging on top
  ();

// The final `client.get()` is the enhanced, logged version.
```
> **The Takeaway:** You can build complex objects by stacking independent behaviors, avoiding the rigid hierarchies and tight coupling of inheritance.

### 3. Type Safety with TypeScript

Because the final API is constructed step-by-step, TypeScript can precisely track its shape at every stage. This is especially powerful when building dynamic APIs.

```typescript
const createAuthApi = (user) => {
  const builder = makeLayered({ user })
    (makeChainable({ /* ... base methods ... */ }))
    ({ getUser: (s) => s.user });

  // Conditionally add the admin layer
  if (user.isAdmin) {
    builder({ banUser: (self, username) => console.log(/* ... */) });
  }

  return builder(); // The final API type is inferred correctly!
};

const adminApi = createAuthApi({ name: 'Alice', isAdmin: true });
adminApi.banUser('Bob'); // ✅ Compiles perfectly.

const guestApi = createAuthApi({ name: 'Guest', isAdmin: false });
// guestApi.banUser('Bob'); // 💥 TypeScript Error! Property 'banUser' does not exist.
```
> **The Takeaway:** You get dynamic, compositional power without sacrificing static type safety.

<br />

## 🎩 Advanced Usage: The `makeLayered` Builder

For the most complex scenarios, `makeLayered` gives you ultimate control. It builds an API in distinct, "self-aware" layers.

### Pattern 1: Orchestration (Methods Calling Methods)

The `double` method here orchestrates calls to `get` and `add` from previous layers, using `self` to refer to the API instance being built.

```typescript
import { makeLayered, makeChainable } from '@doeixd/make-with';

const counter = makeLayered({ count: 3 })
  (makeChainable({ add: (s, amount) => ({ ...s, count: s.count + amount }) })) // Base Layer
  ({ get: (s) => s.count }) // Getter Layer
  ({ double: (self) => self.add(self.get()) }) // Enhancer Layer: `self` is the API!
  (); // Finalizer call

const finalCounter = counter.double(); // finalCounter.get() is 6
```

### Pattern 2: Direct Mutation API (When You Want It)

While immutability is the default, `makeLayered` also supports direct mutation patterns that many developers find intuitive and performant. This isn't a compromise - it's a deliberate design choice for scenarios where mutation makes sense.

```typescript
// Simple mutable state with provide
const state = { count: 0 };
const [getState, setState] = provide(state)(
  (state) => state.count,
  (state, value) => { state.count = value; }
);

// Or build a richer mutable API with makeLayered
const mutableCounter = makeLayered({ count: 0 })
  ({
    getSubject: (s) => s,
    get: (s) => s.count,
  })
  ({
    increment: (self) => {
      self.getSubject().count++;
      return self; // Return self for chaining
    },
    add: (self, amount) => {
      self.getSubject().count += amount;
      return self;
    },
  })();

// Direct, efficient, and chainable
mutableCounter.increment().add(5);
console.log(mutableCounter.get()); // 6
```

This pattern shines when:
- You're managing local component state
- Performance is critical
- You prefer a more traditional, stateful API
- You're integrating with systems that expect mutation

<br />

## 🎯 Ideal Use Cases

While flexible, `Make With` excels in these areas:

*   **Building SDKs or API Clients:** Create clean, configured clients where a base config is injected into a set of request functions.
*   **Managing Complex UI Component State:** Handle intricate local state for a component (e.g., a multi-step form) in a predictable way.
*   **Implementing the Builder Pattern:** Construct complex objects step-by-step in a fluent manner, with support for both immutable and mutable styles.
*   **Creating Self-Contained Modules:** Encapsulate logic and state for a specific domain, like a "shopping cart" or "user session" module.

<br />

## 📚 More Examples

For a comprehensive collection of examples demonstrating every feature of the library, check out the **[examples.ts](./examples.ts)** file in the root of this project.

The examples file includes:
- Step-by-step progression from simple to advanced usage
- Real-world patterns like API clients and state machines  
- Custom helper functions and middleware patterns
- Performance optimization techniques
- Complete application examples

<br />

## 🛠️ The Full Toolkit

### Breakdown

| Function | Alias | Description |
|---|---|---|
| `_with` | `provide` | **(Primitive)** Partially applies a subject to an array of functions. |
| `make` | `collectFns` | **(Primitive)** Normalizes loose functions into a key-value object. |
| `makeWith`|`provideTo` | **(Core)** Binds a subject to functions to create a basic API. |
| `rebind` |`makeChainable`| **(Core)** Marks methods for immutable, chainable behavior. |
| `makeLayered`| - | **(Advanced)** Creates a multi-layered, self-aware API using a fluent interface. |
| `enrich` | - | **(Advanced)** Composes two dependent factory functions and merges their results. |

### Core Primitives

#### `_with` / `provide`
```typescript
function _with<S>(subject: S): <Fs extends ((subject: S, ...args: any[]) => any)[]>(
  ...fns: Fs
) => {
  [K in keyof Fs]: Fs[K] extends (subject: S, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;
}
```
**(Primitive)** Partially applies a subject to an array of functions, returning new functions with the subject pre-applied.

**Example:**
```typescript
const [getUser, getRepos] = provide({ token: 'abc' })(
  (cfg, username: string) => `Fetching ${username}...`,
  (cfg, username: string) => `Getting repos for ${username}...`
);
```

#### `make` / `collectFns`
```typescript
// Overload 1: Array of named functions
function make<F extends (...args: any[]) => any>(
  ...fns: F[]
): Record<string, F>;

// Overload 2: Object of functions
function make<Obj extends Methods>(obj: Obj): Obj;

// Where Methods is:
type Methods<S = any> = Record<string, (subject: S, ...args: any[]) => any>;
```
**(Primitive)** Normalizes loose functions into a key-value object. Accepts either named functions or an object.

**Example:**
```typescript
// From named functions
function greet(name: string) { return `Hello, ${name}`; }
const api1 = make(greet); // { greet: Function }

// From object
const api2 = make({
  greet: (name: string) => `Hello, ${name}`
}); // { greet: Function }
```

### Core Utilities

#### `makeWith` / `provideTo`
```typescript
function makeWith<S extends object>(subject: S): <Fns extends Methods<S>>(
  functionsMap: Fns
) => ChainableApi<Fns, S>;

// Where ChainableApi intelligently types chainable vs regular methods:
type ChainableApi<Fns extends Methods<S>, S> = {
  [K in keyof Omit<Fns, typeof IS_CHAINABLE>]:
    Fns[K] extends (s: S, ...args: infer A) => S
      ? (...args: A) => ChainableApi<Fns, S>  // Chainable methods return new API
      : Fns[K] extends (s: S, ...args: infer A) => infer R
        ? (...args: A) => R  // Regular methods return their value
        : never;
};
```
**(Core)** Creates an API by binding a subject to functions. Works with both regular and chainable methods.

**Example:**
```typescript
const api = provideTo({ count: 0 })({
  increment: (s) => ({ count: s.count + 1 }), // Regular method
  get: (s) => s.count
});
```

#### `rebind` / `makeChainable`
```typescript
// Overload 1: Object of functions
function rebind<Obj extends Methods>(obj: Obj): Obj;

// Overload 2: Array of functions
function rebind<Fs extends Array<(...args: any[]) => any>>(
  ...fns: Fs
): Record<string, Fs[number]>;
```
**(Core)** Marks methods for immutable, chainable behavior. When used with `provideTo`, these methods return a new API instance.

**Example:**
```typescript
const counter = provideTo({ count: 0 })({
  ...makeChainable({
    increment: (s) => ({ count: s.count + 1 }),
    add: (s, amount: number) => ({ count: s.count + amount })
  }),
  get: (s) => s.count
});

const newCounter = counter.increment().add(5); // Chainable!
```

### Advanced Utilities

#### `makeLayered`
```typescript
function makeLayered<S extends object>(subject: S): <BaseFns extends Methods<S>>(
  baseFns: BaseFns
) => LayeredApiBuilder<ChainableApi<BaseFns, S>>;

// Where LayeredApiBuilder allows chaining enhancement layers:
type LayeredApiBuilder<CurrentApi extends object> = {
  (): CurrentApi;  // Terminate and get final API
  <EnhancerFns extends Methods<CurrentApi>>(
    enhancerFns: EnhancerFns
  ): LayeredApiBuilder<CurrentApi & BoundApi<CurrentApi, EnhancerFns>>;
};
```
**(Advanced)** Creates a multi-layered, self-aware API. Each layer receives the previous API as context.

**Example:**
```typescript
const api = makeLayered({ value: 10 })
  // Base layer (can be chainable)
  (makeChainable({
    add: (s, n: number) => ({ value: s.value + n })
  }))
  // Enhancement layer (receives 'self' = previous layers)
  ({
    double: (self) => self.add(self.value)
  })
  (); // Terminate and build
```

#### `enrich`
```typescript
function enrich<
  P extends (...args: any[]) => object,
  S extends (primaryResult: ReturnType<P>) => object
>(
  primaryFactory: P,
  secondaryFactory: S
): (...args: Parameters<P>) => ReturnType<P> & ReturnType<S>;
```
**(Advanced)** Composes two factory functions where the second depends on the first, merging their results.

**Example:**
```typescript
const createUser = (name: string) => ({ name, id: Math.random() });
const addPermissions = (user: { id: number }) => ({
  permissions: user.id > 0.5 ? ['admin'] : ['user']
});

const createFullUser = enrich(createUser, addPermissions);
const user = createFullUser('Alice');
// { name: 'Alice', id: 0.7, permissions: ['admin'] }
```

### Type Utilities

The library exports several utility types that may be useful:

```typescript
// A collection of methods that accept a subject as first parameter
type Methods<S = any> = Record<string, (subject: S, ...args: any[]) => any>;

// The resulting API type from makeWith/provideTo
type ChainableApi<Fns extends Methods<S>, S> = { /* ... */ };

// The resulting API type for non-chainable methods in makeLayered
type BoundApi<S, F extends Methods<S>> = {
  [K in keyof F]: F[K] extends (subject: S, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;
};
```
<br />

## ❓ FAQ

**Q: Is this a global state management library?**
**A:** No. `Make With` is designed for creating self-contained, encapsulated objects. It's perfect for local component state or module-level state, but it has no built-in concept of a global, application-wide store.

**Q: What about performance? Isn't creating new objects on every call slow?**
**A:** For the vast majority of use cases (UI state, SDKs), the performance impact is negligible. JavaScript engines are highly optimized for short-lived object creation. For hot paths, you can use the mutable pattern shown in the advanced examples.

**Q: Why the empty `()` call at the end of `makeLayered`?**
**A:** This is the "terminator call." Because `makeLayered` allows a variable number of enhancement layers, it needs a clear signal that you are finished adding layers and want the final object to be constructed. The empty `()` provides an explicit and unambiguous way to finalize the process.

<br />

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Please feel free to submit a Pull Request or open an issue.

<br />

## 📄 License

This project is licensed under the MIT License.

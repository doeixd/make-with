#  🧰 Make With

[![npm version](https://img.shields.io/npm/v/@doeixd/make-with.svg)](https://www.npmjs.com/package/@doeixd/make-with)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Make With** is a small, zero-dependency library for building stateful objects and function-composition patterns in a clean, functional, and simple way. It helps you write predictable, testable code by avoiding the complexities of `this`, classes, and manual state binding.

<br />

## ✨ Guiding Principles

This library is built on a few simple but powerful concepts:

*   **Explicit Over Implicit:** Dependencies (state, config) are always passed as an explicit argument (`subject` or `self`), completely eliminating the confusion of the `this` keyword.
*   **Functions as Building Blocks:** Your logic lives in plain, pure functions. The library provides tools to compose these functions into cohesive, testable APIs without the ceremony of classes.
*   **Immutability by Default:** State-changing operations should produce a *new* API instance with the *new* state, leaving the original untouched. This leads to predictable data flow and prevents a whole category of bugs. However mutable patterns remain possible and well supported as well. 

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

To build a proper API object, we need named methods like `api.getUser()`. The `collectFns` (alias: `make`) primitive helps by turning loose functions into a named map.

```typescript
import { collectFns } from '@doeixd/make-with';

function myCoolFunction() {}
const myFns = collectFns(myCoolFunction); // -> { myCoolFunction: [Function: myCoolFunction] }
```

#### Step 3: The Core Utility (`provideTo`)

Now, let's combine these ideas. `provideTo` (alias: `makeWith`) is the core utility that directly binds a context to a map of named functions, giving us the clean API we wanted from the start.

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
  (); // Finalize and build the API

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

## 🎩 Advanced Usage

### The `makeLayered` Builder

For the most complex scenarios, `makeLayered` gives you ultimate control. It builds an API in distinct, "self-aware" layers.

#### Understanding Layer Functions vs Method Objects

`makeLayered` supports two types of layers:

**Method Objects** - Direct method definitions:
```typescript
{ methodName: (subject, ...args) => result }
```

**Layer Functions** - Functions that receive the current API and return methods:
```typescript
(currentApi) => ({ methodName: (subject, ...args) => result })
```

**When to use Layer Functions:**
- When you need to reference methods from previous layers
- When creating conditional or dynamic method definitions
- When implementing decorators, middleware, or aspect-oriented patterns
- When building methods that orchestrate multiple existing methods

#### Pattern 1: Orchestration (Methods Calling Methods)

The `double` method here orchestrates calls to `get` and `add` from previous layers, using `self` to refer to the API instance being built.

```typescript
import { makeLayered, makeChainable } from '@doeixd/make-with';

const counter = makeLayered({ count: 3 })
  (makeChainable({ add: (s, amount) => ({ ...s, count: s.count + amount }) })) // Base Layer
  ({ get: (s) => s.count }) // Getter Layer
  ({ double: (self) => self.add(self.get()) }) // Enhancer Layer: `self` is the API!
  (); // Finalizer call to build the object

const finalCounter = counter.double(); // finalCounter.get() is 6
```

#### Pattern 1a: Using Layer Functions for Dynamic Orchestration

Layer Functions provide more flexibility by receiving the current API as a parameter:

```typescript
const counter = makeLayered({ count: 3 })
  (makeChainable({ 
    add: (s, amount) => ({ ...s, count: s.count + amount }),
    multiply: (s, factor) => ({ ...s, count: s.count * factor })
  }))
  ({ get: (s) => s.count })
  // Layer Function - receives the current API and returns methods
  ((api) => ({
    double: (s) => api.add(api.get()), // Can call api.add and api.get
    quadruple: (s) => api.multiply(4), // Can orchestrate multiple operations
    addAndDouble: (s, amount) => {
      const withAdded = api.add(amount);
      return withAdded.double();
    }
  }))
  ();

const result = counter.addAndDouble(2); // adds 2, then doubles: (3+2)*2 = 10
```

#### Pattern 2: Direct Mutation API (When You Want It)

While immutability is the default, `makeLayered` also supports direct mutation patterns. This is a deliberate design choice for scenarios where mutable state is more intuitive or performant.

```typescript
const mutableCounter = makeLayered({ count: 0 })
  ({
    getSubject: (s) => s, // A helper to get the raw state object
    get: (s) => s.count,
  })
  ({
    increment: (self) => {
      self.getSubject().count++; // Mutate the state directly
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
This pattern shines when managing local component state, optimizing performance-critical code, or integrating with systems that expect mutation.

#### Pattern 3: Composing Dependent Factories with `enrich`

Sometimes, you need to create an object where one part depends on another (e.g., generating an ID first, then using it to assign permissions). The `enrich` utility composes two factory functions, merging their results.

```typescript
import { enrich } from '@doeixd/make-with';

const createUser = (name: string) => ({ name, id: Math.random() });
const addPermissions = (user: { id: number }) => ({
  permissions: user.id > 0.5 ? ['admin'] : ['guest']
});

const createFullUser = enrich(createUser, addPermissions);
const user = createFullUser('Alice');
// user is { name: 'Alice', id: 0.78, permissions: ['admin'] }
```

<br />

## 🎯 Ideal Use Cases

While flexible, `Make With` excels in these areas:

*   **Building SDKs or API Clients:** Create clean, configured clients where a base config is injected into a set of request functions.
*   **Managing Complex UI Component State:** Handle intricate local state for a component (e.g., a multi-step form) in a predictable way.
*   **Implementing the Builder Pattern:** Construct complex objects step-by-step in a fluent manner, with support for both immutable and mutable styles.
*   **Creating Self-Contained Modules:** Encapsulate logic and state for a specific domain, like a "shopping cart" or "user session" module.

<br />

## 📚 More Examples

For a comprehensive collection of examples demonstrating every feature of the library, check out the **[examples.ts](./examples.ts)** file in the root of this project. It includes real-world patterns, custom helpers, and performance optimization techniques.

<br />

## 🛠️ The Full Toolkit

### Breakdown

| Function | Alias | Description |
|---|---|---|
| `provide` | `_with` | **(Primitive)** Partially applies a subject to an array of functions. |
| `collectFns`| `make` | **(Primitive)** Normalizes loose functions into a key-value object. |
| `merge` | - | **(Primitive)** Merges multiple method objects with later objects taking precedence. Now supports curried usage for functional composition patterns. |
| `createMerger` | - | **(Primitive)** Creates type-safe, auto-curried merger with custom merge strategies and validation. |
| `withFallback` | - | **(Primitive)** Creates intelligent fallback chains with custom validation and nested object support. |
| `provideTo`|`makeWith` | **(Core)** Binds a subject to functions to create a basic API. |
| `makeWithCompose`| - | **(Core)** Like `makeWith` but automatically composes methods with the same name. |
| `makeChainable`| `rebind`| **(Core)** Marks methods for immutable, chainable behavior. |
| `createProxy` | - | **(Core)** Creates dynamic APIs with ES6 Proxy that generate methods on-the-fly. |
| `createLens` | - | **(Core)** Creates lenses that focus operations on specific slices of state. |
| `compose` | - | **(Advanced)** Creates composable methods that can access previous methods with the same name. |
| `makeLayered`| - | **(Advanced)** Creates a multi-layered, self-aware API using a fluent interface. |
| `enrich` | - | **(Advanced)** Composes two dependent factory functions and merges their results. |

### Import Patterns

**Named Imports (Recommended):**
```typescript
import { 
  makeWith, 
  makeChainable, 
  makeLayered, 
  compose, 
  merge, 
  createMerger, 
  createProxy, 
  createLens, 
  withFallback 
} from '@doeixd/make-with';
```

**Default Import (All functions):**
```typescript
import makeWithLib from '@doeixd/make-with';
const api = makeWithLib.makeLayered(state)
  (makeWithLib.makeChainable(methods))
  (makeWithLib.compose(enhancedMethods))
  ();
```

### API Reference

<br />

#### provide (alias: `_with`)
```typescript
function provide<S>(subject: S): <Fs extends ((subject: S, ...args: any[]) => any)[]>(
  ...fns: Fs
) => { /* ... bound functions ... */ }
```
**(Primitive)** Partially applies a subject to an array of functions, returning new functions with the subject pre-applied.

**Example:**
```typescript
const [getUser] = provide({ token: 'abc' })(
  (cfg, username: string) => `Fetching ${username}...`
);
```

<br />

#### collectFns (alias: `make`)
```typescript
function collectFns<F extends (...args: any[]) => any>(...fns: F[]): Record<string, F>;
function collectFns<Obj extends Methods>(obj: Obj): Obj;
```
**(Primitive)** Normalizes loose functions into a key-value object, using the function's `name` property as the key.

**Example:**
```typescript
function greet(name: string) { /* ... */ }
const api = collectFns(greet); // { greet: [Function: greet] }
```

<br />

#### provideTo (alias: `makeWith`)
```typescript
function provideTo<S extends object>(subject: S): <Fns extends Methods<S>>(
  functionsMap: Fns
) => ChainableApi<Fns, S>;
```
**(Core)** Creates an API by binding a subject to a map of functions. It intelligently handles both regular and `makeChainable` methods.

**Example:**
```typescript
const api = provideTo({ count: 0 })({
  get: (s) => s.count
});
```
<br />

#### makeChainable (alias: `rebind`)
```typescript
function makeChainable<Obj extends Methods>(obj: Obj): Obj;
```
**(Core)** Marks methods for immutable, chainable behavior. When used with `provideTo`, these methods return a new API instance with the updated state.

**Example:**
```typescript
const counter = provideTo({ count: 0 })({
  ...makeChainable({
    increment: (s) => ({ count: s.count + 1 }),
  }),
});
const newCounter = counter.increment(); // Chainable!
```

#### `merge`
```typescript
function merge<T extends Methods>(...objects: T[]): T;
function merge<T extends Methods>(firstObject: T): <U extends Methods>(...additionalObjects: U[]) => T & U;
```
**(Primitive)** Merges multiple method objects with later objects taking precedence, or creates a curried merger function for partial application. This enhanced version supports both immediate merging and functional composition patterns.

**Direct Merging (Original Behavior):**
```typescript
const baseMethods = { get: (s) => s.value, set: (s, v) => ({ value: v }) };
const extensions = { increment: (s) => ({ value: s.value + 1 }) };
const validation = { set: (s, v) => v >= 0 ? ({ value: v }) : s }; // Override set

const allMethods = merge(baseMethods, extensions, validation);
const api = makeWith({ value: 0 })(allMethods);
```

**Curried Usage for Extension Patterns:**
```typescript
// Create reusable extensions
const addDefaults = merge({ role: 'user', active: true });
const withAuth = merge({ isAuthenticated: (s) => !!s.token });

// Compose extensions functionally
const userMethods = addDefaults(withAuth({ login: (s, token) => ({ ...s, token }) }));

// Build reusable method enhancers
const withTimestamp = merge({
  addTimestamp: (s) => ({ ...s, createdAt: Date.now() }),
  updateTimestamp: (s) => ({ ...s, updatedAt: Date.now() })
});

const withValidation = merge({
  validate: (s, rules) => rules.every(rule => rule(s))
});

// Chain extensions functionally
const enhancedAPI = makeWith(initialState)(
  withValidation(withTimestamp(baseMethods))
);
```

**Conditional Merging:**
```typescript
const createUserAPI = (isAdmin: boolean) => {
  const base = { getProfile: (s) => s.profile };
  const adminMethods = isAdmin ? { deleteUser: (s, id) => ({ ...s, deleted: [...s.deleted, id] }) } : {};
  return makeWith(initialState)(merge(base)(adminMethods));
};
```

#### `createMerger`
```typescript
function createMerger<T>(mergeDefinition: MergeDefinition<T>): AutoCurriedMerger<T>
function createMerger<T>(tupleDefinitions: TupleMergeDefinition<T>): AutoCurriedMerger<T>
```
**(Primitive)** Creates a type-safe, auto-curried merger function with custom merge strategies and comprehensive error handling. Supports both object-based and tuple-based merge definitions.

**Example:**
```typescript
interface User {
  name: string;
  age: number;
  tags: string[];
}

const userMerger = createMerger<User>({
  name: (a, b, key) => a.name || b.name,
  age: (a, b, key) => Math.max(a.age || 0, b.age || 0),
  tags: (a, b, key) => [...(a.tags || []), ...(b.tags || [])]
});

const result = userMerger({ name: "Alice", age: 25, tags: ["admin"] }, { age: 30, tags: ["user"] });
// Result: { success: true, data: { name: "Alice", age: 30, tags: ["admin", "user"] } }
```

#### `createProxy`
```typescript
function createProxy<S>(handler: ProxyHandler<S>): (initialState: S) => DynamicAPI<S>
```
**(Core)** Creates a dynamic API using ES6 Proxy that generates methods on-the-fly based on a handler function. Includes composable utility functions for common patterns.

**Example:**
```typescript
interface User {
  name: string;
  age: number;
  email: string;
}

// Basic usage with built-in getSet utility
const userAPI = createProxy<User>(getSet)({ name: "Alice", age: 25, email: "alice@example.com" });

const name = userAPI.getName();           // "Alice"
const updated = userAPI.setAge(26);       // Returns new API with age: 26

// Composable utilities
const flexibleAPI = createProxy<User>(ignoreCase(noSpecialChars(getSet)))(userState);
flexibleAPI.getName();     // Standard
flexibleAPI.getname();     // Case insensitive
flexibleAPI.get_name();    // Special chars stripped
```

#### `createLens`
```typescript
function createLens<S, T>(getter: (state: S) => T, setter: (state: S, focused: T) => S): LensFunction<S, T>
```
**(Core)** Creates a lens that focuses method operations on a specific slice of state. Enables building APIs that operate on nested state structures while maintaining type safety and immutability.

**Example:**
```typescript
interface AppState {
  user: { name: string; email: string };
  posts: Post[];
  ui: UIState;
}

// Create lens focused on user slice
const userLens = createLens<AppState, AppState['user']>(
  state => state.user,
  (state, user) => ({ ...state, user })
);

const userMethods = makeChainable({
  updateName: (user, name: string) => ({ ...user, name }),
  updateEmail: (user, email: string) => ({ ...user, email })
});

// API operations automatically work on the user slice
const appAPI = makeWith(appState)(userLens(userMethods));
const newState = appAPI.updateName("Alice").updateEmail("alice@example.com");
```

#### `makeWithCompose`
```typescript
function makeWithCompose<S extends object>(subject: S): (...methodObjects: Methods<S>[]) => ChainableApi<any, S>;
```
**(Core)** Like `makeWith` but automatically composes methods with the same name. Later methods receive previous methods as their last parameter.

**Example:**
```typescript
const api = makeWithCompose({ data: [] })(
  { save: (s, item) => ({ data: [...s.data, item] }) },
  { save: (s, item, prevSave) => prevSave(s, { ...item, timestamp: Date.now() }) },
  { save: (s, item, prevSave) => {
      if (!item.name) throw new Error('Name required');
      return prevSave(s, item);
    }
  }
);
```

#### `compose`
```typescript
function compose<T extends Record<string, any>>(methods: T): T & { [IS_COMPOSABLE]: true };
```
**(Advanced)** Creates composable methods that can access previous methods with the same name. Automatically handles both regular and chainable methods - the previous method always returns the appropriate result.

**Regular Methods Example:**
```typescript
const api = makeLayered({ count: 0 })
  ({ 
    get: (s) => s.count,
    increment: (s) => ({ count: s.count + 1 })
  })
  (compose({
    get: (s, prevGet) => {
      const value = prevGet(s); // Returns number
      console.log('Current count:', value);
      return value;
    }
  }))
  ();
```

**Chainable Methods Example (Automatic Handling):**
```typescript
const api = makeLayered({ count: 0 })
  (makeChainable({
    increment: (s) => ({ count: s.count + 1 }),
    add: (s, amount) => ({ count: s.count + amount })
  }))
  (compose({
    increment: (s, prevIncrement) => {
      console.log('Before:', s.count);
      const newState = prevIncrement(s); // Always returns state object
      console.log('After:', newState.count);
      return newState; // Automatically becomes chainable
    }
  }))
  ();

// Usage: api.increment().add(5).increment() - all chainable!
```

<br />

#### makeLayered
```typescript
function makeLayered<S extends object>(subject: S): LayeredApiBuilder<...>
```
**(Advanced)** Creates a multi-layered, self-aware API. Each layer receives the API constructed from previous layers as its context (`self`). Supports both method objects and layer functions for maximum flexibility.

**Method Object Example:**
```typescript
const api = makeLayered({ value: 10 })
  (makeChainable({ add: (s, n) => ({ value: s.value + n }) }))
  ({ double: (self) => self.add(self.value) })
  ();
```

**Layer Function Example:**
```typescript
const api = makeLayered({ items: [] })
  ({ add: (s, item) => ({ items: [...s.items, item] }) })
  // Layer function receives the current API
  ((currentApi) => ({
    addMultiple: (s, items) => items.reduce((acc, item) => currentApi.add(item), s)
  }))
  ();
```

**Error Handling:**
The library includes a custom `LayeredError` class for enhanced debugging and error tracking throughout the layered composition process.

<br />

#### enrich
```typescript
function enrich<P, S>(primaryFactory: P, secondaryFactory: S): FusedFunction
```
**(Advanced)** Composes two factory functions where the second depends on the first, merging their results into a single object.

**Example:**
```typescript
const createUser = (name: string) => ({ name, id: 1 });
const addStatus = (user: { id: number }) => ({ status: 'active' });
const createFullUser = enrich(createUser, addStatus);
```

#### `withFallback`
```typescript
function withFallback<T>(primaryObject: T, validator?: ValueValidator): FallbackChainBuilder<T>
```
**(Primitive)** Creates a fallback chain proxy that traverses multiple objects to find valid values. Uses a layered API similar to `makeLayered` for building fallback chains.

**Example:**
```typescript
const userConfig = { apiUrl: "https://api.user.com" };
const defaults = { apiUrl: "https://default.com", timeout: 5000, debug: false };

const config = withFallback(userConfig)(defaults)();
console.log(config.apiUrl);   // "https://api.user.com" (from user)
console.log(config.timeout);  // 5000 (from defaults)
```

### `withFallback` vs `Object.assign`

When should you use `withFallback` versus `Object.assign`? Each has different trade-offs:

#### **`Object.assign` - Static Merging**
```typescript
// Memory cost: creates new objects, copying all properties
const merged = Object.assign({}, user, team, defaults);
```

**Pros:**
- **Fast lookups** - Properties are directly accessible
- **Memory efficient for access** - No proxy overhead
- **Simple and familiar** - Standard JavaScript behavior
- **Serializable** - Can be JSON.stringify'd directly

**Cons:**
- **Memory cost on creation** - Copies all properties from all objects
- **No validation** - Invalid values override valid ones
- **Shallow merge** - Nested objects are completely overwritten
- **Static** - Values are fixed at merge time

#### **`withFallback` - Dynamic Fallback**
```typescript
// Runtime cost: proxy traversal, but no memory copying
const config = withFallback(user)(team)(defaults)();
```

**Pros:**
- **Memory efficient for creation** - No copying, just references
- **Validation support** - Skip invalid values with custom validators
- **Deep fallback** - Nested objects preserve properties from multiple sources
- **Dynamic** - Values can change in source objects
- **Writes update source** - Modifications go to the primary object

**Cons:**
- **Runtime cost on access** - Proxy traversal on every property access
- **More complex** - Additional cognitive overhead
- **Not serializable** - Proxy objects need special handling for JSON

#### **When to Use Which**

**Use `Object.assign` when:**
- Configuration is set once and accessed frequently
- You need maximum lookup performance
- Values are simple and don't need validation
- You want standard JavaScript behavior
- Memory usage during creation is not a concern

**Use `withFallback` when:**
- You need validation logic (non-empty strings, positive numbers, etc.)
- Working with nested configuration objects
- Source configurations might change after merging
- Memory efficiency during creation is important
- You want writes to update the primary object

**Example Comparison:**
```typescript
// Object.assign - overwrites entire nested objects
const assigned = Object.assign(
  {},
  { database: { host: "localhost", ssl: false } },
  { database: { port: 5432 } }  // ssl: false is lost!
);

// withFallback - preserves properties from both objects
const fallback = withFallback({ database: { host: "localhost", ssl: false } })
  ({ database: { port: 5432 } })();
// Result: { database: { host: "localhost", ssl: false, port: 5432 } }
```

<br />

## 🔄 Method Composition Patterns

Make With provides powerful composition primitives that allow methods with the same name to work together instead of simply overriding each other.

### The Unified `compose` Primitive

The `compose` function creates methods that can access and enhance previous methods with the same name. It automatically handles both regular and chainable methods, making composition seamless regardless of the method type.

```typescript
// Adding logging to existing methods
const api = makeLayered({ count: 0 })
  (makeChainable({ 
    increment: (s) => ({ count: s.count + 1 }),
    decrement: (s) => ({ count: s.count - 1 })
  }))
  (compose({
    increment: (s, prevIncrement) => {
      console.log('Before increment:', s.count);
      const result = prevIncrement(s);
      console.log('After increment:', result.count);
      return result;
    },
    decrement: (s, prevDecrement) => {
      if (s.count <= 0) {
        console.warn('Cannot decrement below zero');
        return s;
      }
      return prevDecrement(s);
    }
  }))
  ();
```

### Automatic Chainable Handling

The `compose` primitive automatically detects chainable methods and extracts the underlying state:

```typescript
// Composing chainable methods with validation and logging
const api = makeLayered({ count: 0, max: 100 })
  (makeChainable({
    increment: (s) => ({ ...s, count: s.count + 1 }),
    add: (s, amount) => ({ ...s, count: s.count + amount }),
    reset: (s) => ({ ...s, count: 0 })
  }))
  (compose({
    increment: (s, prevIncrement) => {
      if (s.count >= s.max) {
        console.warn('Already at maximum value');
        return s; // No change
      }
      console.log('Incrementing from', s.count);
      return prevIncrement(s); // Returns state object automatically
    },
    add: (s, amount, prevAdd) => {
      if (s.count + amount > s.max) {
        console.warn(`Adding ${amount} would exceed maximum`);
        return prevAdd(s, s.max - s.count); // Add only up to max
      }
      return prevAdd(s, amount);
    }
  }))
  ();

// All methods remain chainable:
const result = api.add(50).increment().add(20); // Logs warnings and enforces limits
```

**How it works:**
- `compose` automatically detects if previous methods return API instances or regular values
- For chainable methods: extracts the state object, so `prevMethod(s)` returns state
- For regular methods: returns the actual result value
- Your composed method doesn't need to know the difference!

### The `makeWithCompose` Auto-Composer

For simpler cases, `makeWithCompose` automatically composes methods when names overlap:

```typescript
// Validation pipeline with automatic composition
const userAPI = makeWithCompose({ users: [] })(
  // Base save functionality
  { save: (s, user) => ({ users: [...s.users, user] }) },
  
  // Add timestamp
  { save: (s, user, prevSave) => prevSave(s, { ...user, createdAt: Date.now() }) },
  
  // Add validation
  { save: (s, user, prevSave) => {
      if (!user.email) throw new Error('Email is required');
      if (!user.name) throw new Error('Name is required');
      return prevSave(s, user);
    }
  },
  
  // Add ID generation
  { save: (s, user, prevSave) => prevSave(s, { ...user, id: crypto.randomUUID() }) }
);

// All validations and transformations happen automatically
const result = userAPI.save({ name: 'Alice', email: 'alice@example.com' });
```

### Common Composition Patterns

#### 1. Before/After Hooks
```typescript
const withLogging = compose({
  save: (s, data, prevSave) => {
    console.log('Starting save operation...');
    const result = prevSave(s, data);
    console.log('Save completed successfully');
    return result;
  }
});
```

#### 2. Error Handling Wrapper
```typescript
const withErrorHandling = compose({
  process: (s, input, prevProcess) => {
    try {
      return prevProcess(s, input);
    } catch (error) {
      console.error('Processing failed:', error);
      return s; // Fallback to current state
    }
  }
});
```

#### 3. Caching Layer
```typescript
const withCaching = compose({
  expensiveOperation: (s, key, prevOperation) => {
    if (s.cache && s.cache[key]) {
      return s.cache[key];
    }
    
    const result = prevOperation(s, key);
    return {
      ...result,
      cache: { ...s.cache, [key]: result }
    };
  }
});
```

#### 4. Validation Pipeline
```typescript
const withValidation = compose({
  update: (s, data, prevUpdate) => {
    // Pre-validation
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data: must be an object');
    }
    
    const result = prevUpdate(s, data);
    
    // Post-validation
    if (!result.isValid) {
      throw new Error('Update resulted in invalid state');
    }
    
    return result;
  }
});
```

### Composition vs Inheritance

Traditional OOP uses inheritance hierarchies that can become brittle:

```typescript
// ❌ Inheritance approach - rigid and hard to test
class BaseUser extends User {
  save() { /* base logic */ }
}

class ValidatedUser extends BaseUser {
  save() { 
    this.validate();
    super.save(); // Tightly coupled to parent
  }
}

class LoggedUser extends ValidatedUser {
  save() {
    this.log('saving...');
    super.save(); // Long inheritance chain
    this.log('saved');
  }
}
```

```typescript
// ✅ Composition approach - flexible and testable
const userAPI = makeLayered({ users: [] })
  ({ save: (s, user) => ({ users: [...s.users, user] }) })      // Base
  (compose({ save: (s, user, prev) => /* validation */ }))       // Validation
  (compose({ save: (s, user, prev) => /* logging */ }))          // Logging
  ();
```

**Benefits of Composition:**
- **Flexible ordering** - Add layers in any order
- **Independent testing** - Test each layer separately  
- **Runtime composition** - Add/remove behaviors dynamically
- **No inheritance chains** - Avoid brittle hierarchies
- **Type safety** - Full TypeScript inference throughout

<br />

## 🏷️ TypeScript Guide

Make With is built from the ground up with TypeScript, providing excellent type safety and inference. This section covers the type system, generics, and best practices.

### Core Type Concepts

#### 1. The `Methods<S>` Type
The foundation type representing a collection of methods that operate on a subject:
```typescript
type Methods<S = any> = Record<string, (subject: S, ...args: any[]) => any>;

// Example usage:
interface UserState {
  name: string;
  age: number;
}

const userMethods: Methods<UserState> = {
  getName: (state) => state.name,
  setAge: (state, age: number) => ({ ...state, age }),
  isAdult: (state) => state.age >= 18
};
```

#### 2. The `ChainableApi<Fns, S>` Type
The sophisticated return type that correctly infers chainable vs regular methods:
```typescript
type ChainableApi<Fns extends Methods<S>, S> = {
  [K in keyof Omit<Fns, typeof IS_CHAINABLE>]: Fns[K] extends (
    s: S,
    ...args: infer A
  ) => S
    ? (...args: A) => ChainableApi<Fns, S>  // Chainable methods return new API
    : Fns[K] extends (s: S, ...args: infer A) => infer R
      ? (...args: A) => R                   // Regular methods return their result
      : never;
};
```

#### 3. Layer Function Types
For advanced `makeLayered` composition:
```typescript
type LayerFunction<CurrentApi extends object> = 
  (currentApi: CurrentApi) => Methods<CurrentApi>;

// Example:
const addLogging: LayerFunction<{ save: () => void }> = (api) => ({
  saveWithLog: (state) => {
    console.log('Saving...');
    api.save();
    console.log('Saved!');
  }
});
```

### Type Inference and Safety

#### 1. Automatic Return Type Inference
TypeScript automatically infers the correct API shape:
```typescript
const counter = makeWith({ count: 0 })({
  ...makeChainable({
    increment: (s) => ({ count: s.count + 1 }),     // Returns new API
    add: (s, n: number) => ({ count: s.count + n }) // Returns new API
  }),
  get: (s) => s.count,                              // Returns number
  isEven: (s) => s.count % 2 === 0                  // Returns boolean
});

// TypeScript knows the exact types:
const newCounter = counter.increment();     // Type: ChainableApi<...>
const count: number = counter.get();        // Type: number
const even: boolean = counter.isEven();     // Type: boolean
```

#### 2. Parameter Type Safety
Method parameters are strictly typed:
```typescript
interface TodoState {
  items: Array<{ id: string; text: string; done: boolean }>;
}

const todoAPI = makeWith({ items: [] } as TodoState)({
  ...makeChainable({
    addTodo: (state, text: string) => ({
      items: [...state.items, { id: crypto.randomUUID(), text, done: false }]
    }),
    toggleTodo: (state, id: string) => ({
      items: state.items.map(item => 
        item.id === id ? { ...item, done: !item.done } : item
      )
    })
  }),
  getTodo: (state, id: string) => state.items.find(item => item.id === id),
  getTodoCount: (state) => state.items.length
});

// TypeScript enforces parameter types:
todoAPI.addTodo("Buy milk");           // ✅ string parameter
todoAPI.toggleTodo("some-id");         // ✅ string parameter
// todoAPI.addTodo(123);               // ❌ TS Error: number not assignable to string
```

#### 3. Layered API Type Building
`makeLayered` progressively builds type information:
```typescript
const api = makeLayered({ value: 0 })
  // Layer 1: Base methods
  (makeChainable({
    add: (s, n: number) => ({ value: s.value + n }),
    multiply: (s, n: number) => ({ value: s.value * n })
  }))
  // Layer 2: Getters (TypeScript knows about add/multiply)
  ({
    get: (s) => s.value,
    getDouble: (s) => s.value * 2
  })
  // Layer 3: Orchestration (TypeScript knows about all previous methods)
  ((currentApi) => ({
    addThenDouble: (s, n: number) => {
      const withAdded = currentApi.add(n);    // TS knows this returns new API
      return withAdded.getDouble();           // TS knows this returns number
    }
  }))
  ();

// TypeScript knows the complete API shape
const result: number = api.addThenDouble(5); // Type: number
```

### Common TypeScript Gotchas

#### 1. Losing Type Information with `any`
```typescript
// ❌ Using any loses all type safety
const badAPI = makeWith({ count: 0 } as any)({
  increment: (s: any) => ({ count: s.count + 1 })  // No type checking!
});

// ✅ Use proper interfaces
interface CounterState {
  count: number;
}

const goodAPI = makeWith({ count: 0 } as CounterState)({
  increment: (s) => ({ count: s.count + 1 })  // Fully typed!
});
```

#### 2. Method Signature Mismatches
```typescript
interface State {
  items: string[];
}

// ❌ Wrong: method doesn't match expected signature
const badMethods = {
  // Should be (subject: State, item: string) => newState
  addItem: (item: string) => item  // Missing subject parameter!
};

// ✅ Correct: proper method signature
const goodMethods: Methods<State> = {
  addItem: (state, item: string) => ({ items: [...state.items, item] })
};
```

#### 3. Chainable vs Non-Chainable Return Types
```typescript
const api = makeWith({ value: 0 })({
  ...makeChainable({
    // ❌ Chainable method not returning new state
    badIncrement: (s) => {
      console.log('incrementing');
      // Missing return! TypeScript will catch this.
    },
    
    // ✅ Chainable method returning new state
    goodIncrement: (s) => ({ value: s.value + 1 })
  }),
  
  // ❌ Non-chainable method trying to be chainable
  getValue: (s) => ({ value: s.value }),  // Should just return s.value
  
  // ✅ Non-chainable method
  get: (s) => s.value
});
```

#### 4. Generic Type Constraints
```typescript
// When creating reusable functions, use proper constraints
function createCounter<T extends { count: number }>(initialState: T) {
  return makeWith(initialState)({
    ...makeChainable({
      increment: (s) => ({ ...s, count: s.count + 1 }),
      add: (s, n: number) => ({ ...s, count: s.count + n })
    }),
    get: (s) => s.count
  });
}

// Works with any object that has a count property
const simpleCounter = createCounter({ count: 0 });
const complexCounter = createCounter({ count: 0, name: "My Counter", active: true });
```

### Advanced Type Patterns

#### 1. Conditional API Building
```typescript
function createUserAPI<T extends { isAdmin?: boolean }>(user: T) {
  const baseAPI = makeLayered(user)
    ({ getName: (u) => u.name })
    ({ getRole: (u) => u.isAdmin ? 'admin' : 'user' });

  // Conditionally add admin methods
  if (user.isAdmin) {
    return baseAPI
      ({ deleteUser: (u, id: string) => `Admin ${u.name} deleting user ${id}` })
      ();
  }

  return baseAPI();
}

const adminAPI = createUserAPI({ name: 'Alice', isAdmin: true });
// TypeScript knows adminAPI has deleteUser method

const userAPI = createUserAPI({ name: 'Bob', isAdmin: false });
// TypeScript knows userAPI does NOT have deleteUser method
```

#### 2. Type-Safe Factory Composition
```typescript
interface UserBase {
  name: string;
  id: string;
}

interface UserWithPermissions extends UserBase {
  permissions: string[];
}

const createUser = (name: string): UserBase => ({
  name,
  id: crypto.randomUUID()
});

const addPermissions = (user: UserBase): Pick<UserWithPermissions, 'permissions'> => ({
  permissions: user.name.includes('admin') ? ['read', 'write', 'delete'] : ['read']
});

// TypeScript correctly infers the merged type
const createFullUser = enrich(createUser, addPermissions);
const user = createFullUser('admin-alice'); // Type: UserBase & { permissions: string[] }
```

### Best Practices for Type Safety

1. **Always use interfaces for state objects**
2. **Leverage TypeScript's inference instead of explicit typing**
3. **Use `as const` for literal types when needed**
4. **Prefer composition over complex inheritance hierarchies**
5. **Use proper generic constraints for reusable functions**

<br />

## 🚨 Troubleshooting & Error Reference

Make With includes comprehensive error handling with descriptive messages to help you identify and fix issues quickly. All errors are instances of the custom `LayeredError` class.

### Common Error Scenarios

#### 1. Invalid Subjects (State Objects)

**Error:** `[makeWith] Subject cannot be null or undefined`
```typescript
// ❌ This will throw
makeWith(null)({ get: (s) => s });
makeWith(undefined)({ get: (s) => s });

// ✅ Use valid objects
makeWith({})({ get: (s) => s });
makeWith({ value: 0 })({ get: (s) => s.value });
```

**Error:** `[makeWith] Subject must be an object, got string`
```typescript
// ❌ Primitives are not allowed
makeWith("hello")({ length: (s) => s.length });

// ✅ Wrap primitives in objects
makeWith({ value: "hello" })({ length: (s) => s.value.length });
```

#### 2. Function Validation Errors

**Error:** `[make] Argument at index 1 must be a function, got string`
```typescript
// ❌ All arguments must be functions
make(validFunction, "not a function", anotherFunction);

// ✅ Only pass functions
make(validFunction, anotherFunction);
```

**Error:** `[make] Function at index 0 must have a non-empty name`
```typescript
// ❌ Anonymous functions need names for the API
make(() => "hello");

// ✅ Use named functions or provide as object
make(function hello() { return "hello"; });
// OR
make({ hello: () => "hello" });
```

**Error:** `[make] Duplicate function name "save" found`
```typescript
// ❌ Function names must be unique
function save() { /* version 1 */ }
function save() { /* version 2 */ }
make(save, save);

// ✅ Use different names or pass as object to override
make({ save: () => "version 2" });
```

#### 3. Chainable Method Return Value Errors

**Error:** `[makeWith] Chainable method "increment" returned undefined`
```typescript
const counter = makeWith({ count: 0 })({
  ...makeChainable({
    // ❌ Chainable methods must return new state
    increment: (s) => { s.count++; } // returns undefined
  })
});

// ✅ Return new state object
increment: (s) => ({ count: s.count + 1 })
```

**Error:** `[makeWith] Chainable method "reset" returned string. Chainable methods must return a new state object`
```typescript
// ❌ Chainable methods must return objects
reset: (s) => "reset complete"

// ✅ Return object state
reset: (s) => ({ count: 0 })
```

#### 4. Layer Function Errors

**Error:** `[makeLayered] Layer function must accept exactly one parameter, got function with 2 parameters`
```typescript
// ❌ Layer functions must accept exactly one parameter (the current API)
makeLayered({ value: 0 })
  ({ add: (s, n) => ({ value: s.value + n }) })
  ((api, extraParam) => ({ double: (s) => api.add(api.value) })) // Wrong!
  ();

// ✅ Layer functions take only the current API
((api) => ({ double: (s) => api.add(api.value) }))
```

**Error:** `[makeLayered] Layer function must return an object of methods, got undefined`
```typescript
// ❌ Layer functions must return method objects
((api) => {
  console.log("Setting up layer...");
  // Missing return statement!
})

// ✅ Always return methods object
((api) => ({
  logAndDouble: (s) => {
    console.log("Doubling...");
    return api.add(api.value);
  }
}))
```

#### 5. Factory Composition Errors (`enrich`)

**Error:** `[enrich] Primary factory must return an object, got string`
```typescript
// ❌ Both factories must return objects
const badPrimary = (name) => `Hello ${name}`; // returns string
const secondary = (obj) => ({ timestamp: Date.now() });

enrich(badPrimary, secondary);

// ✅ Return objects from both factories
const goodPrimary = (name) => ({ greeting: `Hello ${name}` });
```

#### 6. Composition Method Patterns

**Understanding what `prevMethod` returns:**

```typescript
// ✅ Correct: compose automatically handles both types
const api = makeLayered({ count: 0 })
  (makeChainable({ increment: (s) => ({ count: s.count + 1 }) }))
  ({ get: (s) => s.count })
  (compose({
    increment: (s, prevIncrement) => {
      const newState = prevIncrement(s); // ✅ Always returns state object
      return { count: newState.count + 1 }; // Clear state transformation
    },
    get: (s, prevGet) => {
      const value = prevGet(s); // ✅ Returns the actual number
      console.log('Current count:', value);
      return value;
    }
  }))
  ();
```

**Error:** `[compose] No previous method "methodName" found to compose with`
```typescript
// ❌ Trying to compose a method that doesn't exist in previous layers
const api = makeLayered({ data: [] })
  ({ save: (s, item) => ({ data: [...s.data, item] }) })
  (compose({
    delete: (s, id, prevDelete) => prevDelete(s, id) // ❌ No prevDelete method!
  }))
  ();

// ✅ Only compose methods that exist in previous layers
const api = makeLayered({ data: [] })
  ({ 
    save: (s, item) => ({ data: [...s.data, item] }),
    delete: (s, id) => ({ data: s.data.filter(item => item.id !== id) })
  })
  (compose({
    delete: (s, id, prevDelete) => {
      console.log(`Deleting item ${id}`);
      return prevDelete(s, id); // ✅ prevDelete exists
    }
  }))
  ();
```

### Debugging Tips

#### 1. Check Error Context
All errors include context about where they occurred:
```typescript
// Error message format: [context] specific error details
// Examples:
// [makeWith] Subject cannot be null or undefined
// [makeLayered] Layer 2 creation failed
// [enrich] Factory composition failed
```

#### 2. Validate Method Signatures
Ensure your methods follow the expected patterns:
```typescript
// Regular methods: (subject, ...args) => result
get: (state) => state.value,
add: (state, amount) => state.value + amount,

// Chainable methods: (subject, ...args) => newSubject
increment: (state) => ({ ...state, count: state.count + 1 }),

// Layer functions: (currentApi) => methods
(api) => ({ 
  double: (state) => api.increment().increment() 
})
```

#### 3. Use TypeScript for Better Error Prevention
TypeScript will catch many issues at compile time:
```typescript
// TypeScript will warn about return type mismatches
const counter = makeWith({ count: 0 })({
  ...makeChainable({
    // TS Error: Type 'void' is not assignable to type '{ count: number }'
    badIncrement: (s) => { s.count++; }
  })
});
```

## ❓ FAQ

**Q: Is this a global state management library?**
**A:** No. `Make With` is designed for creating self-contained, encapsulated objects. It's perfect for local component state or module-level state, but it has no built-in concept of a global, application-wide store.

**Q: What about performance? Isn't creating new objects on every call slow?**
**A:** For the vast majority of use cases (UI state, SDKs), the performance impact is negligible. JavaScript engines are highly optimized for short-lived object creation. For performance-critical hot paths, you can use the mutable pattern shown in the advanced examples.

**Q: Why the empty `()` call at the end of `makeLayered`?**
**A:** This is the "terminator call." Because `makeLayered` allows a variable number of enhancement layers, it needs a clear signal that you are finished adding layers and want the final object to be constructed. The empty `()` provides an explicit and unambiguous way to finalize the process.

<br />

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Please feel free to submit a Pull Request or open an issue.

<br />

## 📄 License

This project is licensed under the MIT License.

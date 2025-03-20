# 🧰 Make with 

This TypeScript library provides three utilities—`_with`, `make`, and `makeWith`—to streamline function composition, state management, and object creation with a functional programming approach. These tools are lightweight alternatives to traditional JavaScript patterns like the builder pattern, `this` with `bind` or `apply`, classes, and modules, offering type safety, immutability, and simplicity.

## ✨ Key Features

- **🔒 Type Safe** - Full TypeScript support with generics ensuring function signatures are preserved
- **🛡️ Immutable** - Encourages explicit state management, reducing bugs from mutable state
- **🚫 No `this`** - Eliminates binding issues common in object-oriented JavaScript
- **🪶 Lightweight** - Minimal code footprint compared to classes or builders
- **🧩 Flexible** - Supports multiple input styles for different use cases

## Table of Contents

- [Installation](#installation)
- [Why Use This Library?](#why-use-this-library)
- [When Is It Useful?](#when-is-it-useful)
- [How It's an Alternative](#how-its-an-alternative)
  - [vs. Builder Pattern](#vs-builder-pattern)
  - [vs. `this` with `bind` or `apply`](#vs-this-with-bind-or-apply)
  - [vs. Classes](#vs-classes)
  - [vs. Modules](#vs-modules)
- [Examples](#examples)
  - [Math Operations (vs. Modules)](#math-operations-vs-modules)
  - [String Utilities (vs. Builder Pattern)](#string-utilities-vs-builder-pattern)
  - [Counter (vs. Classes)](#counter-vs-classes)
  - [API Client (vs. `this` with `bind`/`apply`)](#api-client-vs-this-with-bindapply)
- [Benefits](#benefits)
- [Conclusion](#conclusion)

---

## Installation 📦

```sh
npm install @doeixd/make-with
```

<br />

## Why Use This Library? 🤔

This library replaces complex, imperative patterns with functional, type-safe utilities. It eliminates boilerplate, reduces bugs from mutable state or `this` context, and provides a modular way to compose functions around shared data.
<br />

## When Is It Useful? 🎯

- **📊 Shared State**: When multiple functions need to operate on the same value without repeating it.
- **📐 Type-Safe Composition**: In TypeScript projects needing precise function signatures.
- **🔍 Lightweight Utilities**: When classes or modules feel over-engineered.
- **🧊 Immutability**: For predictable, side-effect-free code.

<br />

## How It's an Alternative 🔄

### vs. Builder Pattern 🏗️
- **Builder Pattern**: Uses a step-by-step object construction with mutable state, often chained (e.g., `.setX().setY().build()`).
- **Library Alternative**: `make` and `makeWith` create function objects in one step, avoiding mutation and chaining complexity.
- **Why Better**: Immediate, immutable results with less boilerplate.

### vs. `this` with `bind` or `apply` 🔗
- **`this` with `bind`/`apply`**: Manually binds a context to functions, often verbose and error-prone due to `this` quirks.
- **Library Alternative**: `makeWith` and `_with` bind a `subject` implicitly, avoiding `this` entirely.
- **Why Better**: No context loss, cleaner syntax, and type safety.

### vs. Classes 🏛️
- **Classes**: Encapsulate state and methods with `this`, risking mutation and binding issues.
- **Library Alternative**: `makeWith` creates method-like objects with fixed state, `_with` provides stateless operations.
- **Why Better**: Immutable, no `this`, simpler composition.

### vs. Modules 📦
- **Modules**: Export static functions or objects, often requiring manual state injection or configuration.
- **Library Alternative**: `make` bundles functions dynamically, `makeWith` adds state binding.
- **Why Better**: Less setup, runtime flexibility, no file overhead.

<br />

## Examples 💡

### Math Operations (vs. Modules) 🧮

**Problem**: You want reusable math utilities, traditionally exported from a module.

**Module Approach**:
```typescript
// math.ts
export function add(a: number, b: number): number { return a + b; }
export function multiply(a: number, b: number): number { return a * b; }

// usage
import { add, multiply } from './math';
console.log(add(2, 3)); // 5
```

**Library Solution**:
```typescript
function add(a: number, b: number): number { return a + b; }
function multiply(a: number, b: number): number { return a * b; }
const mathOps = make(add, multiply);
console.log(mathOps.add(2, 3)); // 5
```

**Comparison**: No need for a separate module file or import statements. `make` dynamically creates an object, reducing overhead and keeping code local.


### String Utilities (vs. Builder Pattern) 📝

**Problem**: Build a string utility set, traditionally with a builder pattern.

**Builder Pattern**:
```typescript
class StringBuilder {
  private ops: Record<string, (s: string, ...args: any[]) => string> = {};
  addOp(name: string, fn: (s: string, ...args: any[]) => string) {
    this.ops[name] = fn;
    return this;
  }
  build() { return this.ops; }
}

const builder = new StringBuilder()
  .addOp('toUpper', s => s.toUpperCase())
  .addOp('repeat', (s, n: number) => s.repeat(n));
const stringOps = builder.build();
console.log(stringOps.toUpper('hello')); // "HELLO"
```

**Library Solution**:
```typescript
const stringOps = make({
  toUpper: (s: string) => s.toUpperCase(),
  repeat: (s: string, n: number) => s.repeat(n)
});
console.log(stringOps.toUpper('hello')); // "HELLO"
```

**Comparison**: `make` achieves the same result in one step, no chaining or class needed. It's immutable and simpler, avoiding the builder's verbosity.


### Counter (vs. Classes) 🔢

**Problem**: Create a counter with stateful operations, typically a class.

**Class Approach**:
```typescript
class Counter {
  constructor(private count: number) {}
  increment(n: number) { this.count += n; return this.count; }
  getCount() { return this.count; }
}

const counter = new Counter(0);
console.log(counter.increment(5)); // 5
console.log(counter.getCount());   // 5
```

**Library Solution**:
```typescript
interface CounterState { count: number; }
function increment(s: CounterState, n: number): CounterState { return { ...s, count: s.count + n }; }
function getCount(s: CounterState): number { return s.count; }

let state: CounterState = { count: 0 };
let counter = makeWith(state)(increment, getCount);
state = counter.increment(5); // Update state
counter = makeWith(state)(increment, getCount); // Rebuild with new state
console.log(counter.getCount()); // 5
```

**Comparison**: `makeWith` avoids `this` and mutation, using explicit state updates. It's more verbose for state changes but safer and more predictable, with no hidden side effects.


### API Client (vs. `this` with `bind`/`apply`) 🌐

**Problem**: Build an API client with shared config, traditionally using `bind`.

**`bind` Approach**:
```typescript
interface ApiConfig { baseUrl: string; }
const config: ApiConfig = { baseUrl: 'https://api.example.com' };

function get(this: ApiConfig, endpoint: string) { return fetch(`${this.baseUrl}/${endpoint}`).then(res => res.json()); }
const boundGet = get.bind(config);
boundGet('users').then(console.log);
```

**Library Solution**:
```typescript
interface ApiConfig { baseUrl: string; }
const config: ApiConfig = { baseUrl: 'https://api.example.com' };
const api = makeWith(config)({
  get: (cfg: ApiConfig, endpoint: string) => fetch(`${cfg.baseUrl}/${endpoint}`).then(res => res.json()),
  post: (cfg: ApiConfig, endpoint: string, data: any) => fetch(`${cfg.baseUrl}/${endpoint}`, { method: 'POST', body: JSON.stringify(data) }).then(res => res.json())
});
api.get('users').then(console.log);
```

**Comparison**: `makeWith` avoids `this` and `bind`, creating a clean object with methods in one step. It's less prone to context errors (e.g., losing `this` when passing methods) and supports multiple operations naturally.


## API Docs 📚

This section details the public API of the Functional Utilities Library, including function signatures, parameters, return types, exceptions, and examples. All functions are written in TypeScript with generics for type safety.

### `_with` 🔗

Partially applies a value to a set of functions, returning an array of new functions with the value pre-applied.

#### Signature
```typescript
function _with<S>(subject: S): <F extends ((subject: S, ...args: any[]) => any)[]>(...fns: F) => { [K in keyof F]: F[K] extends (subject: S, ...args: infer A) => infer R ? (...args: A) => R : never }
```

#### Type Parameters
- **`S`**: The type of the `subject` to be partially applied.

#### Parameters
- **`subject: S`**: The value to be pre-applied as the first argument to each function.

#### Returns
- A function that:
  - **Accepts**: `...fns: F[]` - An array of functions where each function expects `subject: S` as its first argument, followed by any additional arguments, and returns any type.
  - **Returns**: An array of new functions where each original function has `subject` pre-applied, preserving the remaining argument types (`A`) and return type (`R`).

#### Throws
- **`Error`**: If any element in `fns` is not a function (`"All elements must be functions"`).

#### Example
```typescript
interface State { value: number; }
const state: State = { value: 5 };
const modState = _with(state);
const [getValue, increment] = modState(
  (s: State) => s.value,
  (s: State, n: number) => s.value + n
);
console.log(getValue());    // 5
console.log(increment(3));  // 8
```


### `make` 🛠️

Creates an object where each key is a function's name and each value is the function itself, accepting either an array of named functions or an object with function values. The updated implementation uses overloads to improve type preservation.

#### Signature
```typescript
// Overload for array of functions
function make<F extends (...args: any[]) => any>(...fns: F[]): Record<string, F>;
// Overload for object with specific function signatures
function make<Obj extends Record<string, (...args: any[]) => any>>(obj: Obj): Obj;
```

#### Type Parameters
- **`F`**: The type of functions when an array is provided, constrained to functions with any arguments and return type.
- **`Obj`**: The type of the object when an object is provided, constrained to a record with string keys and function values.

#### Parameters
- **`...fns: F[]`**: An array of named functions (for the first overload).
- **`obj: Obj`**: An object with string keys and function values (for the second overload).

#### Returns
- For array input: **`Record<string, F>`** - An object where each key is a function's name (derived from the function's `.name` property) and each value is the corresponding function.
- For object input: **`Obj`** - The same object passed in, preserving its exact type and function signatures.

#### Throws
- **`Error`**:
  - `"Value for key \"<key>\" must be a function"` (object input, when a value is not a function).
  - `"All elements must be functions"` (array input, when an element is not a function).
  - `"All functions must have names"` (array input, when a function lacks a name).
  - `"Duplicate function name \"<name>\""` (array input, when function names collide).

#### Examples
```typescript
// Array of functions
function add(a: number, b: number): number { return a + b; }
const mathOps = make(add);
console.log(mathOps.add(2, 3)); // 5

// Object with functions
const stringOps = make({
  toUpper: (s: string) => s.toUpperCase(),
  repeat: (s: string, n: number) => s.repeat(n)
});
console.log(stringOps.toUpper('hello')); // "HELLO"
console.log(stringOps.repeat('hi', 2));  // "hihi"
```


### `makeWith` 🔄

Creates a function that builds an object of partially applied functions based on a subject, accepting either an array of named functions or an object with named functions. The updated implementation uses overloads for better type safety and inference.

#### Signature
```typescript
// Overload for object input with precise types
function makeWith<S>(subject: S): <Obj extends Record<string, (subject: S, ...args: any[]) => any>>(obj: Obj) => PartiallyApplied<Obj, S>;
// Overload for array input with general types
function makeWith<S>(subject: S): (...fns: ((subject: S, ...args: any[]) => any)[]) => Record<string, (...args: any[]) => any>;
```

#### Type Parameters
- **`S`**: The type of the `subject` to be partially applied.
- **`Obj`**: The type of the object when an object is provided, constrained to a record with string keys and functions that accept `subject: S` as their first argument.

#### Parameters
- **`subject: S`**: The value to be pre-applied as the first argument to each function.

#### Returns
- A function that:
  - **For object input**:
    - **Accepts**: `obj: Obj` - An object where each value is a function expecting `subject: S` as its first argument.
    - **Returns**: `PartiallyApplied<Obj, S>` - An object where each function has `subject` pre-applied, preserving the remaining argument types and return types from the original function signatures.
  - **For array input**:
    - **Accepts**: `...fns: ((subject: S, ...args: any[]) => any)[]` - An array of named functions expecting `subject: S` as their first argument.
    - **Returns**: `Record<string, (...args: any[]) => any>` - An object where each key is a function name (from `.name`), and each value is a function with `subject` pre-applied, accepting any remaining arguments.

#### Throws
- **`Error`**:
  - `"Value for key \"<key>\" must be a function"` (object input, when a value is not a function).
  - `"All elements must be functions"` (array input, when an element is not a function).
  - `"All functions must have names"` (array input, when a function lacks a name).
  - `"Duplicate function name \"<name>\""` (array input, when function names collide).

#### Examples
```typescript
// Object input with precise types
interface Config { base: string; }
const config: Config = { base: 'http://example.com' };
const api = makeWith(config)({
  get: (cfg: Config, path: string) => fetch(`${cfg.base}/${path}`).then(res => res.json())
});
api.get('data').then(console.log); // Type-safe: get(path: string) => Promise<any>

// Array input with general types
function add(s: { value: number }, n: number): number { return s.value + n; }
const ops = makeWith({ value: 5 })(add);
console.log(ops.add(3)); // 8, typed as (...args: any[]) => any
```

## Conclusion 🎯

The `_with`, `make`, and `makeWith` utilities offer a functional, type-safe alternative to traditional JavaScript patterns. They replace the builder pattern's chaining with single-step composition, eliminate `this` and binding hassles, simplify class-based state management with explicitness, and reduce module boilerplate with dynamic function grouping. Use this library when you want modular, predictable, and maintainable code without the overhead of conventional approaches. Start simple and scale as your project demands! 🚀

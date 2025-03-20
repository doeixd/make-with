# 🧰 Make With

[![npm version](https://img.shields.io/npm/v/@doeixd/make-with.svg)](https://www.npmjs.com/package/@doeixd/make-with)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Functional utilities for elegant function composition and state management in TypeScript

**Make With** provides three powerful utilities — `_with`, `make`, and `makeWith` — that bring functional programming elegance to TypeScript. Create immutable, type-safe function compositions without the complexity of traditional JavaScript patterns.

## 📦 Installation

```sh
npm install @doeixd/make-with
```

```sh
yarn add @doeixd/make-with
```

## 🚀 Quick Start

```typescript
// Group functions with 'make'
function add(a: number, b: number): number { return a + b; }
function multiply(a: number, b: number): number { return a * b; }
const math = make(add, multiply);

math.add(2, 3);       // 5
math.multiply(2, 3);  // 6

// Apply context with 'makeWith'
const apiClient = makeWith({ baseUrl: 'https://api.example.com' })({
  get: (cfg, endpoint) => fetch(`${cfg.baseUrl}/${endpoint}`),
  post: (cfg, endpoint, data) => fetch(`${cfg.baseUrl}/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
});

apiClient.get('users');  // Fetches from https://api.example.com/users
```

## ✨ Key Features

- **🔒 Type Safe** - Full TypeScript support with precise type inference
- **🛡️ Immutable** - Explicit state updates eliminate side-effect bugs
- **🚫 No `this`** - Avoid context issues common in object-oriented JavaScript
- **🪶 Lightweight** - Minimal footprint with zero dependencies
- **🧩 Flexible** - Works with named functions, objects, or inline definitions

## 🔍 Why Use Make With?

This library solves common JavaScript challenges with a functional approach:

| Pattern | ❌ Traditional Problems | ✅ Make With Benefits |
|---------|------------------------|----------------------|
| **Builder Pattern** | Mutable state, verbose chaining | Immediate, immutable results |
| **`this` binding** | Context loss, `bind`/`apply` complexity | Implicit subject binding, no context issues |
| **Classes** | `this` quirks, side effects | Explicit state, predictable updates |
| **Modules** | File overhead, static exports | Dynamic composition, local code |

## 🛠️ Core API

### `_with`

Partially applies a value to functions, returning reusable specialized functions.

```typescript
const state = { value: 5 };
const [getValue, increment] = _with(state)(
  (s) => s.value,
  (s, n: number) => s.value + n
);

getValue();    // 5
increment(3);  // 8
```

### `make`

Creates an object from functions or a functions object, preserving names and types.

```typescript
// From named functions
function add(a: number, b: number): number { return a + b; }
function subtract(a: number, b: number): number { return a - b; }
const math = make(add, subtract);

// From object definition
const text = make({
  upper: (s: string) => s.toUpperCase(),
  lower: (s: string) => s.toLowerCase()
});
```

### `makeWith`

Creates methods that implicitly operate on a shared subject.

```typescript
interface Config { baseUrl: string; }
const config: Config = { baseUrl: 'https://api.example.com' };

const api = makeWith(config)({
  get: (cfg, path: string) => fetch(`${cfg.baseUrl}/${path}`),
  post: (cfg, path: string, data: any) => fetch(`${cfg.baseUrl}/${path}`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
});

api.get('users');  // No need to pass config every time
```

## 🎯 Use Cases

### 1. API Clients

Create clean API clients with shared configuration:

```typescript
const github = makeWith({ token: 'abc123', baseUrl: 'https://api.github.com' })({
  getUser: (cfg, username) => 
    fetch(`${cfg.baseUrl}/users/${username}`, {
      headers: { 'Authorization': `Bearer ${cfg.token}` }
    }).then(res => res.json()),
  
  listRepos: (cfg, username) => 
    fetch(`${cfg.baseUrl}/users/${username}/repos`, {
      headers: { 'Authorization': `Bearer ${cfg.token}` }
    }).then(res => res.json())
});

// Use without repetition
const user = await github.getUser('octocat');
const repos = await github.listRepos('octocat');
```

### 2. Immutable State Management

Create predictable state updates:

```typescript
interface CounterState { count: number; }

const counter = {
  increment: (state: CounterState, n: number): CounterState => 
    ({ ...state, count: state.count + n }),
  
  decrement: (state: CounterState, n: number): CounterState => 
    ({ ...state, count: state.count - n })
};

// Initial state
let state: CounterState = { count: 0 };
let ops = makeWith(state)(counter);

// Update state
state = ops.increment(5);  // { count: 5 }
ops = makeWith(state)(counter);  // Rebuild with new state

console.log(state.count);  // 5
```

### 3. Utilities Collection

Group related functions:

```typescript
const stringUtils = make({
  capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
  reverse: (s: string) => s.split('').reverse().join(''),
  truncate: (s: string, n: number) => s.length > n ? s.slice(0, n) + '...' : s
});

stringUtils.capitalize('hello');  // "Hello"
stringUtils.truncate('hello world', 5);  // "hello..."
```

## 🔄 Migration Examples

### From Builder Pattern

```typescript
// ❌ Before
class StringBuilder {
  private value = '';
  
  append(str: string) {
    this.value += str;
    return this;
  }
  
  prepend(str: string) {
    this.value = str + this.value;
    return this;
  }
  
  build() {
    return this.value;
  }
}

const result = new StringBuilder()
  .append('world')
  .prepend('hello ')
  .build();

// ✅ After
const string = {
  append: (s: string, add: string) => s + add,
  prepend: (s: string, add: string) => add + s
};

let value = '';
const ops = makeWith(value)(string);
value = ops.prepend('hello ');
value = ops.append('world');
```

### From Classes

```typescript
// ❌ Before
class Counter {
  constructor(private count = 0) {}
  
  increment(n = 1) {
    this.count += n;
    return this;
  }
  
  getCount() {
    return this.count;
  }
}

const counter = new Counter();
counter.increment(5);
console.log(counter.getCount());  // 5

// ✅ After
interface CounterState { count: number; }

function increment(state: CounterState, n = 1): CounterState {
  return { ...state, count: state.count + n };
}

function getCount(state: CounterState): number {
  return state.count;
}

let state: CounterState = { count: 0 };
let counter = makeWith(state)(increment, getCount);
state = counter.increment(5);
counter = makeWith(state)(increment, getCount);
console.log(counter.getCount());  // 5
```

## 📚 Full API Documentation

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


## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

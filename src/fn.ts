// =============================================================================
// FUNCTIONAL COMBINATORS & UTILITIES
// =============================================================================

export type WithArgMapped<
  E,
  F extends Array<(arg: E, ...args: any[]) => any>,
> = {
  [K in keyof F]: F[K] extends (arg: E, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;
};

export type WithArgFn = {
  <E>(
    arg: E,
  ): <F extends Array<(arg: E, ...args: any[]) => any>>(
    ...fns: F
  ) => WithArgMapped<E, F>;
  <E, F extends Array<(arg: E, ...args: any[]) => any>>(
    arg: E,
    ...fns: F
  ): WithArgMapped<E, F>;
};

export type DataLastFn<D, A extends any[], R> = {
  (...args: [...A, D]): R;
  (...args: A): (data: D) => R;
};

export type DataLastMapped<
  D,
  F extends Array<(data: D, ...args: any[]) => any>,
> = {
  [K in keyof F]: F[K] extends (data: D, ...args: infer A) => infer R
    ? DataLastFn<D, A, R>
    : never;
};

export type DataLastPredFn = {
  <D>(
    isData: (value: unknown) => value is D,
  ): <F extends Array<(data: D, ...args: any[]) => any>>(
    ...fns: F
  ) => DataLastMapped<D, F>;
  <D, F extends Array<(data: D, ...args: any[]) => any>>(
    isData: (value: unknown) => value is D,
    ...fns: F
  ): DataLastMapped<D, F>;
};

export type FlexFn<D, A extends any[], R> = {
  (data: D, ...args: A): R;
  (...args: [...A, D]): R;
  (data: D): (...args: A) => R;
  (...args: A): (data: D) => R;
};

export type FlexMapped<D, F extends Array<(data: D, ...args: any[]) => any>> = {
  [K in keyof F]: F[K] extends (data: D, ...args: infer A) => infer R
    ? FlexFn<D, A, R>
    : never;
};

export type FlexPredFn = {
  <D>(
    isData: (value: unknown) => value is D,
  ): <F extends Array<(data: D, ...args: any[]) => any>>(
    ...fns: F
  ) => FlexMapped<D, F>;
  <D, F extends Array<(data: D, ...args: any[]) => any>>(
    isData: (value: unknown) => value is D,
    ...fns: F
  ): FlexMapped<D, F>;
};

export type ResolverInput<T> = T | (() => T | null) | null | undefined;

export type ResolverFunction<T, A extends any[], R> = {
  (input: ResolverInput<T>, ...args: A): R;
  (input: ResolverInput<T>): (...args: A) => R;
};

export type Path = string | Array<string | number>;

/**
 * Represents a function that can be called either Data-First or Data-Last.
 */
interface DualModeFn<D, A extends any[], R> {
  (data: D, ...args: A): R;
  (...argsThenData: [...A, D]): R;
}

// =============================================================================
// STANDALONE EXPORTS (tree-shakeable)
// =============================================================================

/**
 * Hybrid Function Builder.
 * Creates a function that supports both Curried and Imperative usage.
 *
 * @template T - The Target type
 * @template A - The Arguments tuple type
 * @template R - The Return type
 *
 * @example
 * ```typescript
 * const getField = def((obj: Record<string, any>, key: string) => obj[key]);
 *
 * // Imperative
 * getField({name: 'Alice'}, 'name'); // 'Alice'
 *
 * // Curried
 * const getName = getField({name: 'Alice'});
 * getName('name'); // 'Alice'
 * ```
 */
export const def = <T, A extends any[], R>(
  fn: (target: T | null, ...args: A) => R,
) => {
  function wrapper(target: T | null, ...args: A): R;
  function wrapper(target: T | null): (...args: A) => R;
  function wrapper(target: T | null, ...args: any[]) {
    if (args.length > 0) {
      // @ts-ignore - spread is safe here due to generics
      return fn(target, ...args);
    }
    return (...lateArgs: A) => fn(target, ...lateArgs);
  }

  return wrapper;
};

/**
 * Creates a function that accepts data as either the first OR the last argument.
 *
 * @param fn - The original function (must be written as Data-First: (data, ...args) => result)
 * @param isData - A Type Guard to identify the Data argument at runtime.
 */
export function makeDataFirstOrLast<D, A extends any[], R>(
  fn: (data: D, ...args: A) => R,
  isData: (input: any) => input is D,
): DualModeFn<D, A, R> {
  return ((...args: any[]): R => {
    if (args.length > 0 && isData(args[0])) {
      const data = args[0] as D;
      const rest = args.slice(1) as A;
      return fn(data, ...rest);
    }

    const lastIndex = args.length - 1;
    if (lastIndex >= 0 && isData(args[lastIndex])) {
      const data = args[lastIndex] as D;
      const rest = args.slice(0, lastIndex) as A;
      return fn(data, ...(rest as unknown as A));
    }

    throw new Error(
      "Could not determine call signature: Data argument not found at start or end.",
    );
  }) as DualModeFn<D, A, R>;
}

/**
 * (B-Combinator) Chains functions in left-to-right order.
 * `pipe(f, g, h)(x)` is equivalent to `h(g(f(x)))`.
 *
 * @param fns - The sequence of functions to apply.
 * @returns A new function that applies the sequence to its input.
 *
 * @example
 * ```typescript
 * const process = pipe(
 *   (x: number) => x * 2,
 *   (x: number) => x + 1,
 *   (x: number) => `Result: ${x}`
 * );
 * process(5); // "Result: 11"
 * ```
 */
export const pipe =
  <T>(...fns: Array<(arg: any) => any>) =>
  (x: T): any =>
    fns.reduce((v, f) => f(v), x);

/**
 * Converts a function that takes two arguments `fn(a, b)` into a curried
 * function that takes them one at a time `fn(a)(b)`.
 *
 * @param fn - The binary function to curry.
 *
 * @example
 * ```typescript
 * const add = (a: number, b: number) => a + b;
 * const curriedAdd = curry(add);
 * const add5 = curriedAdd(5);
 * add5(3); // 8
 * ```
 */
export const curry =
  <A, B, R>(fn: (a: A, b: B) => R) =>
  (a: A) =>
  (b: B): R =>
    fn(a, b);

/**
 * Prefills the first argument for multiple functions.
 *
 * Supports both call styles:
 * - `withArg(arg, fn1, fn2)`
 * - `withArg(arg)(fn1, fn2)`
 *
 * Returns a tuple of functions with `arg` applied as the first parameter.
 *
 * @example
 * ```typescript
 * const add = (state: {count: number}, n: number) => state.count + n;
 * const mul = (state: {count: number}, n: number) => state.count * n;
 *
 * const [addTo, mulBy] = withArg({count: 5}, add, mul);
 * addTo(3); // 8
 * mulBy(2); // 10
 * ```
 */
export const withArg: WithArgFn = (() => {
  const apply = <E, F extends Array<(arg: E, ...args: any[]) => any>>(
    arg: E,
    fns: F,
  ) =>
    fns.map(
      (fn) =>
        (...args: any[]) =>
          fn(arg, ...args),
    ) as any;

  const wrapper = (arg: any, ...fns: any[]) => {
    if (fns.length > 0) {
      return apply(arg, fns);
    }
    return (...rest: any[]) => apply(arg, rest);
  };

  return wrapper as WithArgFn;
})();

/**
 * Converts a data-first function into a data-last, dual-mode function.
 *
 * Turns `(data, ...args) => result` into:
 * - Immediate: `(...args, data) => result`
 * - Curried: `(...args) => (data) => result`
 *
 * Detection defaults to arity (`fn.length`) and can be customized with:
 * - `arity`: expected argument count (including data)
 * - `isData`: predicate for the last argument
 *
 * @example
 * ```typescript
 * const getField = (obj: Record<string, any>, key: string) => obj[key];
 * const getFieldLast = dataLast(getField, { arity: 2 });
 *
 * getFieldLast('name', {name: 'Alice'}); // Immediate
 * getFieldLast('name')({name: 'Alice'}); // Curried
 * ```
 */
export const dataLast = <D, A extends any[], R>(
  fn: (data: D, ...args: A) => R,
  config?:
    | number
    | ((value: unknown) => value is D)
    | { arity?: number; isData?: (value: unknown) => value is D },
): DataLastFn<D, A, R> => {
  const arity =
    typeof config === "number"
      ? config
      : typeof config === "function"
        ? fn.length
        : (config?.arity ?? fn.length);
  const isData =
    typeof config === "function"
      ? config
      : typeof config === "number"
        ? undefined
        : config?.isData;

  return ((...args: any[]) => {
    if (isData) {
      if (args.length > 0 && isData(args[args.length - 1])) {
        const data = args[args.length - 1] as D;
        const rest = args.slice(0, -1) as A;
        return fn(data, ...rest);
      }
      return (data: D) => fn(data, ...(args as A));
    }

    if (args.length >= arity) {
      const data = args[args.length - 1] as D;
      const rest = args.slice(0, -1) as A;
      return fn(data, ...rest);
    }

    return (data: D) => fn(data, ...(args as A));
  }) as DataLastFn<D, A, R>;
};

/**
 * Builds data-last versions of multiple functions using a shared predicate.
 *
 * Supports both call styles:
 * - `dataLastPred(isData, fn1, fn2)`
 * - `dataLastPred(isData)(fn1, fn2)`
 *
 * @example
 * ```typescript
 * const isArray = (v: unknown): v is number[] => Array.isArray(v);
 *
 * const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
 * const avg = (arr: number[]) => sum(arr) / arr.length;
 *
 * const [sumLast, avgLast] = dataLastPred(isArray)(sum, avg);
 * ```
 */
export const dataLastPred: DataLastPredFn = (() => {
  const wrapper = (isData: any, ...fns: any[]) => {
    if (fns.length > 0) {
      return fns.map((fn) => dataLast(fn, { isData })) as any;
    }
    return (...rest: any[]) =>
      rest.map((fn) => dataLast(fn, { isData })) as any;
  };

  return wrapper as DataLastPredFn;
})();

/**
 * Makes a function flexible about the position of its first argument.
 *
 * Supports all of the following call styles:
 * - `fnFlex(firstArg, ...rest)`
 * - `fnFlex(firstArg)(...rest)`
 * - `fnFlex(...rest, firstArg)`
 * - `fnFlex(...rest)(firstArg)`
 *
 * For ambiguous signatures, pass a predicate to identify the first argument
 * so immediate vs curried behavior is deterministic.
 *
 * @example
 * ```typescript
 * const isConfig = (v: unknown): v is Record<string, any> =>
 *   typeof v === 'object' && v !== null && !Array.isArray(v);
 *
 * const applyConfig = (config: Record<string, any>, key: string) => config[key];
 * const flexApply = flex(applyConfig, isConfig);
 *
 * flexApply({a: 1}, 'a');     // data-first
 * flexApply({a: 1})('a');     // data-first curried
 * flexApply('a', {a: 1});     // data-last
 * flexApply('a')({a: 1});     // data-last curried
 * ```
 */
export const flex = <D, A extends any[], R>(
  fn: (data: D, ...args: A) => R,
  isFirstArg?: (value: unknown) => value is D,
): FlexFn<D, A, R> => {
  const arity = fn.length;

  return ((...args: any[]) => {
    if (args.length === 0) {
      return (data: D) => fn(data, ...([] as unknown as A));
    }

    if (isFirstArg) {
      const first = args[0];
      if (isFirstArg(first)) {
        if (args.length === 1) {
          return (...rest: A) => fn(first, ...rest);
        }
        return fn(first, ...(args.slice(1) as A));
      }

      const last = args[args.length - 1];
      if (isFirstArg(last)) {
        if (args.length === 1) {
          return (...rest: A) => fn(last, ...rest);
        }
        return fn(last, ...(args.slice(0, -1) as A));
      }
    }

    if (args.length >= arity) {
      return fn(args[0], ...(args.slice(1) as A));
    }

    return (data: D) => fn(data, ...(args as A));
  }) as FlexFn<D, A, R>;
};

/**
 * Builds flex versions of multiple functions using a shared predicate.
 *
 * Supports both call styles:
 * - `flexPred(isData, fn1, fn2)`
 * - `flexPred(isData)(fn1, fn2)`
 *
 * @example
 * ```typescript
 * const isState = (v: unknown): v is {count: number} =>
 *   typeof v === 'object' && v !== null && 'count' in v;
 *
 * const inc = (s: {count: number}, n: number) => s.count + n;
 * const dec = (s: {count: number}, n: number) => s.count - n;
 *
 * const [incFlex, decFlex] = flexPred(isState)(inc, dec);
 * ```
 */
export const flexPred: FlexPredFn = (() => {
  const wrapper = (isData: any, ...fns: any[]) => {
    if (fns.length > 0) {
      return fns.map((fn) => flex(fn, isData)) as any;
    }
    return (...rest: any[]) =>
      rest.map((fn) => flex(fn, isData)) as any;
  };

  return wrapper as FlexPredFn;
})();

/**
 * (C-Combinator) Swaps the arguments of a curried function.
 * Transforms `fn(config)(target)` into `fn(target)(config)`.
 *
 * @example
 * ```typescript
 * const greet = (greeting: string) => (name: string) => `${greeting}, ${name}!`;
 * const greetPerson = swap(greet)('Alice');
 * greetPerson('Hello'); // "Hello, Alice!"
 * ```
 */
export const swap =
  <A, B, R>(fn: (a: A) => (b: B) => R): ((b: B) => (a: A) => R) =>
  (b) =>
  (a) =>
    fn(a)(b);

/**
 * Flips the arguments of a non-curried binary function.
 * Transforms `fn(a, b)` into `fn(b, a)`.
 */
export const flip =
  <A, B, R>(fn: (a: A, b: B) => R): ((b: B, a: A) => R) =>
  (b, a) =>
    fn(a, b);

/**
 * (K-Combinator) Executes a side-effect function with a value, then returns the value.
 * Essential for debugging or executing void-returning functions inside a
 * `pipe` chain without breaking it.
 *
 * @example
 * ```typescript
 * const process = pipe(
 *   (x: number) => x * 2,
 *   tap(x => console.log('After doubling:', x)),
 *   (x: number) => x + 1
 * );
 * process(5); // logs "After doubling: 10", returns 11
 * ```
 */
export const tap =
  <T>(fn: (x: T) => void) =>
  (x: T): T => {
    fn(x);
    return x;
  };

/**
 * Creates a function that executes only if its input is not `null` or `undefined`.
 *
 * @example
 * ```typescript
 * const double = maybe((x: number) => x * 2);
 * double(5);    // 10
 * double(null);  // null
 * ```
 */
export const maybe =
  <T, R>(fn: (x: T) => R) =>
  (x: T | null | undefined): R | null => {
    return x === null || x === undefined ? null : fn(x);
  };

/**
 * (W-Combinator / Converge) Applies multiple functions to the same input,
 * then passes their results to a final combining function.
 * `converge(h, f, g)(x)` is equivalent to `h(f(x), g(x))`.
 *
 * @example
 * ```typescript
 * const stats = converge(
 *   (sum: number, count: number) => ({ sum, count, avg: sum / count }),
 *   (arr: number[]) => arr.reduce((a, b) => a + b, 0),
 *   (arr: number[]) => arr.length
 * );
 * stats([1, 2, 3]); // { sum: 6, count: 3, avg: 2 }
 * ```
 */
export const converge =
  <T, O>(h: (...args: any[]) => O, ...fns: Array<(x: T) => any>) =>
  (x: T): O => {
    return h(...fns.map((f) => f(x)));
  };

/**
 * Creates a function that executes one of two functions based on a predicate.
 *
 * @example
 * ```typescript
 * const classify = ifElse(
 *   (n: number) => n > 0,
 *   (n) => `${n} is positive`,
 *   (n) => `${n} is non-positive`
 * );
 * classify(5);  // "5 is positive"
 * classify(-3); // "-3 is non-positive"
 * ```
 */
export const ifElse =
  <T, R1, R2>(
    predicate: (x: T) => boolean,
    ifTrue: (x: T) => R1,
    ifFalse: (x: T) => R2,
  ) =>
  (x: T): R1 | R2 =>
    predicate(x) ? ifTrue(x) : ifFalse(x);

/**
 * "Thunks" a function, creating a nullary (zero-argument) function that
 * calls the original with pre-filled arguments.
 *
 * @example
 * ```typescript
 * const logHello = thunk(console.log, 'Hello', 'World');
 * logHello(); // logs "Hello World"
 * ```
 */
export const thunk =
  <A extends any[], R>(fn: (...args: A) => R, ...args: A): (() => R) =>
  () =>
    fn(...args);

/**
 * (I-Combinator) Returns the value it was given.
 * Useful as a default or placeholder in functional compositions.
 */
export const identity = <T>(x: T): T => x;

/**
 * A function that does nothing and returns nothing.
 * Useful for providing a default no-op callback.
 */
export const noop = () => {};

/**
 * Converts a target-first function into a curried, chainable function.
 * The returned function applies the operation and returns the target,
 * enabling method chaining.
 *
 * Takes a function `(target, ...args) => any` and converts it to
 * `(...args) => (target) => target`.
 *
 * @example
 * ```typescript
 * const setField = (obj: Record<string, any>, key: string, val: any) => {
 *   obj[key] = val;
 * };
 *
 * const withField = chainable(setField);
 *
 * const obj = {};
 * chain(obj,
 *   withField('name', 'Alice'),
 *   withField('age', 30)
 * );
 * // obj is now { name: 'Alice', age: 30 }
 * ```
 */
export const chainable =
  <T, A extends any[]>(fn: (target: T, ...args: A) => any) =>
  (...args: A) =>
  (target: T): T => {
    fn(target, ...args);
    return target;
  };

/**
 * Like `chainable`, but preserves the function's return value instead of
 * returning the target.
 *
 * @example
 * ```typescript
 * const getField = (obj: Record<string, any>, key: string) => obj[key];
 * const field = chainableWith(getField);
 *
 * const name = field('name')({ name: 'Alice' }); // 'Alice'
 * ```
 */
export const chainableWith =
  <T, A extends any[], R>(fn: (target: T, ...args: A) => R) =>
  (...args: A) =>
  (target: T): R => {
    return fn(target, ...args);
  };

/**
 * Wraps a function so its first argument can be provided directly or via
 * a resolver function. Null/undefined inputs are passed through.
 *
 * Supports dual-mode:
 * - Immediate: `wrapped(input, ...args)` — resolves and applies
 * - Curried: `wrapped(input)(...args)` — resolves, returns partial
 *
 * @example
 * ```typescript
 * const greet = (user: {name: string} | null, greeting: string) =>
 *   user ? `${greeting}, ${user.name}!` : 'No user';
 *
 * const greetResolvable = withResolver(greet);
 *
 * greetResolvable({name: 'Alice'}, 'Hello');     // "Hello, Alice!"
 * greetResolvable(() => getUser(), 'Hello');      // Resolves lazily
 * greetResolvable(null, 'Hello');                 // "No user"
 * greetResolvable({name: 'Bob'})('Hi');           // Curried: "Hi, Bob!"
 * ```
 */
export const withResolver = <T, A extends any[], R>(
  fn: (target: T | null, ...args: A) => R,
): ResolverFunction<T, A, R> => {
  function wrapper(
    input: ResolverInput<T>,
    ...args: any[]
  ): any {
    let resolved: T | null = null;

    if (input === null || input === undefined) {
      resolved = null;
    } else if (typeof input === "function") {
      resolved = (input as () => T | null)() as T | null;
    } else {
      resolved = input as T;
    }

    if (args.length > 0) {
      return fn(resolved, ...(args as A));
    } else {
      return (...lateArgs: A) => fn(resolved, ...lateArgs);
    }
  }

  return wrapper as ResolverFunction<T, A, R>;
};

/**
 * Applies multiple pre-configured transformers to a target value.
 *
 * Each function should be a pre-configured transformer that expects the target.
 * Returns the target for further chaining.
 *
 * @example
 * ```typescript
 * const obj: Record<string, any> = {};
 *
 * chain(obj,
 *   o => { o.name = 'Alice'; return o; },
 *   o => { o.active = true; return o; }
 * );
 * ```
 */
export function chain<T>(
  target: T | null,
  ...transforms: Array<(t: T) => any>
): T | null {
  if (!target) return null;
  transforms.forEach((transform) => transform(target));
  return target;
}

/**
 * Executes multiple callback functions on a target value.
 *
 * Similar to `chain`, but accepts direct callback functions instead of
 * pre-configured transformers. Each callback receives the target as its
 * first argument. Returns the target for further chaining.
 *
 * @example
 * ```typescript
 * const state = { count: 0, label: '' };
 *
 * exec(state,
 *   s => { s.count = 42; },
 *   s => { s.label = `Count: ${s.count}`; },
 *   s => console.log(s)
 * );
 * ```
 */
export function exec<T>(
  target: T | null,
  ...operations: Array<(t: T) => any>
): T | null {
  if (!target) return null;
  operations.forEach((operation) => operation(target));
  return target;
}

// =============================================================================
// Fn NAMESPACE (convenience re-export, not tree-shakeable)
// =============================================================================

/**
 * Convenience namespace bundling all functional combinators.
 * For tree-shaking, prefer the individual named exports instead.
 */
export const Fn = {
  def,
  makeDataFirstOrLast,
  pipe,
  chain,
  exec,
  curry,
  withArg,
  dataLast,
  dataLastPred,
  flex,
  flexPred,
  swap,
  flip,
  tap,
  maybe,
  converge,
  ifElse,
  thunk,
  identity,
  noop,
  chainable,
  chainableWith,
  withResolver,
};

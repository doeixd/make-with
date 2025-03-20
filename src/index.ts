/**
 * Partially applies a value to a set of functions, returning new functions with the value pre-applied.
 *
 * @template S - The type of the subject to be partially applied.
 * @template F - The type of functions, constrained to accept the subject and return a value.
 * @param {S} subject - The value to partially apply to each function.
 * @returns {(...fns: F[]) => { [K in keyof F]: F[K] extends (subject: S, ...args: infer A) => infer R ? (...args: A) => R : never } }
 *          A function that takes an array of functions expecting `subject` as their first argument and returns
 *          an array of new functions with `subject` pre-applied, preserving argument and return types.
 * @throws {Error} If any element in `fns` is not a function.
 *
 * @example
 * const subject = { value: 5 };
 * const modSubject = _with(subject);
 * const [getValue, increment] = modSubject(
 *   (s: { value: number }) => s.value,
 *   (s: { value: number }, n: number) => s.value + n
 * );
 * console.log(getValue());    // 5
 * console.log(increment(3));  // 8
 */
export function _with<S>(subject: S) {
  return function <F extends ((subject: S, ...args: any[]) => any)[]>(...fns: F): { [K in keyof F]: F[K] extends (subject: S, ...args: infer A) => infer R ? (...args: A) => R : never } {
    // Validate that all elements are functions
    if (!fns.every(fn => typeof fn === 'function')) {
      throw new Error('All elements must be functions');
    }

    // Map each function to a new function with `subject` pre-applied
    return fns.map(fn => (...args: any[]) => fn(subject, ...args)) as any;
  };
}

/**
 * Creates an object where each key is a function's name and each value is the function itself.
 * Accepts either an array of named functions or an object with function values.
 *
 * @template F - The type of functions, constrained to functions with any arguments and return type.
 * @param {...(F[] | [Record<string, F>])} fns - Either an array of named functions or a single object mapping strings to functions.
 * @returns {Record<string, F>} - An object with function names as keys and the original functions as values.
 * @throws {Error} If inputs are invalid (non-functions, unnamed functions, or duplicate names).
 *
 * @example
 * // Using an array of functions
 * function add(a: number, b: number): number { return a + b; }
 * function multiply(a: number, b: number): number { return a * b; }
 * const mathOps = make(add, multiply);
 * console.log(mathOps.add(2, 3)); // 5
 *
 * // Using an object with functions
 * const stringOps = make({
 *   toUpper: (s: string) => s.toUpperCase(),
 *   repeat: (s: string, n: number) => s.repeat(n)
 * });
 * console.log(stringOps.toUpper('hello')); // "HELLO"
 */
export function make<F extends (...args: any[]) => any>(
  ...fns: F[]
): Record<string, F>;
export function make<Obj extends Record<string, (...args: any[]) => any>>(
  obj: Obj
): Obj;
export function make(
  ...fnsOrObj: any[]
): any {
  if (fnsOrObj.length === 1 && typeof fnsOrObj[0] === 'object' && !Array.isArray(fnsOrObj[0])) {
    // Object case
    const functionsMap = fnsOrObj[0];
    for (const [key, value] of Object.entries(functionsMap)) {
      if (typeof value !== 'function') {
        throw new Error(`Value for key "${key}" must be a function`);
      }
    }
    return functionsMap;
  } else {
    // Array case
    const flattenedFns = fnsOrObj.flat();
    const functionsMap: Record<string, (...args: any[]) => any> = {};
    for (const fn of flattenedFns) {
      if (typeof fn !== 'function') {
        throw new Error('All elements must be functions');
      }
      if (!fn.name) {
        throw new Error('All functions must have names');
      }
      if (functionsMap[fn.name]) {
        throw new Error(`Duplicate function name "${fn.name}"`);
      }
      functionsMap[fn.name] = fn;
    }
    return functionsMap;
  }
}

export type PartiallyApplied<Obj, S> = {
  [K in keyof Obj]: Obj[K] extends (subject: S, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;
};

/**
 * Creates a function that builds an object of partially applied functions based on a subject.
 *
 * @template S - The type of the subject to be partially applied.
 * @param {S} subject - The value to partially apply to each function.
 * @returns A function that accepts either an array of named functions or an object with named functions,
 *          and returns an object where each function is partially applied with the subject.
 * @throws {Error} If any input is not a function, functions lack names (for array input), or duplicate names are provided.
 *
 * @example
 * // Using an object
 * const subject = { value: 5 };
 * const methods = makeWith(subject)({
 *   increment: (s: { value: number }, n: number) => s.value + n,
 *   double: (s: { value: number }) => s.value * 2
 * });
 * console.log(methods.increment(3)); // 8
 * console.log(methods.double());     // 10
 *
 * // Using named functions
 * function add(s: { value: number }, n: number) { return s.value + n; }
 * const ops = makeWith(subject)(add);
 * console.log(ops.add(2)); // 7
 */
export function makeWith<S>(subject: S) {
  // Overload for object input with precise types
  function inner<Obj extends Record<string, (subject: S, ...args: any[]) => any>>(
    obj: Obj
  ): PartiallyApplied<Obj, S>;
  // Overload for array input with general types
  function inner(
    ...fns: ((subject: S, ...args: any[]) => any)[]
  ): Record<string, (...args: any[]) => any>;
  // Implementation
  function inner(...fnsOrObj: any): any {
    let functionsMap: Record<string, (subject: S, ...args: any[]) => any>;

    // Case 1: Single object with named functions
    if (
      fnsOrObj.length === 1 &&
      typeof fnsOrObj[0] === "object" &&
      !Array.isArray(fnsOrObj[0])
    ) {
      functionsMap = fnsOrObj[0];
      for (const [key, value] of Object.entries(functionsMap)) {
        if (typeof value !== "function") {
          throw new Error(`Value for key "${key}" must be a function`);
        }
      }
    }
    // Case 2: Array of named functions
    else {
      const flattenedFns = fnsOrObj.flat();
      functionsMap = {};
      for (const fn of flattenedFns) {
        if (typeof fn !== "function") {
          throw new Error("All elements must be functions");
        }
        if (!fn.name) {
          throw new Error("All functions must have names");
        }
        if (functionsMap[fn.name]) {
          throw new Error(`Duplicate function name "${fn.name}"`);
        }
        functionsMap[fn.name] = fn;
      }
    }

    // Build the result object with partially applied functions
    return Object.entries(functionsMap).reduce((acc, [key, fn]) => {
      acc[key] = (...args: any[]) => fn(subject, ...args);
      return acc;
    }, {} as Record<string, (...args: any[]) => any>);
  }
  return inner;
}

export default {
  with: _with,
  make: make,
  makeWith: makeWith
}
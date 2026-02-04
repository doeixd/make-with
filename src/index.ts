/**
 * @file A functional utility library for creating powerful, immutable, and chainable APIs.
 * It provides tools for partial application and function composition, enabling elegant state
 * management patterns.
 *
 * @version 0.0.5
 * @license MIT
 */

// A special symbol to identify objects of functions wrapped by `makeChainable`.
const IS_CHAINABLE = Symbol("isChainable");


// Weak caches for performance optimization
const API_CACHE = new WeakMap<object, WeakMap<object, any>>();
const VALIDATION_CACHE = new WeakSet<object>();

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Type Definitions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/** A utility type representing a collection of methods for a given subject. */
type Methods<S extends object = object> = Record<string, MethodFunction<S>>;

/** A function that operates on a subject and returns some result. */
type MethodFunction<S extends object> = (subject: S, ...args: readonly unknown[]) => unknown;

/**
 * Helper type to detect if a method return type should be treated as chainable.
 * Chainable methods return exactly the subject type or an extension of it.
 */
type IsChainableReturn<R, S> = R extends S
  ? S extends R
  ? true  // Exact match - definitely chainable
  : R extends S & infer _Ext
  ? true  // Extended state - chainable
  : false // Subtype but not extension - not chainable
  : false;  // No relation - not chainable

/**
 * The return type of a `provideTo` (`makeWith`) call. It correctly infers the
 * return types for both regular methods and those marked as chainable.
 */
type ChainableApi<Fns extends Methods<S>, S extends object> = {
  [K in keyof Fns as K extends typeof IS_CHAINABLE ? never : K]: Fns[K] extends (
    s: S,
    ...args: infer A
  ) => infer R
  ? IsChainableReturn<R, S> extends true
  ? (...args: A) => ChainableApi<Fns, S>
  : (...args: A) => R
  : never;
};

/** A utility type that infers a simple, non-chainable API shape. Used by `makeLayered`. */
type BoundApi<S extends object, F extends Methods<S>> = {
  [K in keyof F]: F[K] extends (subject: S, ...args: infer A) => infer R
  ? (...args: A) => R
  : never;
};

/** A function layer that receives the current API and returns methods to bind to it. */
type LayerFunction<CurrentApi extends object> = (currentApi: CurrentApi) => Methods<CurrentApi>;



/** 
 * Symbol to mark objects as composable, similar to IS_CHAINABLE.
 */
const IS_COMPOSABLE = Symbol("isComposable");

/**
 * Symbol to store the underlying state in API instances for composition.
 */
const INTERNAL_STATE = Symbol("internalState");



/** Enhanced LayeredApiBuilder type that supports both object and function layers. */
type LayeredApiBuilder<CurrentApi extends object> = {
  (): CurrentApi;
  <EnhancerFns extends Methods<CurrentApi>>(
    enhancerFns: EnhancerFns,
  ): LayeredApiBuilder<CurrentApi & BoundApi<CurrentApi, EnhancerFns>>;
  <LayerFn extends LayerFunction<CurrentApi>>(
    layerFn: LayerFn,
  ): LayeredApiBuilder<CurrentApi & BoundApi<CurrentApi, ReturnType<LayerFn>>>;
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Utility Functions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/**
 * Validates that all values in an object are functions.
 * Uses caching to avoid repeated validation of the same objects.
 */
function validateMethods(methods: Record<string, unknown>, context: string): void {
  if (VALIDATION_CACHE.has(methods)) {
    return; // Already validated
  }

  for (const [key, value] of Object.entries(methods)) {
    if (key === IS_CHAINABLE.toString()) continue;

    if (typeof value !== 'function') {
      throw new TypeError(
        `Invalid method "${key}" in ${context}: expected function, got ${typeof value}`
      );
    }
  }

  VALIDATION_CACHE.add(methods);
}

/**
 * Type guard to check if a value is a LayerFunction.
 * LayerFunctions take exactly one parameter (the current API) and return methods.
 */
function isLayerFunction<T extends object>(
  value: unknown
): value is LayerFunction<T> {
  if (typeof value !== 'function') return false;

  // Check parameter count - LayerFunctions take exactly 1 parameter
  // Handle rest parameters (length = 0) by also checking for single-param signatures
  return value.length === 1 || (value.length === 0 && value.toString().includes('...'));
}

export class LayeredError extends Error { }

/**
 * Creates a consistent error message format.
 */
function createError(context: string, message: string, cause?: unknown): Error {
  const error = new LayeredError(`[${context}] ${message}`, { cause });
  return error;
}


/**
 * Creates a cached API instance to avoid recreating identical APIs.
 */
function getCachedApi<T>(subject: object, functionsMap: object, factory: () => T): T {
  // Atomic cache operations to prevent race conditions
  let subjectCache = API_CACHE.get(subject);
  if (!subjectCache) {
    const newCache = new WeakMap();
    // Check again in case another thread created it
    subjectCache = API_CACHE.get(subject) || newCache;
    if (subjectCache === newCache) {
      API_CACHE.set(subject, subjectCache);
    }
  }

  let cachedApi = subjectCache.get(functionsMap);
  if (!cachedApi) {
    const newApi = factory();
    // Check again in case another thread created it
    cachedApi = subjectCache.get(functionsMap) || newApi;
    if (cachedApi === newApi) {
      subjectCache.set(functionsMap, cachedApi);
    }
  }

  return cachedApi;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Core Function Implementations
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/**
 * Partially applies a value to a set of functions, returning new functions with the value pre-applied.
 * This is the simplest tool in the library, useful for reducing repetition when a group of
 * functions all need the same initial argument.
 *
 * @template S The type of the subject to be partially applied.
 * @param subject The value to partially apply to each function (e.g., a config object).
 * @returns A higher-order function that takes multiple functions and returns a new array of
 *          functions, each with the `subject` pre-applied.
 *
 * @example
 * const config = { user: 'admin', retries: 3 };
 * const [fetchData, deleteData] = _with(config)(
 *   (cfg, path) => `Fetching ${path} for ${cfg.user}...`,
 *   (cfg, id) => `Deleting ${id} with ${cfg.retries} retries...`
 * );
 * fetchData('/items'); // "Fetching /items for admin..."
 */
export function _with<S>(subject: S) {
  if (subject === null || subject === undefined) {
    throw createError('_with', 'Subject cannot be null or undefined');
  }

  return function <Fs extends ((subject: S, ...args: any[]) => any)[]>(
    ...fns: Fs
  ): {
      [K in keyof Fs]: Fs[K] extends (subject: S, ...args: infer A) => infer R
      ? (...args: A) => R
      : never;
    } {
    if (fns.length === 0) {
      throw createError('_with', 'At least one function must be provided');
    }

    for (let i = 0; i < fns.length; i++) {
      if (typeof fns[i] !== 'function') {
        throw createError('_with', `Argument at index ${i} must be a function, got ${typeof fns[i]}`);
      }
    }

    return fns.map(
      (fn, index) =>
        (...args: any[]) => {
          try {
            return fn(subject, ...args);
          } catch (error) {
            throw createError('_with', `Function at index ${index} threw an error`, error);
          }
        },
    ) as any;
  };
}

/**
 * Normalizes a collection of functions into a consistent key-value object.
 * It's a key utility for building APIs, as it accepts functions in two convenient formats:
 * an array of named functions, or a single object of functions.
 *
 * @param fnsOrObj Either an array of named functions or a single object.
 * @returns An object where keys are function names and values are the functions themselves.
 * @throws {Error} If inputs are invalid (non-functions, unnamed anonymous functions, or duplicate names).
 *
 * @example
 * // From named functions (name is used as key)
 * function greet(name) { return `Hello, ${name}`; }
 * const greeters = make(greet); // { greet: [Function: greet] }
 *
 * // From an object (keys are preserved)
 * const math = make({ add: (a, b) => a + b }); // { add: [Function: add] }
 */
export function make<F extends (...args: any[]) => any>(
  ...fns: F[]
): Record<string, F>;
export function make<Obj extends Methods>(obj: Obj): Obj;
export function make(...fnsOrObj: any[]): any {
  if (fnsOrObj.length === 0) {
    throw createError('make', 'At least one argument must be provided');
  }

  if (
    fnsOrObj.length === 1 &&
    typeof fnsOrObj[0] === "object" &&
    !Array.isArray(fnsOrObj[0]) &&
    fnsOrObj[0] !== null
  ) {
    const functionsMap = fnsOrObj[0];

    try {
      validateMethods(functionsMap, 'make');
      return functionsMap;
    } catch (error) {
      throw createError('make', 'Object validation failed', error);
    }
  }

  const functionsMap: Record<string, (...args: any[]) => any> = {};
  const seenNames = new Set<string>();

  for (let i = 0; i < fnsOrObj.length; i++) {
    const fn = fnsOrObj[i];

    if (typeof fn !== "function") {
      throw createError('make', `Argument at index ${i} must be a function, got ${typeof fn}`);
    }

    if (!fn.name || fn.name.trim() === '') {
      throw createError('make', `Function at index ${i} must have a non-empty name`);
    }

    if (seenNames.has(fn.name)) {
      throw createError('make', `Duplicate function name "${fn.name}" found`);
    }

    seenNames.add(fn.name);
    functionsMap[fn.name] = fn;
  }

  return functionsMap;
}

/**
 * Marks a set of functions as "chainable" for use with `provideTo` (`makeWith`).
 * A chainable function is a state updater that, when called, returns a new API instance
 * bound to the new state, enabling fluent method calls.
 *
 * @param fnsOrObj An object of state-updating functions, or an array of named state-updating functions.
 * @returns The same object of functions, but tagged with a special symbol for `provideTo` to recognize.
 * 
 * @example
 * // From an object
 * const chainableMath = rebind({
 *   add: (state, n) => ({ ...state, value: state.value + n }),
 *   multiply: (state, n) => ({ ...state, value: state.value * n })
 * });
 * 
 * // From named functions
 * function increment(state) { return { ...state, count: state.count + 1 }; }
 * function decrement(state) { return { ...state, count: state.count - 1 }; }
 * const chainableCounters = rebind(increment, decrement);
 */
export function rebind<Obj extends Methods>(obj: Obj): Obj;
export function rebind<Fs extends Array<(...args: any[]) => any>>(
  ...fns: Fs
): Record<string, Fs[number]>;
export function rebind(...fnsOrObj: any[]): Record<string, any> {
  try {
    const originalFunctions = make(...fnsOrObj);
    (originalFunctions as any)[IS_CHAINABLE] = true;

    return originalFunctions;
  } catch (error) {
    throw createError('rebind', 'Failed to create chainable functions', error);
  }
}

/**
 * Creates a fluent API from a subject (state/config) and a collection of functions.
 * It partially applies the subject to each function. If the methods object was wrapped
 * with `makeChainable`, calling its methods will return a new, fully-formed API
 * bound to the resulting state. This is the core function for state management patterns.
 *
 * @template S The type of the subject (state).
 * @param subject The initial state to bind to the functions.
 * @returns A higher-order function that takes a map of methods and returns the final API.
 * 
 * @example
 * const initialState = { count: 0, name: 'Counter' };
 * 
 * // Non-chainable methods (getters, utilities)
 * const getters = { 
 *   get: (state) => state.count,
 *   getName: (state) => state.name 
 * };
 * 
 * // Chainable methods (state updaters)
 * const updaters = makeChainable({
 *   increment: (state) => ({ ...state, count: state.count + 1 }),
 *   setName: (state, name) => ({ ...state, name })
 * });
 * 
 * const counterAPI = makeWith(initialState)(updaters);
 * const newAPI = counterAPI.increment().setName('Updated Counter');
 * 
 * const readOnlyAPI = makeWith(initialState)(getters);
 * const currentCount = readOnlyAPI.get(); // 0
 */
export function makeWith<S extends object>(subject: S) {
  if (subject === null || subject === undefined) {
    throw createError('makeWith', 'Subject cannot be null or undefined');
  }

  if (typeof subject !== 'object') {
    throw createError('makeWith', `Subject must be an object, got ${typeof subject}`);
  }

  return function <Fns extends Methods<S>>(
    functionsMap: Fns,
  ): ChainableApi<Fns, S> {
    if (!functionsMap || typeof functionsMap !== 'object') {
      throw createError('makeWith', 'Functions map must be a non-null object');
    }

    // Use caching for identical subject + functionsMap combinations
    return getCachedApi(subject, functionsMap, () => {
      try {
        validateMethods(functionsMap, 'makeWith');

        const finalApi: Record<string, unknown> = {};
        const isChainable = (functionsMap as Record<string | symbol, unknown>)[IS_CHAINABLE];
        const methodNames = Object.keys(functionsMap).filter(k => k !== IS_CHAINABLE.toString());

        for (const key of methodNames) {
          const fn = functionsMap[key];

          if (isChainable) {
            finalApi[key] = (...args: any[]) => {
              try {
                const newSubject = fn(subject, ...args);

                if (newSubject === undefined) {
                  throw createError('makeWith',
                    `Chainable method "${key}" returned undefined. Chainable methods must return a new state object.`
                  );
                }

                if (newSubject === null || (typeof newSubject !== 'object')) {
                  throw createError('makeWith',
                    `Chainable method "${key}" returned ${newSubject === null ? 'null' : typeof newSubject}. Chainable methods must return a new state object.`
                  );
                }

                return makeWith(newSubject)(functionsMap as unknown as Methods<typeof newSubject>);
              } catch (error) {
                throw createError('makeWith', `Chainable method "${key}" failed`, error);
              }
            };
          } else {
            finalApi[key] = (...args: any[]) => {
              try {
                return fn(subject, ...args);
              } catch (error) {
                throw createError('makeWith', `Method "${key}" failed`, error);
              }
            };
          }
        }

        // Store the state in the API instance for composition access
        (finalApi as Record<string | symbol, unknown>)[INTERNAL_STATE] = subject;

        return finalApi as ChainableApi<Fns, S>;
      } catch (error) {
        throw createError('makeWith', 'API creation failed', error);
      }
    });
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Composition Primitives
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/**
 * Creates a composable object where methods can access previous methods with the same name.
 * Automatically handles both regular and chainable methods - the previous method always
 * returns the appropriate result (state for chainable, actual result for regular).
 *
 * @template T The type of the composable methods object.
 * @param methods An object where each method receives the previous method as its last parameter.
 * @returns A marked object that can be used in `makeLayered` for composition.
 *
 * @example
 * // Composing regular methods
 * const api = makeLayered({ count: 0 })
 *   ({ 
 *     get: (s) => s.count,
 *     increment: (s) => ({ count: s.count + 1 })
 *   })
 *   (compose({
 *     get: (s, prevGet) => {
 *       const value = prevGet(s); // Returns number
 *       console.log('Current count:', value);
 *       return value;
 *     }
 *   }))
 *   ();
 *
 * @example
 * // Composing chainable methods (automatically handled)
 * const api = makeLayered({ count: 0 })
 *   (makeChainable({
 *     increment: (s) => ({ count: s.count + 1 }),
 *     add: (s, amount) => ({ count: s.count + amount })
 *   }))
 *   (compose({
 *     increment: (s, prevIncrement) => {
 *       console.log('Before increment:', s.count);
 *       const newState = prevIncrement(s); // Always returns state object
 *       console.log('After increment:', newState.count);
 *       return newState; // Returns state, becomes chainable automatically
 *     },
 *     add: (s, amount, prevAdd) => {
 *       if (amount < 0) {
 *         console.warn('Adding negative amount:', amount);
 *         amount = Math.abs(amount);
 *       }
 *       return prevAdd(s, amount); // Returns state object
 *     }
 *   }))
 *   ();
 *
 * @example
 * // Mixed composition - some methods chainable, some not
 * const userAPI = makeLayered({ users: [], count: 0 })
 *   (makeChainable({
 *     addUser: (s, user) => ({ ...s, users: [...s.users, user] })
 *   }))
 *   ({ 
 *     getUserCount: (s) => s.users.length,
 *     validateUser: (s, user) => user.name && user.email
 *   })
 *   (compose({
 *     addUser: (s, user, prevAdd) => {
 *       if (!s.validateUser(user)) throw new Error('Invalid user');
 *       return prevAdd(s, { ...user, id: crypto.randomUUID() }); // Returns state
 *     },
 *     getUserCount: (s, prevGetCount) => {
 *       const count = prevGetCount(s); // Returns number
 *       console.log(`Total users: ${count}`);
 *       return count;
 *     }
 *   }))
 *   ();
 */
export function compose<T extends Record<string, MethodFunction<any>>>(
  methods: T
): T & { [IS_COMPOSABLE]: true } {
  if (!methods || typeof methods !== 'object') {
    throw createError('compose', 'Methods must be a non-null object');
  }

  // Validate that all properties are functions
  for (const [key, value] of Object.entries(methods)) {
    if (typeof value !== 'function') {
      throw createError('compose', `Method "${key}" must be a function, got ${typeof value}`);
    }
  }

  // Mark the object as composable
  return Object.assign(methods, { [IS_COMPOSABLE]: true as const });
}



/**
 * Merges multiple method objects with later objects taking precedence, or creates a curried
 * merger function for partial application. This enhanced version supports both immediate merging
 * and functional composition patterns.
 *
 * @template T The type of method objects to merge.
 * @param objects Method objects to merge, in order of precedence (later objects override earlier).
 * @returns A single merged object, or a curried function for further merging.
 *
 * @example
 * // Direct merging (original behavior)
 * const baseMethods = { get: (s) => s.value, set: (s, v) => ({ value: v }) };
 * const extensions = { increment: (s) => ({ value: s.value + 1 }) };
 * const validation = { set: (s, v) => v >= 0 ? ({ value: v }) : s }; // Override set
 *
 * const allMethods = merge(baseMethods, extensions, validation);
 * const api = makeWith({ value: 0 })(allMethods);
 *
 * @example
 * // Curried usage for extension patterns
 * const addDefaults = merge({ role: 'user', active: true });
 * const withAuth = merge({ isAuthenticated: (s) => !!s.token });
 * 
 * const userMethods = addDefaults(withAuth({ login: (s, token) => ({ ...s, token }) }));
 * 
 * @example
 * // Building reusable extensions
 * const withTimestamp = merge({
 *   addTimestamp: (s) => ({ ...s, createdAt: Date.now() }),
 *   updateTimestamp: (s) => ({ ...s, updatedAt: Date.now() })
 * });
 * 
 * const withValidation = merge({
 *   validate: (s, rules) => rules.every(rule => rule(s))
 * });
 * 
 * // Compose multiple extensions
 * const enhancedAPI = makeWith(initialState)(
 *   withValidation(withTimestamp(baseMethods))
 * );
 * 
 * @example
 * // Conditional merging with currying
 * const createUserAPI = (isAdmin: boolean) => {
 *   const base = { getProfile: (s) => s.profile };
 *   const adminMethods = isAdmin ? { deleteUser: (s, id) => ({ ...s, deleted: [...s.deleted, id] }) } : {};
 *   return makeWith(initialState)(merge(base)(adminMethods));
 * };
 * 
 * @example
 * // Chaining extensions functionally
 * const processUser = (baseUser) => 
 *   merge({ id: crypto.randomUUID() })(
 *     merge({ createdAt: Date.now() })(
 *       merge({ role: 'user' })(baseUser)
 *     )
 *   );
 */
export function merge<T extends Methods>(...objects: T[]): T;
export function merge<T extends Methods>(
  firstObject: T
): <U extends Methods>(...additionalObjects: U[]) => T & U;
export function merge<T extends Methods>(...objects: T[]): T | (<U extends Methods>(...additionalObjects: U[]) => T & U) {
  if (objects.length === 0) {
    throw createError('merge', 'At least one object must be provided');
  }

  // Validate the first object
  const firstObj = objects[0];
  if (!firstObj || typeof firstObj !== 'object') {
    throw createError('merge', 'First argument must be a non-null object');
  }

  try {
    validateMethods(firstObj, 'merge first argument');
  } catch (error) {
    throw createError('merge', 'First object validation failed', error);
  }

  // If only one object provided, return a curried function
  if (objects.length === 1) {
    return function <U extends Methods>(...additionalObjects: U[]): T & U {
      if (additionalObjects.length === 0) {
        throw createError('merge', 'At least one additional object must be provided to merge');
      }

      // Validate additional objects
      for (let i = 0; i < additionalObjects.length; i++) {
        const obj = additionalObjects[i];
        if (!obj || typeof obj !== 'object') {
          throw createError('merge', `Additional argument at index ${i} must be a non-null object`);
        }

        try {
          validateMethods(obj, `merge additional argument ${i}`);
        } catch (error) {
          throw createError('merge', `Additional object at index ${i} validation failed`, error);
        }
      }

      // Merge first object with additional objects
      return Object.assign({}, firstObj, ...additionalObjects) as T & U;
    };
  }

  // Multiple objects provided - merge immediately (original behavior)
  for (let i = 1; i < objects.length; i++) {
    const obj = objects[i];
    if (!obj || typeof obj !== 'object') {
      throw createError('merge', `Argument at index ${i} must be a non-null object`);
    }

    try {
      validateMethods(obj, `merge argument ${i}`);
    } catch (error) {
      throw createError('merge', `Object at index ${i} validation failed`, error);
    }
  }

  return Object.assign({}, ...objects);
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Advanced Merge Primitives
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/** Type representing a property descriptor that can be used as a merge key */
type MergePropertyDescriptor = {
  key: string | symbol;
  enumerable?: boolean;
  configurable?: boolean;
  writable?: boolean;
};

/** Type for merge result - either success with merged object or failure with error details */
type MergeResult<T> = 
  | { success: true; data: T }
  | { success: false; failures: Array<[string | symbol, unknown]> };

/** Type for merge definition functions */
type MergeDefinition<T> = {
  [K in keyof T]?: (objA: Pick<T, K>, objB: Pick<T, K>, key: K) => T[K] | { error: unknown };
};

/** Type for tuple-based merge definitions */
type TupleMergeDefinition<T extends Record<string | symbol, any>> = Array<[
  keyof T | MergePropertyDescriptor,
  (objA: any, objB: any, key: keyof T) => T[keyof T] | { error: unknown }
]>;

/** Helper to get property descriptors for objects */
export function getKeyDescriptions<T extends object, U extends object>(
  objA: T, 
  objB: U
): Array<[string | symbol, PropertyDescriptor, PropertyDescriptor]> {
  const allKeys = new Set([
    ...Object.getOwnPropertyNames(objA),
    ...Object.getOwnPropertySymbols(objA),
    ...Object.getOwnPropertyNames(objB),
    ...Object.getOwnPropertySymbols(objB)
  ]);

  return Array.from(allKeys).map(key => {
    const descA = Object.getOwnPropertyDescriptor(objA, key) || {
      enumerable: false,
      configurable: false,
      writable: false,
      key
    };
    const descB = Object.getOwnPropertyDescriptor(objB, key) || {
      enumerable: false,
      configurable: false,
      writable: false,
      key
    };

    return [key, descA, descB] as [string | symbol, PropertyDescriptor, PropertyDescriptor];
  });
}

/**
 * Creates a type-safe, auto-curried merger function that can merge objects according to custom merge strategies.
 * Supports both object-based and tuple-based merge definitions with comprehensive error handling.
 *
 * @template T The type of objects to be merged.
 * @param mergeDefinition An object where each key maps to a function that defines how to merge that property.
 * @returns An auto-curried function that merges objects or returns detailed failure information.
 *
 * @example
 * // Basic usage with merge definition object
 * interface User {
 *   name: string;
 *   age: number;
 *   tags: string[];
 * }
 * 
 * const userMerger = createMerger<User>({
 *   name: (a, b, key) => a.name || b.name,
 *   age: (a, b, key) => Math.max(a.age || 0, b.age || 0),
 *   tags: (a, b, key) => [...(a.tags || []), ...(b.tags || [])]
 * });
 * 
 * const user1 = { name: "Alice", age: 25, tags: ["admin"] };
 * const user2 = { name: "", age: 30, tags: ["user"] };
 * 
 * const result = userMerger(user1, user2);
 * if (result.success) {
 *   console.log(result.data); // { name: "Alice", age: 30, tags: ["admin", "user"] }
 * }
 * 
 * @example
 * // Auto-currying support
 * const partialMerger = userMerger(user1);
 * const result2 = partialMerger(user2); // Same result as above
 * 
 * @example
 * // Error handling
 * const strictMerger = createMerger<User>({
 *   name: (a, b, key) => a.name === b.name ? a.name : { error: "Name mismatch" },
 *   age: (a, b, key) => a.age > 0 && b.age > 0 ? Math.max(a.age, b.age) : { error: "Invalid age" }
 * });
 * 
 * const badResult = strictMerger({ name: "Alice", age: -1, tags: [] }, { name: "Bob", age: 30, tags: [] });
 * if (!badResult.success) {
 *   console.log(badResult.failures); // [["name", "Name mismatch"], ["age", "Invalid age"]]
 * }
 */
export function createMerger<T extends Record<string | symbol, any>>(
  mergeDefinition: MergeDefinition<T>
): {
  (objA: Partial<T>): (objB: Partial<T>) => MergeResult<T>;
  (objA: Partial<T>, objB: Partial<T>): MergeResult<T>;
};

/**
 * Creates a merger using tuple-based definitions for advanced property descriptor handling.
 *
 * @template T The type of objects to be merged.
 * @param tupleDefinitions Array of tuples where each tuple contains a key/descriptor and merge function.
 * @returns An auto-curried function that merges objects according to the tuple definitions.
 *
 * @example
 * // Using property descriptors
 * const descriptorMerger = createMerger<{ value: number; meta: string }>([
 *   ["value", (a, b, key) => (a.value || 0) + (b.value || 0)],
 *   [{ key: "meta", enumerable: true }, (a, b, key) => `${a.meta || ""}_${b.meta || ""}`]
 * ]);
 * 
 * const obj1 = { value: 10, meta: "first" };
 * const obj2 = { value: 20, meta: "second" };
 * const result = descriptorMerger(obj1, obj2);
 * // result.data = { value: 30, meta: "first_second" }
 */
export function createMerger<T extends Record<string | symbol, any>>(
  tupleDefinitions: TupleMergeDefinition<T>
): {
  (objA: Partial<T>): (objB: Partial<T>) => MergeResult<T>;
  (objA: Partial<T>, objB: Partial<T>): MergeResult<T>;
};

export function createMerger<T extends Record<string | symbol, any>>(
  definition: MergeDefinition<T> | TupleMergeDefinition<T>
): {
  (objA: Partial<T>): (objB: Partial<T>) => MergeResult<T>;
  (objA: Partial<T>, objB: Partial<T>): MergeResult<T>;
} {
  if (!definition) {
    throw createError('createMerger', 'Merge definition cannot be null or undefined');
  }

  // Normalize tuple definitions to object format
  let normalizedDefinition: MergeDefinition<T>;
  
  if (Array.isArray(definition)) {
    normalizedDefinition = {} as MergeDefinition<T>;
    
    for (const [keyOrDescriptor, mergeFn] of definition) {
      if (typeof keyOrDescriptor === 'object' && 'key' in keyOrDescriptor) {
        const key = keyOrDescriptor.key as keyof T;
        normalizedDefinition[key] = mergeFn as any;
      } else {
        const key = keyOrDescriptor as keyof T;
        normalizedDefinition[key] = mergeFn as any;
      }
    }
  } else {
    normalizedDefinition = definition;
  }

  // Validate the definition
  for (const [key, mergeFn] of Object.entries(normalizedDefinition)) {
    if (typeof mergeFn !== 'function') {
      throw createError('createMerger', `Merge function for key "${key}" must be a function, got ${typeof mergeFn}`);
    }
  }

  function performMerge(objA: Partial<T>, objB: Partial<T>): MergeResult<T> {
    if (!objA || typeof objA !== 'object') {
      throw createError('createMerger', 'First object must be a non-null object');
    }
    
    if (!objB || typeof objB !== 'object') {
      throw createError('createMerger', 'Second object must be a non-null object');
    }

    const result = {} as T;
    const failures: Array<[string | symbol, unknown]> = [];

    // Get all keys from both objects
    const allKeys = new Set([
      ...Object.getOwnPropertyNames(objA),
      ...Object.getOwnPropertySymbols(objA),
      ...Object.getOwnPropertyNames(objB), 
      ...Object.getOwnPropertySymbols(objB)
    ]);

    for (const key of allKeys) {
      const typedKey = key as keyof T;
      const mergeFn = normalizedDefinition[typedKey];

      if (mergeFn) {
        try {
          const objAWithKey = objA.hasOwnProperty(key) ? 
            ({ [key]: objA[typedKey] } as unknown as Pick<T, typeof typedKey>) : 
            ({} as Pick<T, typeof typedKey>);
          const objBWithKey = objB.hasOwnProperty(key) ? 
            ({ [key]: objB[typedKey] } as unknown as Pick<T, typeof typedKey>) : 
            ({} as Pick<T, typeof typedKey>);
          
          const mergeResult = mergeFn(objAWithKey, objBWithKey, typedKey);
          
          if (mergeResult && typeof mergeResult === 'object' && 'error' in mergeResult) {
            failures.push([key, mergeResult.error]);
          } else {
            result[typedKey] = mergeResult;
          }
        } catch (error) {
          failures.push([key, error]);
        }
      } else {
        // Default behavior: objB takes precedence
        if (objB.hasOwnProperty(key)) {
          result[typedKey] = objB[typedKey]!;
        } else if (objA.hasOwnProperty(key)) {
          result[typedKey] = objA[typedKey]!;
        }
      }
    }

    if (failures.length > 0) {
      return { success: false, failures };
    }

    return { success: true, data: result };
  }

  // Auto-curried implementation
  function merger(objA: Partial<T>): (objB: Partial<T>) => MergeResult<T>;
  function merger(objA: Partial<T>, objB: Partial<T>): MergeResult<T>;
  function merger(objA: Partial<T>, objB?: Partial<T>): any {
    if (objB === undefined) {
      // Return curried function
      return (secondObj: Partial<T>) => performMerge(objA, secondObj);
    }
    
    // Perform immediate merge
    return performMerge(objA, objB);
  }

  return merger;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Dynamic API Generation Primitives
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/** Type for proxy handler function result */
type ProxyHandlerResult<T> = T | { error: unknown } | undefined;

/** Type for proxy handler function */
type ProxyHandler<S extends Record<string | symbol, any>> = (
  state: S,
  methodName: string | symbol,
  ...args: unknown[]
) => ProxyHandlerResult<any>;

/** Type for proxy handler utility function */
type ProxyHandlerUtil<S extends Record<string | symbol, any>> = (
  state: S,
  methodName: string | symbol,
  ...args: unknown[]
) => ProxyHandlerResult<any>;

/** Lens getter function type */
type LensGetter<S, T> = (state: S) => T;

/** Lens setter function type */
type LensSetter<S, T> = (state: S, focused: T) => S;

/**
 * Utility function for common get/set pattern in createProxy.
 * Handles getXxx() and setXxx() method patterns automatically.
 *
 * @template S The type of the state object.
 * @param state The current state.
 * @param methodName The method being called.
 * @param args The arguments passed to the method.
 * @returns The result of the get/set operation or undefined if pattern doesn't match.
 *
 * @example
 * const userAPI = createProxy(getSet);
 * // Automatically provides: getName(), setName(value), getAge(), setAge(value), etc.
 */
export function getSet<S extends Record<string | symbol, any>>(
  state: S,
  methodName: string | symbol,
  ...args: unknown[]
): ProxyHandlerResult<any> {
  const method = String(methodName);
  
  if (method.startsWith('get') && method.length > 3) {
    const field = method.charAt(3).toLowerCase() + method.slice(4);
    return state[field as keyof S];
  }
  
  if (method.startsWith('set') && method.length > 3 && args.length > 0) {
    const field = method.charAt(3).toLowerCase() + method.slice(4);
    if (field in state) {
      return { ...state, [field]: args[0] } as S;
    }
  }
  
  return undefined;
}

/**
 * Utility function that wraps another proxy handler to ignore case in method names.
 *
 * @template S The type of the state object.
 * @param handler The proxy handler to wrap.
 * @returns A new handler that normalizes method names to lowercase.
 *
 * @example
 * const userAPI = createProxy(ignoreCase(getSet));
 * // Now getName(), getname(), GETNAME() all work the same way
 */
export function ignoreCase<S extends Record<string | symbol, any>>(
  handler: ProxyHandlerUtil<S>
): ProxyHandlerUtil<S> {
  return (state: S, methodName: string | symbol, ...args: unknown[]) => {
    const normalizedName = typeof methodName === 'string' ? methodName.toLowerCase() : methodName;
    return handler(state, normalizedName, ...args);
  };
}

/**
 * Utility function that wraps another proxy handler to strip special characters from method names.
 *
 * @template S The type of the state object.
 * @param handler The proxy handler to wrap.
 * @returns A new handler that removes special characters from method names.
 *
 * @example
 * const userAPI = createProxy(noSpecialChars(getSet));
 * // Now get_name(), get-name(), get$name() all become getname()
 */
export function noSpecialChars<S extends Record<string | symbol, any>>(
  handler: ProxyHandlerUtil<S>
): ProxyHandlerUtil<S> {
  return (state: S, methodName: string | symbol, ...args: unknown[]) => {
    const cleanName = typeof methodName === 'string' 
      ? methodName.replace(/[^a-zA-Z0-9]/g, '')
      : methodName;
    return handler(state, cleanName, ...args);
  };
}

/**
 * Utility function that combines multiple proxy handlers, trying each in order until one returns a result.
 *
 * @template S The type of the state object.
 * @param handlers Array of proxy handlers to try in order.
 * @returns A combined handler that delegates to the first matching handler.
 *
 * @example
 * const userAPI = createProxy(fallback([
 *   customMethods,
 *   getSet,
 *   (state, method) => `Method ${method} not found`
 * ]));
 */
export function fallback<S extends Record<string | symbol, any>>(
  handlers: ProxyHandlerUtil<S>[]
): ProxyHandlerUtil<S> {
  return (state: S, methodName: string | symbol, ...args: unknown[]) => {
    for (const handler of handlers) {
      const result = handler(state, methodName, ...args);
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  };
}

/**
 * Creates a dynamic API using ES6 Proxy that generates methods on-the-fly based on a handler function.
 * This enables highly flexible APIs where methods are created dynamically based on state shape or naming patterns.
 *
 * @template S The type of the state object.
 * @param handler Function that receives (state, methodName, ...args) and returns the result or new state.
 * @returns A function that takes initial state and returns a dynamic API with auto-generated methods.
 *
 * @example
 * // Basic usage with built-in getSet utility
 * interface User {
 *   name: string;
 *   age: number;
 *   email: string;
 * }
 * 
 * const userAPI = createProxy<User>(getSet)({ 
 *   name: "Alice", 
 *   age: 25, 
 *   email: "alice@example.com" 
 * });
 * 
 * // Methods are generated automatically:
 * const name = userAPI.getName();           // "Alice"
 * const updated = userAPI.setAge(26);       // Returns new API with age: 26
 * const email = updated.getEmail();         // "alice@example.com"
 * 
 * @example
 * // Composing utilities for flexible method generation
 * const flexibleAPI = createProxy<User>(
 *   ignoreCase(noSpecialChars(getSet))
 * )({ name: "Bob", age: 30, email: "bob@test.com" });
 * 
 * // All these work the same way:
 * flexibleAPI.getName();       // Standard
 * flexibleAPI.getname();       // Ignore case
 * flexibleAPI.get_name();      // No special chars
 * flexibleAPI.GET_NAME();      // Both combined
 * 
 * @example
 * // Custom handler with business logic
 * interface Counter {
 *   count: number;
 *   step: number;
 * }
 * 
 * const counterAPI = createProxy<Counter>((state, method, ...args) => {
 *   const methodStr = String(method);
 *   
 *   if (methodStr === 'increment') {
 *     return { ...state, count: state.count + state.step };
 *   }
 *   
 *   if (methodStr === 'decrement') {
 *     return { ...state, count: state.count - state.step };
 *   }
 *   
 *   if (methodStr === 'reset') {
 *     return { ...state, count: 0 };
 *   }
 *   
 *   if (methodStr.startsWith('add')) {
 *     const amount = args[0] as number;
 *     return { ...state, count: state.count + amount };
 *   }
 *   
 *   // Fallback to getSet for other methods
 *   return getSet(state, method, ...args);
 * })({ count: 0, step: 1 });
 * 
 * const result = counterAPI
 *   .increment()          // count: 1
 *   .increment()          // count: 2  
 *   .add(5)              // count: 7
 *   .setStep(2)          // step: 2
 *   .increment();        // count: 9
 * 
 * @example
 * // Error handling with validation
 * const validatedAPI = createProxy<User>((state, method, ...args) => {
 *   const result = getSet(state, method, ...args);
 *   
 *   // Add validation for setters
 *   if (String(method).startsWith('set') && result && typeof result === 'object') {
 *     if ('age' in result && (result as any).age < 0) {
 *       return { error: 'Age cannot be negative' };
 *     }
 *     if ('email' in result && !(result as any).email.includes('@')) {
 *       return { error: 'Invalid email format' };
 *     }
 *   }
 *   
 *   return result;
 * })({ name: "Alice", age: 25, email: "alice@example.com" });
 * 
 * const badResult = validatedAPI.setAge(-5);  // Returns { error: 'Age cannot be negative' }
 * const goodResult = validatedAPI.setAge(26); // Returns new API with age: 26
 */
export function createProxy<S extends Record<string | symbol, any>>(
  handler: ProxyHandler<S>
): (initialState: S) => any {
  if (typeof handler !== 'function') {
    throw createError('createProxy', 'Handler must be a function');
  }

  return function (initialState: S) {
    if (!initialState || typeof initialState !== 'object') {
      throw createError('createProxy', 'Initial state must be a non-null object');
    }

    // Create the base API object with internal state
    const baseAPI = {
      [INTERNAL_STATE]: initialState,
    };

    // Create and return the proxy
    return new Proxy(baseAPI, {
      get(target: any, prop: string | symbol): any {
        // Return internal state if requested
        if (prop === INTERNAL_STATE) {
          return target[INTERNAL_STATE];
        }

        // Skip symbol properties and prototype methods
        if (typeof prop === 'symbol' || prop === 'constructor' || prop === 'toString' || prop === 'valueOf') {
          return target[prop];
        }

        // Return a function that calls the handler
        return function (...args: unknown[]) {
          try {
            const currentState = target[INTERNAL_STATE];
            const result = handler(currentState, prop, ...args);

            // Handle error results
            if (result && typeof result === 'object' && 'error' in result) {
              throw createError('createProxy', `Method "${String(prop)}" failed: ${result.error}`);
            }

            // If result is undefined, the method doesn't exist
            if (result === undefined) {
              throw createError('createProxy', `Method "${String(prop)}" is not supported`);
            }

            // If result is the same type as state, treat as chainable (return new proxy)
            if (result && typeof result === 'object' && typeof currentState === 'object') {
              // Check if this looks like a state update (has similar structure)
              const stateKeys = Object.keys(currentState);
              const resultKeys = Object.keys(result);
              const isStateUpdate = stateKeys.some(key => key in result) || resultKeys.length > 0;

              if (isStateUpdate) {
                // Return new proxy with updated state
                return createProxy(handler)(result as S);
              }
            }

            // Otherwise return the result directly (non-chainable)
            return result;
          } catch (error) {
            if (error instanceof LayeredError) {
              throw error;
            }
            throw createError('createProxy', `Method "${String(prop)}" execution failed`, error);
          }
        };
      },

      has(_target: any, prop: string | symbol): boolean {
        // Internal symbols always exist
        if (prop === INTERNAL_STATE) return true;
        
        // For dynamic methods, we can't know ahead of time, so return true for string props
        return typeof prop === 'string';
      },

      ownKeys(target: any): ArrayLike<string | symbol> {
        // Return internal state keys plus common method patterns
        const state = target[INTERNAL_STATE];
        const stateKeys = Object.keys(state);
        
        // Generate common getter/setter patterns
        const methodNames = stateKeys.flatMap(key => [
          `get${key.charAt(0).toUpperCase() + key.slice(1)}`,
          `set${key.charAt(0).toUpperCase() + key.slice(1)}`
        ]);

        return [...methodNames, INTERNAL_STATE];
      },

      getOwnPropertyDescriptor(_target: any, prop: string | symbol) {
        if (prop === INTERNAL_STATE) {
          return { configurable: true, enumerable: false, writable: true };
        }
        
        // Dynamic methods are configurable and enumerable
        if (typeof prop === 'string') {
          return { configurable: true, enumerable: true, writable: false };
        }
        
        return undefined;
      }
    });
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// High-Order Handler Primitives
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/**
 * Definition of hooks available to enhance a proxy handler.
 */
type HandlerHooks<S> = {
  /**
   * Called before the base handler. 
   * Return `false` to cancel execution (returns undefined).
   * Return `true` to proceed.
   */
  shouldExecute?: (state: S, method: string | symbol, args: unknown[]) => boolean;
  
  /**
   * Transforms arguments before passing them to the base handler.
   */
  transformArgs?: (state: S, method: string | symbol, args: unknown[]) => unknown[];
  
  /**
   * Called after the base handler returns successfully.
   * Can be used to transform the result or perform side effects (logging).
   */
  onSuccess?: (result: any, state: S, method: string | symbol, args: unknown[]) => any;
  
  /**
   * Called if the base handler throws an error.
   * Return a value to recover, or re-throw the error.
   */
  onError?: (error: unknown, state: S, method: string | symbol, args: unknown[]) => any;
};

/**
 * Wraps an existing proxy handler with lifecycle hooks (Middleware pattern).
 * This allows you to add logging, validation, timing, or error handling to
 * any handler (including getSet or fuzzyMatch).
 *
 * @template S The type of the state object.
 * @param baseHandler The original handler to wrap.
 * @param hooks The lifecycle hooks to apply.
 * @returns A new, enhanced handler function.
 * 
 * @example
 * // Add logging to the built-in getSet handler
 * const loggedHandler = enhanceHandler(getSet, {
 *   onSuccess: (result, state, method, args) => {
 *     console.log(`Called ${String(method)} with`, args);
 *     return result;
 *   }
 * });
 * 
 * const api = createProxy(loggedHandler)(initialState);
 */
export function enhanceHandler<S extends Record<string | symbol, any>>(
  baseHandler: ProxyHandler<S>,
  hooks: HandlerHooks<S>
): ProxyHandler<S> {
  return function (state: S, methodName: string | symbol, ...originalArgs: unknown[]) {
    
    // 1. Validation / Predicate
    if (hooks.shouldExecute) {
      const shouldRun = hooks.shouldExecute(state, methodName, originalArgs);
      if (shouldRun === false) {
        return undefined; // Treats method as "not found/not supported"
      }
    }

    // 2. Argument Transformation
    let args = originalArgs;
    if (hooks.transformArgs) {
      args = hooks.transformArgs(state, methodName, originalArgs);
      if (!Array.isArray(args)) {
        // Safety check
        args = [args]; 
      }
    }

    try {
      // 3. Execution
      const result = baseHandler(state, methodName, ...args);

      // 4. Result Transformation / Side Effects
      if (hooks.onSuccess) {
        return hooks.onSuccess(result, state, methodName, args);
      }

      return result;
    } catch (error) {
      // 5. Error Recovery
      if (hooks.onError) {
        return hooks.onError(error, state, methodName, args);
      }
      throw error;
    }
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Fuzzy Matching Primitives
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/**
 * Calculates the Levenshtein edit distance between two strings.
 * This measures how many single-character edits (insertions, deletions, substitutions)
 * are required to change one word into the other.
 */
function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // Increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1,   // insertion
            matrix[i - 1][j] + 1    // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Configuration options for the fuzzy matching handler.
 */
type FuzzyOptions = {
  /** Maximum edit distance allowed (default: 2) */
  threshold?: number;
  /** Whether to log a warning when a fuzzy match is used (default: true) */
  warn?: boolean;
  /** A fallback handler to use if no fuzzy match is found */
  fallback?: (state: any, method: string | symbol, ...args: any[]) => any;
};

/**
 * Creates a proxy handler that tolerates typos in method names.
 * It calculates the Levenshtein distance between the requested method and the
 * available keys on the state object.
 * 
 * @param options Configuration for sensitivity and debugging
 * @returns A handler function compatible with createProxy
 * 
 * @example
 * const api = createProxy(fuzzyMatch({ threshold: 2 }))({ 
 *   processData: (s) => "Processing..." 
 * });
 * 
 * // Typo tolerance:
 * api.processDta(); // Works! Logs: "Fuzzy matched 'processDta' to 'processData'"
 * api.procssData(); // Works!
 */
export function fuzzyMatch<S extends Record<string | symbol, any>>(
  options: FuzzyOptions = {}
) {
  const { 
    threshold = 2, 
    warn = true, 
    fallback 
  } = options;

  return function (state: S, methodName: string | symbol, ...args: unknown[]) {
    // 1. Exact Match: If it exists, run it immediately.
    if (methodName in state) {
      const val = state[methodName as keyof S];
      return typeof val === 'function' ? val(state, ...args) : val;
    }

    // Symbols cannot be fuzzy matched
    if (typeof methodName === 'symbol') {
      return fallback ? fallback(state, methodName, ...args) : undefined;
    }

    // 2. Fuzzy Search
    const keys = Object.keys(state);
    let bestMatch: string | null = null;
    let minDistance = Infinity;

    for (const key of keys) {
      const dist = getLevenshteinDistance(methodName, key);
      
      // We want the smallest distance that is within the threshold
      if (dist <= threshold && dist < minDistance) {
        minDistance = dist;
        bestMatch = key;
      }
    }

    // 3. Execution or Fallback
    if (bestMatch) {
      if (warn) {
        console.warn(`[FuzzyMatch] Method "${methodName}" not found. Executing closest match: "${bestMatch}"`);
      }
      
      const match = state[bestMatch as keyof S];
      
      // Handle both values (getters) and functions
      if (typeof match === 'function') {
        return match(state, ...args);
      }
      return match;
    }

    // 4. No match found, try fallback or return undefined
    return fallback ? fallback(state, methodName, ...args) : undefined;
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Middleware Composition Primitives
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/**
 * A Higher-Order Handler (Middleware).
 * It expects a 'next' handler and returns a new handler.
 */
type Middleware<S> = (next: ProxyHandler<S>) => ProxyHandler<S>;

/**
 * "Lowers" a generic Middleware into a concrete Handler that can be passed
 * directly to createProxy.
 * 
 * It does this by automatically plugging in a "Base Handler" (defaults to getSet)
 * to serve as the final link in the chain.
 *
 * @template S The type of the state object.
 * @param middleware The higher-order function to lower.
 * @param base The handler to use at the end of the chain (defaults to getSet).
 * @returns A direct ProxyHandler ready for createProxy.
 *
 * @example
 * // Assume 'withLogging' is a Middleware: (next) => (s, m, a) => ...
 * 
 * // ❌ Error: createProxy expects (state, method, args), not (next)
 * // const api = createProxy(withLogging)(state); 
 * 
 * // ✅ Correct: 'applyBase' plugs in 'getSet' automatically
 * const handler = applyBase(withLogging);
 * const api = createProxy(handler)(state);
 */
export function applyBase<S extends Record<string | symbol, any>>(
  middleware: Middleware<S>,
  base: ProxyHandler<S> = getSet
): ProxyHandler<S> {
  return middleware(base);
}

/**
 * Composes multiple Middleware functions into a single Middleware.
 * This runs them from left-to-right (outer-to-inner).
 *
 * @param middlewares A list of middleware functions.
 * @returns A single composed middleware.
 */
export function pipe<S extends Record<string | symbol, any>>(
  ...middlewares: Middleware<S>[]
): Middleware<S> {
  return (base: ProxyHandler<S>) => {
    // Reduce right-to-left to wrap the base correctly
    return middlewares.reduceRight((next, mw) => mw(next), base);
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// State Focus Primitives  
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/**
 * Creates a lens that focuses method operations on a specific slice of state.
 * This enables building APIs that operate on nested state structures while maintaining
 * type safety and immutability patterns.
 *
 * @template S The type of the full state object.
 * @template T The type of the focused state slice.
 * @param getter Function that extracts the focused slice from the full state.
 * @param setter Function that updates the full state with a new focused slice.
 * @returns A function that takes methods and returns focused versions of those methods.
 *
 * @example
 * // Basic lens usage for nested state
 * interface AppState {
 *   user: {
 *     name: string;
 *     email: string;
 *     preferences: {
 *       theme: string;
 *       notifications: boolean;
 *     };
 *   };
 *   posts: Post[];
 *   ui: UIState;
 * }
 * 
 * // Create a lens focused on the user slice
 * const userLens = createLens<AppState, AppState['user']>(
 *   state => state.user,
 *   (state, user) => ({ ...state, user })
 * );
 * 
 * // Methods that operate on the user slice
 * const userMethods = {
 *   updateName: (user, name: string) => ({ ...user, name }),
 *   updateEmail: (user, email: string) => ({ ...user, email }),
 *   getName: (user) => user.name,
 *   getEmail: (user) => user.email
 * };
 * 
 * // Create API focused on user slice
 * const appAPI = makeWith(appState)(userLens(userMethods));
 * 
 * // Operations automatically work on the user slice
 * const newAppState = appAPI.updateName("Alice").updateEmail("alice@example.com");
 * // Full app state is updated, but methods only see/modify user slice
 * 
 * @example
 * // Deeply nested lens with preferences
 * const preferencesLens = createLens<AppState, AppState['user']['preferences']>(
 *   state => state.user.preferences,
 *   (state, prefs) => ({
 *     ...state,
 *     user: { ...state.user, preferences: prefs }
 *   })
 * );
 * 
 * const prefMethods = {
 *   setTheme: (prefs, theme: string) => ({ ...prefs, theme }),
 *   toggleNotifications: (prefs) => ({ ...prefs, notifications: !prefs.notifications }),
 *   getTheme: (prefs) => prefs.theme
 * };
 * 
 * const prefsAPI = makeWith(appState)(preferencesLens(prefMethods));
 * const updated = prefsAPI.setTheme("dark").toggleNotifications();
 * 
 * @example
 * // Chainable lens with makeChainable
 * const chainableUserLens = createLens<AppState, AppState['user']>(
 *   state => state.user,
 *   (state, user) => ({ ...state, user })
 * );
 * 
 * const chainableAPI = makeWith(appState)(
 *   chainableUserLens(makeChainable({
 *     setName: (user, name: string) => ({ ...user, name }),
 *     setEmail: (user, email: string) => ({ ...user, email }),
 *     clearEmail: (user) => ({ ...user, email: "" })
 *   }))
 * );
 * 
 * // Fluent chainable API that focuses on user slice
 * const result = chainableAPI
 *   .setName("Bob")
 *   .setEmail("bob@example.com")
 *   .clearEmail();
 * 
 * @example
 * // Lens composition for complex state management
 * interface BlogState {
 *   posts: { id: string; title: string; content: string; author: string }[];
 *   authors: { id: string; name: string; email: string }[];
 *   currentPost: string | null;
 * }
 * 
 * // Lens for posts array
 * const postsLens = createLens<BlogState, BlogState['posts']>(
 *   state => state.posts,
 *   (state, posts) => ({ ...state, posts })
 * );
 * 
 * // Lens for current post (returns single post or null)
 * const currentPostLens = createLens<BlogState, BlogState['posts'][0] | null>(
 *   state => state.currentPost ? state.posts.find(p => p.id === state.currentPost) || null : null,
 *   (state, post) => post ? {
 *     ...state,
 *     posts: state.posts.map(p => p.id === post.id ? post : p)
 *   } : state
 * );
 * 
 * const blogAPI = makeLayered(blogState)
 *   (postsLens({
 *     addPost: (posts, post) => [...posts, { ...post, id: crypto.randomUUID() }],
 *     removePost: (posts, id: string) => posts.filter(p => p.id !== id)
 *   }))
 *   (currentPostLens({
 *     updateTitle: (post, title: string) => post ? { ...post, title } : null,
 *     updateContent: (post, content: string) => post ? { ...post, content } : null
 *   }))
 *   ();
 * 
 * @example
 * // Array lens for working with specific array elements
 * const createArrayLens = <S, T>(
 *   getter: (state: S) => T[],
 *   setter: (state: S, array: T[]) => S,
 *   index: number
 * ) => createLens<S, T | undefined>(
 *   state => getter(state)[index],
 *   (state, item) => {
 *     const array = getter(state);
 *     if (item === undefined) return setter(state, array.filter((_, i) => i !== index));
 *     const newArray = [...array];
 *     newArray[index] = item;
 *     return setter(state, newArray);
 *   }
 * );
 * 
 * // Focus on first post
 * const firstPostLens = createArrayLens(
 *   (state: BlogState) => state.posts,
 *   (state, posts) => ({ ...state, posts }),
 *   0
 * );
 * 
 * const firstPostAPI = makeWith(blogState)(firstPostLens({
 *   setTitle: (post, title: string) => post ? { ...post, title } : undefined,
 *   getTitle: (post) => post?.title || 'No post'
 * }));
 */
export function createLens<S extends object, T>(
  getter: LensGetter<S, T>,
  setter: LensSetter<S, T>
): <M extends Record<string, (focused: T, ...args: any[]) => any>>(methods: M) => Methods<S> {
  if (typeof getter !== 'function') {
    throw createError('createLens', 'Getter must be a function');
  }
  
  if (typeof setter !== 'function') {
    throw createError('createLens', 'Setter must be a function');
  }

  return function <M extends Record<string, (focused: T, ...args: any[]) => any>>(methods: M): Methods<S> {
    if (!methods || typeof methods !== 'object') {
      throw createError('createLens', 'Methods must be a non-null object');
    }

    // Validate methods
    try {
      validateMethods(methods, 'createLens');
    } catch (error) {
      throw createError('createLens', 'Methods validation failed', error);
    }

    const focusedMethods: Methods<S> = {};
    const isChainable = (methods as Record<string | symbol, unknown>)[IS_CHAINABLE] === true;

    // Preserve chainable marker if present
    if (isChainable) {
      (focusedMethods as any)[IS_CHAINABLE] = true;
    }

    for (const [methodName, method] of Object.entries(methods)) {
      if (methodName === IS_CHAINABLE.toString()) continue;

      if (typeof method !== 'function') {
        throw createError('createLens', `Method "${methodName}" must be a function`);
      }

      // Create the focused method
      focusedMethods[methodName] = (fullState: S, ...args: unknown[]) => {
        try {
          // Extract the focused slice
          const focusedState = getter(fullState);
          
          // Call the original method with the focused state
          const result = method(focusedState, ...args);

          // If the method is chainable and returns a new focused state
          if (isChainable && result !== undefined && result !== null) {
            // Update the full state with the new focused state
            return setter(fullState, result as T);
          }

          // For non-chainable methods, return the result directly
          return result;
        } catch (error) {
          throw createError('createLens', `Focused method "${methodName}" failed`, error);
        }
      };
    }

    return focusedMethods;
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Fallback Chain Primitives
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/** Type for value validator function */
type ValueValidator<T = any> = (value: T) => boolean;

/** Type for fallback chain builder */
type FallbackChainBuilder<T extends Record<string | symbol, any>> = {
  (): T;
  (fallbackObject: Partial<T>): FallbackChainBuilder<T>;
};

/** Default validator that checks for non-null, non-undefined values */
const defaultValidator: ValueValidator = (value: any): boolean => {
  return value !== null && value !== undefined;
};

/**
 * Creates a fallback chain proxy that traverses multiple objects to find valid values.
 * Uses a layered API similar to makeLayered for building fallback chains, with a final
 * proxy that intelligently falls through objects until a valid value is found.
 *
 * @template T The type of the primary object and fallback objects.
 * @param primaryObject The main object that will receive writes and be checked first for reads.
 * @param validator Optional function to determine if a value is valid (defaults to non-null/undefined check).
 * @returns A builder function for chaining fallback objects.
 *
 * @example
 * // Basic fallback chain with default validator
 * interface Config {
 *   apiUrl?: string;
 *   timeout?: number;
 *   retries?: number;
 *   debug?: boolean;
 * }
 * 
 * const userConfig: Config = { apiUrl: "https://api.user.com" };
 * const teamConfig: Config = { timeout: 5000, retries: 3 };
 * const defaultConfig: Config = { 
 *   apiUrl: "https://api.default.com", 
 *   timeout: 10000, 
 *   retries: 1, 
 *   debug: false 
 * };
 * 
 * const config = withFallback(userConfig)
 *   (teamConfig)
 *   (defaultConfig)
 *   ();
 * 
 * console.log(config.apiUrl);    // "https://api.user.com" (from user)
 * console.log(config.timeout);   // 5000 (from team)
 * console.log(config.retries);   // 3 (from team)  
 * console.log(config.debug);     // false (from default)
 * 
 * // Writes go to the primary object
 * config.timeout = 15000;
 * console.log(userConfig.timeout); // 15000
 * 
 * @example
 * // Custom validator for non-empty strings
 * const isNonEmptyString = (value: any): boolean => 
 *   typeof value === 'string' && value.trim().length > 0;
 * 
 * const userPrefs = { name: "", theme: "dark" };
 * const defaults = { name: "Anonymous", theme: "light", lang: "en" };
 * 
 * const prefs = withFallback(userPrefs, isNonEmptyString)
 *   (defaults)
 *   ();
 * 
 * console.log(prefs.name);   // "Anonymous" (user's empty string is invalid)
 * console.log(prefs.theme);  // "dark" (user's value is valid)
 * console.log(prefs.lang);   // "en" (only in defaults)
 * 
 * @example
 * // Complex fallback chain with environment configuration
 * interface AppConfig {
 *   database: {
 *     host?: string;
 *     port?: number;
 *     ssl?: boolean;
 *   };
 *   cache: {
 *     enabled?: boolean;
 *     ttl?: number;
 *   };
 *   features: {
 *     auth?: boolean;
 *     logging?: boolean;
 *   };
 * }
 * 
 * const envConfig: AppConfig = {
 *   database: { host: process.env.DB_HOST },
 *   cache: { enabled: true }
 * };
 * 
 * const localConfig: AppConfig = {
 *   database: { host: "localhost", port: 5432 },
 *   features: { auth: true, logging: true }
 * };
 * 
 * const prodDefaults: AppConfig = {
 *   database: { host: "prod-db", port: 5432, ssl: true },
 *   cache: { enabled: false, ttl: 3600 },
 *   features: { auth: true, logging: false }
 * };
 * 
 * const appConfig = withFallback(envConfig)
 *   (localConfig)
 *   (prodDefaults)
 *   ();
 * 
 * // Nested property access works through the fallback chain
 * console.log(appConfig.database.host);     // From env or local or prod
 * console.log(appConfig.database.ssl);      // From prod (only defined there)
 * console.log(appConfig.features.logging);  // From local (overrides prod)
 * 
 * @example
 * // Validator for positive numbers
 * const isPositiveNumber = (value: any): boolean => 
 *   typeof value === 'number' && value > 0;
 * 
 * const userSettings = { volume: -1, brightness: 0.8 };
 * const systemDefaults = { volume: 0.5, brightness: 1.0, contrast: 0.7 };
 * 
 * const settings = withFallback(userSettings, isPositiveNumber)
 *   (systemDefaults)
 *   ();
 * 
 * console.log(settings.volume);     // 0.5 (user's -1 is invalid)
 * console.log(settings.brightness); // 0.8 (user's value is valid)
 * console.log(settings.contrast);   // 0.7 (only in defaults)
 * 
 * @example
 * // Dynamic fallback chain building
 * const createConfigChain = (environment: 'dev' | 'staging' | 'prod') => {
 *   const baseConfig = { app: 'MyApp', version: '1.0.0' };
 *   const builder = withFallback(baseConfig);
 *   
 *   if (environment === 'dev') {
 *     return builder
 *       ({ debug: true, logging: 'verbose' })
 *       ({ apiUrl: 'http://localhost:3000' })
 *       ();
 *   }
 *   
 *   if (environment === 'staging') {
 *     return builder
 *       ({ debug: false, logging: 'info' })
 *       ({ apiUrl: 'https://staging-api.example.com' })
 *       ();
 *   }
 *   
 *   return builder
 *     ({ debug: false, logging: 'error' })
 *     ({ apiUrl: 'https://api.example.com' })
 *     ();
 * };
 * 
 * const devConfig = createConfigChain('dev');
 * console.log(devConfig.debug);   // true
 * console.log(devConfig.apiUrl);  // 'http://localhost:3000'
 */
export function withFallback<T extends Record<string | symbol, any>>(
  primaryObject: T,
  validator: ValueValidator = defaultValidator
): FallbackChainBuilder<T> {
  if (!primaryObject || typeof primaryObject !== 'object') {
    throw createError('withFallback', 'Primary object must be a non-null object');
  }

  if (typeof validator !== 'function') {
    throw createError('withFallback', 'Validator must be a function');
  }

  // Keep track of the fallback chain
  const fallbackChain: Partial<T>[] = [];

  function createBuilder(): FallbackChainBuilder<T> {
    function builder(): T;
    function builder(fallbackObject: Partial<T>): FallbackChainBuilder<T>;
    function builder(fallbackObject?: Partial<T>): any {
      if (fallbackObject === undefined) {
        // Finalize and return the proxy
        return createFallbackProxy(primaryObject, fallbackChain, validator);
      }

      if (!fallbackObject || typeof fallbackObject !== 'object') {
        throw createError('withFallback', 'Fallback object must be a non-null object');
      }

      // Add to fallback chain and return new builder
      fallbackChain.push(fallbackObject);
      return createBuilder();
    }

    return builder;
  }

  return createBuilder();
}

/**
 * Creates the actual proxy that implements the fallback traversal logic.
 */
function createFallbackProxy<T extends Record<string | symbol, any>>(
  primaryObject: T,
  fallbackChain: Partial<T>[],
  validator: ValueValidator
): T {
  return new Proxy(primaryObject, {
    get(target: T, prop: string | symbol): any {
      // Handle special properties
      if (typeof prop === 'symbol' || prop === 'constructor' || prop === 'toString' || prop === 'valueOf') {
        return target[prop];
      }

      // Traverse the fallback chain to find a valid value
      const objectsToCheck = [target, ...fallbackChain];
      
      for (const obj of objectsToCheck) {
        if (obj && typeof obj === 'object' && prop in obj) {
          const value = (obj as any)[prop];
          
          try {
            if (validator(value)) {
              // If the value is from a nested object, we need to create a nested proxy
              if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Create nested fallback proxies for object values
                const nestedFallbacks: any[] = [];
                
                // Collect corresponding nested objects from the fallback chain
                for (const fallbackObj of fallbackChain) {
                  if (fallbackObj && typeof fallbackObj === 'object' && prop in fallbackObj) {
                    const nestedValue = (fallbackObj as any)[prop];
                    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
                      nestedFallbacks.push(nestedValue);
                    }
                  }
                }
                
                // Return a nested proxy if we have nested objects to fall back to
                if (nestedFallbacks.length > 0) {
                  return createFallbackProxy(value, nestedFallbacks, validator);
                }
              }
              
              return value;
            }
          } catch (error) {
            // If validator throws, continue to next fallback
            continue;
          }
        }
      }

      // No valid value found in the entire chain
      return undefined;
    },

    set(target: T, prop: string | symbol, value: any): boolean {
      // Always set on the primary object
      try {
        (target as any)[prop] = value;
        return true;
      } catch (error) {
        return false;
      }
    },

    has(target: T, prop: string | symbol): boolean {
      // Check if property exists in any object in the chain
      const objectsToCheck = [target, ...fallbackChain];
      
      for (const obj of objectsToCheck) {
        if (obj && typeof obj === 'object' && prop in obj) {
          return true;
        }
      }
      
      return false;
    },

    ownKeys(target: T): ArrayLike<string | symbol> {
      // Collect all keys from all objects in the chain
      const allKeys = new Set<string | symbol>();
      const objectsToCheck = [target, ...fallbackChain];
      
      for (const obj of objectsToCheck) {
        if (obj && typeof obj === 'object') {
          // Get own enumerable property names
          Object.getOwnPropertyNames(obj).forEach(key => allKeys.add(key));
          // Get own symbol properties
          Object.getOwnPropertySymbols(obj).forEach(symbol => allKeys.add(symbol));
        }
      }
      
      return Array.from(allKeys);
    },

    getOwnPropertyDescriptor(target: T, prop: string | symbol): PropertyDescriptor | undefined {
      // Check primary object first
      const primaryDesc = Object.getOwnPropertyDescriptor(target, prop);
      if (primaryDesc) {
        return primaryDesc;
      }

      // Check fallback chain
      for (const obj of fallbackChain) {
        if (obj && typeof obj === 'object') {
          const desc = Object.getOwnPropertyDescriptor(obj, prop);
          if (desc) {
            // Return a descriptor that points to our proxy's get/set behavior
            return {
              configurable: true,
              enumerable: desc.enumerable,
              writable: true,
              value: undefined // Will be overridden by the proxy get trap
            };
          }
        }
      }

      return undefined;
    },

    deleteProperty(target: T, prop: string | symbol): boolean {
      // Only delete from primary object
      try {
        delete (target as any)[prop];
        return true;
      } catch (error) {
        return false;
      }
    },

    defineProperty(target: T, prop: string | symbol, descriptor: PropertyDescriptor): boolean {
      // Only define on primary object
      try {
        Object.defineProperty(target, prop, descriptor);
        return true;
      } catch (error) {
        return false;
      }
    }
  });
}

/**
 * An enhanced version of `makeWith` that automatically composes methods with the same name.
 * When multiple methods share a name, later methods receive previous methods as their last parameter.
 *
 * @template S The type of the subject/state object.
 * @param subject The state object to bind methods to.
 * @returns A curried function that takes method objects and composes overlapping method names.
 *
 * @example
 * // Automatic composition of save methods
 * const api = makeWithCompose({ data: [] })({
 *   save: (s, item) => ({ data: [...s.data, item] }),
 *   save: (s, item, prevSave) => {
 *     console.log('Saving item:', item);
 *     const result = prevSave(s, item);
 *     console.log('Item saved successfully');
 *     return result;
 *   }
 * });
 *
 * @example  
 * // Composing with multiple method objects
 * const userAPI = makeWithCompose({ users: [] })(
 *   { save: (s, user) => ({ users: [...s.users, user] }) },
 *   { save: (s, user, prevSave) => prevSave(s, { ...user, timestamp: Date.now() }) },
 *   { save: (s, user, prevSave) => {
 *       if (!user.email) throw new Error('Email required');
 *       return prevSave(s, user);
 *     }
 *   }
 * );
 */
export function makeWithCompose<S extends object>(subject: S) {
  if (subject === null || subject === undefined) {
    throw createError('makeWithCompose', 'Subject cannot be null or undefined');
  }

  if (typeof subject !== 'object') {
    throw createError('makeWithCompose', `Subject must be an object, got ${typeof subject}`);
  }

  return function (...methodObjects: Methods<S>[]): ChainableApi<any, S> {
    if (methodObjects.length === 0) {
      throw createError('makeWithCompose', 'At least one method object must be provided');
    }

    // Merge all method objects with composition for duplicate names
    const composedMethods: Methods<S> = {};

    for (const methodObj of methodObjects) {
      if (!methodObj || typeof methodObj !== 'object') {
        throw createError('makeWithCompose', 'All arguments must be non-null objects');
      }

      for (const [key, method] of Object.entries(methodObj)) {
        if (key === IS_CHAINABLE.toString()) {
          // Preserve chainable markers - if any object has chainable methods, preserve it
          (composedMethods as any)[key] = method;
          continue;
        }

        if (typeof method !== 'function') {
          throw createError('makeWithCompose', `Method "${key}" must be a function`);
        }

        const existingMethod = composedMethods[key];

        if (existingMethod) {
          // Compose with existing method
          composedMethods[key] = (s: S, ...args: any[]) => {
            return method(s, ...args, existingMethod);
          };
        } else {
          // First method with this name
          composedMethods[key] = method;
        }
      }
    }

    // Use regular makeWith with the composed methods
    return makeWith(subject)(composedMethods);
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Advanced Helpers
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/**
 * Composes two factory functions where the second depends on the result of the first,
 * merging their results into a single object. This is a powerful, general-purpose
 * utility for building complex objects from dependent parts.
 *
 * @template P - A function that creates the primary object.
 * @template S - A function that takes the result of `P` and creates a secondary object.
 * @param primaryFactory The first function to execute.
 * @param secondaryFactory The second function, which receives the object returned by `primaryFactory`.
 * @returns A new, single factory function that runs the entire sequence.
 *
 * @example
 * const createUser = (name: string) => ({ name, id: Math.random() });
 * const addPermissions = (user: { id: number }) => ({ 
 *   permissions: user.id > 0.5 ? ['admin'] : ['user'] 
 * });
 *
 * const createFullUser = enrich(createUser, addPermissions);
 * const user = createFullUser('Alice'); 
 * // { name: 'Alice', id: 0.7, permissions: ['admin'] }
 * 
 * @example
 * // Building a configuration object
 * const createBaseConfig = (env: string) => ({ 
 *   environment: env, 
 *   debug: env === 'development' 
 * });
 * const addDatabaseConfig = (config: { environment: string }) => ({
 *   database: {
 *     host: config.environment === 'production' ? 'prod.db' : 'dev.db',
 *     ssl: config.environment === 'production'
 *   }
 * });
 * 
 * const createConfig = enrich(createBaseConfig, addDatabaseConfig);
 * const config = createConfig('production');
 * // { environment: 'production', debug: false, database: { host: 'prod.db', ssl: true } }
 */
export function enrich<
  P extends (...args: any[]) => object,
  S extends (primaryResult: ReturnType<P>) => object,
>(
  primaryFactory: P,
  secondaryFactory: S,
): (...args: Parameters<P>) => ReturnType<P> & ReturnType<S> {
  if (typeof primaryFactory !== 'function') {
    throw createError('enrich', 'Primary factory must be a function');
  }

  if (typeof secondaryFactory !== 'function') {
    throw createError('enrich', 'Secondary factory must be a function');
  }

  return function (...args: Parameters<P>) {
    try {
      const primaryResult = primaryFactory(...args) as ReturnType<P>;

      if (!primaryResult || typeof primaryResult !== 'object') {
        throw createError('enrich',
          `Primary factory must return an object, got ${typeof primaryResult}`
        );
      }

      const secondaryResult = secondaryFactory(primaryResult);

      if (!secondaryResult || typeof secondaryResult !== 'object') {
        throw createError('enrich',
          `Secondary factory must return an object, got ${typeof secondaryResult}`
        );
      }

      return { ...primaryResult, ...secondaryResult } as ReturnType<P> & ReturnType<S>;
    } catch (error) {
      throw createError('enrich', 'Factory composition failed', error);
    }
  };
}

/**
 * Creates a complex, multi-layered API using a fluent, curried interface.
 * Each subsequent layer can be either:
 * 1. An object of methods to bind to the current API
 * 2. A function that receives the current API and returns methods to bind
 * 
 * Function layers enable dynamic layer creation based on the current state of the API.
 * Each layer is "self-aware" and receives the instance from previous layers as its context,
 * enabling powerful orchestration and composition.
 *
 * The chain is terminated by calling the final returned function with no arguments.
 *
 * @template S The type of the initial state or configuration object.
 * @param subject The initial state object.
 * @returns A curried function that takes the base methods and begins the layering process.
 *
 * @example
 * // Basic usage with object layers
 * const basicCounter = makeLayered({ count: 1 })
 *   (makeChainable({ add: (s, n) => ({ ...s, count: s.count + n }) })) // Base
 *   ({ get: (s) => s.count }) // Getters
 *   ({ double: (self) => self.add(self.get()) }) // Enhancers
 *   (); // Finalize
 * 
 * @example
 * // Advanced usage with function layers
 * const advancedCounter = makeLayered({ count: 1, multiplier: 2 })
 *   // Base chainable layer
 *   (makeChainable({ 
 *     add: (s, n: number) => ({ ...s, count: s.count + n }),
 *     multiply: (s) => ({ ...s, count: s.count * s.multiplier })
 *   }))
 *   // Object layer - simple getters
 *   ({ 
 *     get: (s) => s.count,
 *     getMultiplier: (s) => s.multiplier 
 *   })
 *   // Function layer - receives the current API and creates methods that use it
 *   ((api) => ({
 *     addAndGet: (s, n: number) => {
 *       const newApi = api.add(n);
 *       return newApi.get();
 *     },
 *     smartIncrement: (s) => {
 *       const current = api.get();
 *       return current < 10 ? api.add(1).get() : api.add(current * 0.1).get();
 *     }
 *   }))
 *   // Another function layer building on previous layers
 *   ((api) => ({
 *     performComplexOperation: (s, input: number) => {
 *       const doubled = api.multiply().get();
 *       const added = api.addAndGet(input);
 *       return doubled + added;
 *     }
 *   }))
 *   (); // Finalize the API
 */
export function makeLayered<S extends object>(subject: S) {
  if (subject === null || subject === undefined) {
    throw createError('makeLayered', 'Subject cannot be null or undefined');
  }

  if (typeof subject !== 'object') {
    throw createError('makeLayered', `Subject must be an object, got ${typeof subject}`);
  }

  return function <BaseFns extends Methods<S>>(
    baseFns: BaseFns,
  ): LayeredApiBuilder<ChainableApi<BaseFns, S>> {
    if (!baseFns || typeof baseFns !== 'object') {
      throw createError('makeLayered', 'Base functions must be a non-null object');
    }

    try {
      const baseInstance = makeWith(subject)(baseFns);
      let layerCount = 0;

      const createNextLayer = <CurrentApi extends object>(
        currentInstance: CurrentApi,
      ): LayeredApiBuilder<CurrentApi> => {
        return (enhancerFnsOrLayerFn?: Methods<CurrentApi> | LayerFunction<CurrentApi>): any => {
          if (enhancerFnsOrLayerFn === undefined) {
            return currentInstance;
          }

          layerCount++;

          try {
            let enhancerFns: Methods<CurrentApi>;

            // Type-safe function layer detection
            if (typeof enhancerFnsOrLayerFn === 'function') {
              if (!isLayerFunction(enhancerFnsOrLayerFn)) {
                throw createError('makeLayered',
                  `Layer function must accept exactly one parameter (the current API), got function with ${enhancerFnsOrLayerFn.length} parameters`
                );
              }

              enhancerFns = enhancerFnsOrLayerFn(currentInstance);

              if (!enhancerFns || typeof enhancerFns !== 'object') {
                throw createError('makeLayered',
                  `Layer function must return an object of methods, got ${typeof enhancerFns}`
                );
              }

            } else {
              if (!enhancerFnsOrLayerFn || typeof enhancerFnsOrLayerFn !== 'object') {
                throw createError('makeLayered',
                  'Layer must be either a function or an object of methods'
                );
              }

              enhancerFns = enhancerFnsOrLayerFn;
            }

            // Validate the methods before binding
            validateMethods(enhancerFns, `makeLayered layer ${layerCount}`);

            // Check if this is a composable layer
            const isComposable = (enhancerFns as Record<string | symbol, unknown>)[IS_COMPOSABLE] === true;

            let nextLayer: Record<string, MethodFunction<CurrentApi>>;

            if (isComposable) {
              // Handle composition - methods get access to previous methods
              nextLayer = {};

              for (const [key, newMethod] of Object.entries(enhancerFns)) {
                if (key === IS_COMPOSABLE.toString()) continue;

                const fn = newMethod as Function;
                const previousMethod = (currentInstance as Record<string, unknown>)[key] as MethodFunction<CurrentApi> | undefined;

                if (previousMethod && typeof previousMethod === 'function') {
                  // Compose: provide previous method as last parameter, bound to current instance
                  nextLayer[key] = (...args: readonly unknown[]) => {
                    // Create a smart previous method that automatically handles chainable vs regular returns
                    const smartPreviousMethod = (...methodArgs: unknown[]) => {
                      const result = previousMethod(currentInstance, ...methodArgs);

                      // If the result looks like an API instance (has methods and internal state),
                      // extract the state for composition
                      if (result && typeof result === 'object' &&
                        Object.prototype.hasOwnProperty.call(result, INTERNAL_STATE)) {
                        return (result as any)[INTERNAL_STATE];
                      }

                      // Otherwise return the result as-is (regular method return)
                      return result;
                    };

                    // Call the composed method with subject and smart previous method
                    try {
                      return fn(currentInstance, ...(args as unknown[]), smartPreviousMethod);
                    } catch (error) {
                      throw createError('compose', `Composed method "${key}" failed during execution`, error);
                    }
                  };
                } else {
                  // No previous method, provide a method that throws when called
                  nextLayer[key] = (...args: readonly unknown[]) => {
                    const noPreviousMethod = () => {
                      throw createError('compose', `No previous method "${key}" found to compose with`);
                    };
                    try {
                      return fn(currentInstance, ...(args as unknown[]), noPreviousMethod);
                    } catch (error) {
                      throw createError('compose', `Composed method "${key}" failed during execution`, error);
                    }
                  };
                }
              }

              // Use regular binding for the composed layer
              nextLayer = provideTo(currentInstance)(nextLayer);
            } else {
              // Regular binding
              nextLayer = provideTo(currentInstance)(enhancerFns);
            }

            // Create new instance with spread to avoid mutations
            const newInstance = Object.assign(
              Object.create(Object.getPrototypeOf(currentInstance)),
              currentInstance,
              nextLayer
            );

            return createNextLayer(newInstance);
          } catch (error) {
            throw createError('makeLayered', `Layer ${layerCount} creation failed`, error);
          }
        };
      };

      return createNextLayer(baseInstance);
    } catch (error) {
      throw createError('makeLayered', 'Layered API initialization failed', error);
    }
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Aliases and Default Export
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/** 
 * Alias for `_with`. Provides a more semantic name for partial application scenarios.
 * 
 * @example
 * const config = { apiKey: 'abc123', timeout: 5000 };
 * const [get, post] = provide(config)(
 *   (cfg, url) => `GET ${url} with key ${cfg.apiKey}`,
 *   (cfg, url, data) => `POST ${url} with ${JSON.stringify(data)}`
 * );
 */
export const provide = _with;

/** 
 * Alias for `make`. Emphasizes the collection aspect when gathering functions.
 * 
 * @example
 * function validateEmail(email) { return email.includes('@'); }
 * function validatePassword(pwd) { return pwd.length >= 8; }
 * 
 * const validators = collectFns(validateEmail, validatePassword);
 * // { validateEmail: [Function], validatePassword: [Function] }
 */
export const collectFns = make;

/** 
 * Alias for `makeWith`. Emphasizes the "providing to" relationship.
 * 
 * @example
 * const state = { items: [], loading: false };
 * const api = provideTo(state)({
 *   getItems: (s) => s.items,
 *   isLoading: (s) => s.loading
 * });
 */
export const provideTo = makeWith;

/** 
 * Alias for `rebind`. Uses more intuitive "chainable" terminology.
 * 
 * @example
 * const chainableOps = makeChainable({
 *   push: (arr, item) => [...arr, item],
 *   filter: (arr, predicate) => arr.filter(predicate),
 *   map: (arr, fn) => arr.map(fn)
 * });
 * 
 * const listAPI = makeWith([1, 2, 3])(chainableOps);
 * const result = listAPI.push(4).filter(x => x > 2).map(x => x * 2);
 */
export const makeChainable = rebind;

/**
 * Default export containing all functions with their primary names.
 * Useful for importing the entire library or for environments that prefer default imports.
 * 
 * @example
 * import FL from './functional-library';
 * 
 * const api = FL.makeWith(state)(FL.makeChainable(methods));
 * 
 * @example
 * import { makeWith, makeChainable, makeLayered } from './functional-library';
 * 
 * const layeredAPI = makeLayered(initialState)
 *   (makeChainable(baseMethods))
 *   (additionalMethods)
 *   ();
 */
export default {
  with: _with,
  provide,
  make,
  collectFns,
  makeWith,
  makeWithCompose,
  provideTo,
  rebind,
  makeChainable,
  enrich,
  makeLayered,
  compose,
  merge,
  createMerger,
  getKeyDescriptions,
  createProxy,
  getSet,
  ignoreCase,
  noSpecialChars,
  fallback,
  createLens,
  withFallback,
};


/** Type guard to check if a value is a valid LayerFunction */
export type IsLayerFunction<T> = T extends (api: any) => Methods<any> ? true : false;

/** 
 * A method that can compose with a previous method of the same name.
 * The previous method is provided as the last parameter.
 */
export type ComposableMethod<S, Args extends any[], R, PrevR = R> = (
  subject: S,
  ...args: [...Args, (subject: S, ...args: Args) => PrevR]
) => R;

/** 
 * A collection of composable methods where each can access the previous method.
 */
export type ComposableMethods<S extends object, PrevMethods extends Methods<S> = {}> = {
  [K in keyof PrevMethods]?: PrevMethods[K] extends (s: S, ...args: infer A) => infer R
  ? ComposableMethod<S, A, R, R>
  : never;
};


/* eslint-disable @typescript-eslint/no-explicit-any */

type TypeGuard<T> = (value: unknown) => value is T;
type GuardedType<P> = P extends TypeGuard<infer T> ? T : never;

type GuardedArgs<Preds extends readonly TypeGuard<any>[]> = {
  [K in keyof Preds]: Preds[K] extends TypeGuard<infer T> ? T : never;
};

type Tail<T extends readonly any[]> = T extends readonly [any, ...infer R] ? R : never;

type Drop<
  T extends readonly any[],
  N extends number,
  I extends readonly any[] = []
> = I["length"] extends N
  ? T
  : T extends readonly [any, ...infer R]
    ? Drop<R, N, [...I, any]>
    : readonly [];

type PredOrPreds = TypeGuard<any> | readonly TypeGuard<any>[];
type Pair = readonly [PredOrPreds, (...args: any[]) => any];

/**
 * args(...) helper: forces a const tuple of predicates without needing `as const`.
 *
 * Usage:
 *   args(isNumber, isString) // readonly [.., ..]
 */
export function args<const P extends readonly TypeGuard<any>[]>(...preds: P): P {
  return preds;
}

/**
 * overloads(...) helper: forces a const tuple of overload pairs without needing `as const`.
 *
 * Usage:
 *   overloads(
 *     [isString, (s: string) => ...],
 *     [args(isNumber, isBool), (n: number, b: boolean) => ...],
 *   )
 */
export function overloads<const P extends readonly Pair[]>(...pairs: P): P {
  return pairs;
}

type PairToSignature<P extends Pair> =
  P extends readonly [infer PP, infer Impl]
    ? Impl extends (...args: any[]) => any
      ? PP extends TypeGuard<any>
        ? (a0: GuardedType<PP>, ...rest: Tail<Parameters<Impl>>) => ReturnType<Impl>
        : PP extends readonly TypeGuard<any>[]
          ? (
              ...args: [
                ...GuardedArgs<PP>,
                ...Drop<Parameters<Impl>, PP["length"] & number>
              ]
            ) => ReturnType<Impl>
          : never
      : never
    : never;

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type OverloadedFromPairs<Pairs extends readonly Pair[]> =
  UnionToIntersection<PairToSignature<Pairs[number]>>;

type WithFallback<
  Pairs extends readonly Pair[],
  Fallback extends ((...args: any[]) => any) | undefined
> = Fallback extends (...args: any[]) => any
  ? OverloadedFromPairs<Pairs> & Fallback
  : OverloadedFromPairs<Pairs>;

// ---------- runtime ----------

export function createOverloadedFunction<
  const Pairs extends readonly Pair[],
  Fallback extends ((...args: any[]) => any) | undefined = undefined
>(
  pairs: Pairs,
  fallback?: Fallback
): WithFallback<Pairs, Fallback> {
  const fn = ((...callArgs: any[]) => {
    for (const [predOrPreds, impl] of pairs as readonly Pair[]) {
      if (typeof predOrPreds === "function") {
        if (predOrPreds(callArgs[0])) return (impl as any)(...callArgs);
      } else {
        const preds = predOrPreds;
        let ok = true;
        for (let i = 0; i < preds.length; i++) {
          if (!preds[i]!(callArgs[i])) {
            ok = false;
            break;
          }
        }
        if (ok) return (impl as any)(...callArgs);
      }
    }

    if (fallback) return (fallback as any)(...callArgs);
    throw new TypeError("No overload matched and no fallback was provided.");
  }) as any;

  return fn;
}

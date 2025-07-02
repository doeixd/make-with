/**
 * @file A functional utility library for creating powerful, immutable, and chainable APIs.
 * It provides tools for partial application and function composition, enabling elegant state
 * management patterns.
 *
 * @version 0.0.3
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
 * Creates a function that can merge multiple method objects, with later objects
 * taking precedence over earlier ones. Useful for combining base functionality.
 *
 * @template T The type of method objects to merge.
 * @param objects Method objects to merge, in order of precedence (later objects override earlier).
 * @returns A single merged object containing all methods.
 *
 * @example
 * // Merge base methods with extensions
 * const baseMethods = { get: (s) => s.value, set: (s, v) => ({ value: v }) };
 * const extensions = { increment: (s) => ({ value: s.value + 1 }) };
 * const validation = { set: (s, v) => v >= 0 ? ({ value: v }) : s }; // Override set
 *
 * const allMethods = merge(baseMethods, extensions, validation);
 * const api = makeWith({ value: 0 })(allMethods);
 *
 * @example
 * // Conditional merging
 * const createAPI = (withAdmin = false) => {
 *   const base = { getUser: (s, id) => s.users[id] };
 *   const admin = withAdmin ? { deleteUser: (s, id) => ({ users: s.users.filter(u => u.id !== id) }) } : {};
 *   return makeWith(initialState)(merge(base, admin));
 * };
 */
export function merge<T extends Methods>(...objects: T[]): T {
  if (objects.length === 0) {
    throw createError('merge', 'At least one object must be provided');
  }

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (!obj || typeof obj !== 'object') {
      throw createError('merge', `Argument at index ${i} must be a non-null object`);
    }

    // Validate methods in each object
    try {
      validateMethods(obj, `merge argument ${i}`);
    } catch (error) {
      throw createError('merge', `Object at index ${i} validation failed`, error);
    }
  }

  return Object.assign({}, ...objects);
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
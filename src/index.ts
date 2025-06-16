/**
 * @file A functional utility library for creating powerful, immutable, and chainable APIs.
 * It provides tools for partial application and function composition, enabling elegant state
 * management patterns.
 *
 * @version 2.1.0
 * @license MIT
 */

// A special symbol to identify objects of functions wrapped by `makeChainable`.
const IS_CHAINABLE = Symbol("isChainable");

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Type Definitions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/** A utility type representing a collection of methods for a given subject. */
type Methods<S = any> = Record<string, (subject: S, ...args: any[]) => any>;

/**
 * The return type of a `provideTo` (`makeWith`) call. It correctly infers the
 * return types for both regular methods and those marked as chainable.
 */
type ChainableApi<Fns extends Methods<S>, S> = {
  [K in keyof Omit<Fns, typeof IS_CHAINABLE>]: Fns[K] extends (
    s: S,
    ...args: infer A
  ) => S
    ? (...args: A) => ChainableApi<Fns, S>
    : Fns[K] extends (s: S, ...args: infer A) => infer R
      ? (...args: A) => R
      : never;
};

/** A utility type that infers a simple, non-chainable API shape. Used by `makeLayered`. */
type BoundApi<S, F extends Methods<S>> = {
  [K in keyof F]: F[K] extends (subject: S, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;
};



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
  return function <Fs extends ((subject: S, ...args: any[]) => any)[]>(
    ...fns: Fs
  ): {
    [K in keyof Fs]: Fs[K] extends (subject: S, ...args: infer A) => infer R
      ? (...args: A) => R
      : never;
  } {
    if (!fns.every((fn) => typeof fn === "function")) {
      throw new Error("All elements provided to `_with` must be functions.");
    }
    return fns.map(
      (fn) =>
        (...args: any[]) =>
          fn(subject, ...args),
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
  if (
    fnsOrObj.length === 1 &&
    typeof fnsOrObj[0] === "object" &&
    !Array.isArray(fnsOrObj[0]) &&
    fnsOrObj[0] !== null
  ) {
    const functionsMap = fnsOrObj[0];
    for (const key in functionsMap) {
      if (typeof functionsMap[key] !== "function") {
        throw new Error(
          `Value for key "${key}" in object provided to \`make\` must be a function.`,
        );
      }
    }
    return functionsMap;
  }

  const functionsMap: Record<string, (...args: any[]) => any> = {};
  for (const fn of fnsOrObj) {
    if (typeof fn !== "function") {
      throw new Error("All arguments provided to `make` must be functions.");
    }
    if (!fn.name) {
      throw new Error(
        "Functions provided as an array to `make` must be named.",
      );
    }
    if (functionsMap[fn.name]) {
      throw new Error(
        `Duplicate function name "${fn.name}" found in \`make\`.`,
      );
    }
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
 */
export function rebind<Obj extends Methods>(obj: Obj): Obj;
export function rebind<Fs extends Array<(...args: any[]) => any>>(
  ...fns: Fs
): Record<string, Fs[number]>;
export function rebind(...fnsOrObj: any[]): Record<string, any> {
  const originalFunctions = make(...fnsOrObj);
  (originalFunctions as any)[IS_CHAINABLE] = true;
  return originalFunctions;
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
 */
export function makeWith<S extends object>(subject: S) {
  return function <Fns extends Methods<S>>(
    functionsMap: Fns,
  ): ChainableApi<Fns, S> {
    const finalApi: Record<string, any> = {};
    const isChainable = (functionsMap as any)[IS_CHAINABLE];

    for (const key in functionsMap) {
      if (key === IS_CHAINABLE.toString()) continue;

      const fn = functionsMap[key];
      if (typeof fn !== "function") {
        throw new Error(`Value for key "${key}" must be a function.`);
      }

      if (isChainable) {
        finalApi[key] = (...args: any[]) => {
          const newSubject = fn(subject, ...args);
          if (
            newSubject === undefined ||
            (typeof newSubject !== "object" && newSubject !== null)
          ) {
            console.warn(
              `Chainable function "${key}" did not return a new state object. Chaining may be broken.`,
            );
          }
          return makeWith(newSubject)(functionsMap);
        };
      } else {
        finalApi[key] = (...args: any[]) => fn(subject, ...args);
      }
    }
    return finalApi as ChainableApi<Fns, S>;
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
 * const createUser = (name: string) => ({ name, id: 1 });
 * const addPermissions = (user: { id: number }) => ({ permissions: ['read'] });
 *
 * const createFullUser = enrich(createUser, addPermissions);
 * const user = createFullUser('Alice'); // { name: 'Alice', id: 1, permissions: ['read'] }
 */
export function enrich<
  P extends (...args: any[]) => object,
  S extends (primaryResult: ReturnType<P>) => object,
>(
  primaryFactory: P,
  secondaryFactory: S,
): (...args: Parameters<P>) => ReturnType<P> & ReturnType<S> {
  return function (...args: Parameters<P>) {
    const primaryResult = primaryFactory(...args) as ReturnType<P>;
    const secondaryResult = secondaryFactory(primaryResult);
    return { ...primaryResult, ...secondaryResult } as ReturnType<P> &
      ReturnType<S>;
  };
}

/**
 * The internal, recursive type definition for the `makeLayered` builder function.
 */
type LayeredApiBuilder<CurrentApi extends object> = {
  (): CurrentApi;
  <EnhancerFns extends Methods<CurrentApi>>(
    enhancerFns: EnhancerFns,
  ): LayeredApiBuilder<CurrentApi & BoundApi<CurrentApi, EnhancerFns>>;
};

/**
 * Creates a complex, multi-layered API using a fluent, curried interface.
 * Each subsequent layer is "self-aware" and receives the instance from previous
 * layers as its context, enabling powerful orchestration and composition.
 *
 * The chain is terminated by calling the final returned function with no arguments.
 *
 * @template S The type of the initial state or configuration object.
 * @param subject The initial state object.
 * @returns A curried function that takes the base methods and begins the layering process.
 *
 * @example
 * const counter = makeLayered({ count: 1 })
 *   (makeChainable({ add: (s, n) => ({ ...s, count: s.count + n }) })) // Base
 *   ({ get: (s) => s.count }) // Getters
 *   ({ double: (self) => self.add(self.get()) }) // Enhancers
 *   (); // Finalize
 */
export function makeLayered<S extends object>(subject: S) {
  return function <BaseFns extends Methods<S>>(
    baseFns: BaseFns,
  ): LayeredApiBuilder<ChainableApi<BaseFns, S>> {
    const baseInstance = makeWith(subject)(baseFns);

    const createNextLayer = <CurrentApi extends object>(
      currentInstance: CurrentApi,
    ): LayeredApiBuilder<CurrentApi> => {
      return (enhancerFns?: Methods<CurrentApi>): any => {
        if (enhancerFns === undefined) {
          return currentInstance;
        }
        // Enhancers are bound as regular, non-chainable methods.
        const nextLayer = provideTo(currentInstance)(enhancerFns);
        const newInstance = { ...currentInstance, ...nextLayer };
        return createNextLayer(newInstance);
      };
    };
    return createNextLayer(baseInstance);
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// Aliases and Default Export
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/** Alias for `_with`. */
export const provide = _with;
/** Alias for `make`. */
export const collectFns = make;
/** Alias for `makeWith`. */
export const provideTo = makeWith;
/** Alias for `rebind`. */
export const makeChainable = rebind;

export default {
  with: _with,
  provide,
  make,
  collectFns,
  makeWith,
  provideTo,
  rebind,
  makeChainable,
  enrich,
  makeLayered,
};


// =============================================================================
// CORE UTILITY TYPES FOR @doeixd/make-with
// These would be exported from the main library to help users
// =============================================================================

// =============================================================================
// 1. STATE EXTRACTION UTILITIES
// =============================================================================

/**
 * Extracts the state/subject type from any Make With API
 * @example
 * const api = provideTo({ count: 0 })({ get: s => s.count });
 * type State = SubjectOf<typeof api>; // { count: number }
 */
export type SubjectOf<T> = T extends { getSubject(): infer S } ? S 
  : T extends (...args: any[]) => any ? never 
  : T extends Record<string, any> ? T[keyof T] extends (subject: infer S, ...args: any[]) => any ? S : never
  : never;

/**
 * Extracts the return type of a specific method from a Make With API
 * @example
 * type GetResult = MethodReturnType<typeof api, 'get'>; // number
 */
export type MethodReturnType<API, Method extends keyof API> = 
  API[Method] extends (...args: any[]) => infer R ? R : never;

/**
 * Extracts parameter types (excluding subject) from a method
 * @example
 * type AddParams = MethodParams<typeof api, 'add'>; // [amount: number]
 */
export type MethodParams<API, Method extends keyof API> = 
  API[Method] extends (subject: any, ...args: infer P) => any ? P : never;

// =============================================================================
// 2. METHOD CLASSIFICATION HELPERS
// =============================================================================

/**
 * Defines a method that updates state (for use with makeChainable)
 * @example
 * const updaters = {
 *   increment: ((s) => ({ count: s.count + 1 })) satisfies StateUpdater<CounterState>
 * };
 */
export type StateUpdater<S> = (state: S, ...args: any[]) => S;

/**
 * Defines a method that reads from state without changing it
 * @example
 * const getters = {
 *   getCount: ((s) => s.count) satisfies StateGetter<CounterState, number>
 * };
 */
export type StateGetter<S, R = any> = (state: S, ...args: any[]) => R;

/**
 * Defines a side-effect method that doesn't return new state
 * @example
 * const actions = {
 *   log: ((s) => console.log(s.count)) satisfies SideEffect<CounterState>
 * };
 */
export type SideEffect<S> = (state: S, ...args: any[]) => void | Promise<void>;

/**
 * Helper to ensure all methods in an object are state updaters
 * @example
 * const updates: Updaters<CounterState> = {
 *   increment: (s) => ({ count: s.count + 1 }),
 *   add: (s, amount: number) => ({ count: s.count + amount })
 * };
 */
export type Updaters<S> = Record<string, StateUpdater<S>>;

/**
 * Helper to ensure all methods in an object are getters
 * @example
 * const getters: Getters<CounterState> = {
 *   count: (s) => s.count,
 *   isMax: (s) => s.count >= 100
 * };
 */
export type Getters<S> = Record<string, StateGetter<S>>;

// =============================================================================
// 3. LAYER COMPOSITION HELPERS
// =============================================================================

/**
 * Type for a layer function in makeLayered that adds methods
 * @example
 * const enhancer: Layer<BaseAPI, { double: () => void }> = (self) => ({
 *   double: () => self.add(self.get())
 * });
 */
export type Layer<PrevAPI, NewMethods extends Record<string, any>> = 
  (self: PrevAPI) => NewMethods;

/**
 * Type for middleware that wraps existing methods
 * @example
 * const withLogging: Middleware<APIWithGet> = {
 *   get: async (self, ...args) => {
 *     console.log('Getting...');
 *     return self.get(...args);
 *   }
 * };
 */
export type Middleware<BaseAPI> = {
  [K in keyof BaseAPI]?: BaseAPI[K] extends (...args: any[]) => infer R
    ? (self: BaseAPI, ...args: Parameters<BaseAPI[K]>) => R
    : never;
};

/**
 * Creates a type-safe enhancer that adds new methods to an existing API
 * @example
 * const enhancer: Enhancer<BaseAPI, { newMethod: () => string }> = (self) => ({
 *   newMethod: () => "enhanced!"
 * });
 */
export type Enhancer<BaseAPI, NewMethods> = (self: BaseAPI) => NewMethods;

// =============================================================================
// 4. FACTORY FUNCTION HELPERS
// =============================================================================

/**
 * Type for factory functions that create Make With APIs
 * @example
 * const createCounter: Factory<{ initial: number }, CounterAPI> = 
 *   (config) => provideTo({ count: config.initial })({ ... });
 */
export type Factory<Config, API> = (config: Config) => API;

/**
 * Creates a factory with dependencies
 * @example
 * const createUserAPI: FactoryWithDeps<UserConfig, Database, UserAPI> = 
 *   (config, db) => provideTo({ db, ...config })({ ... });
 */
export type FactoryWithDeps<Config, Dependencies, API> = 
  (config: Config, deps: Dependencies) => API;

/**
 * Extracts the config type from a factory
 * @example
 * type Config = ConfigOf<typeof createCounter>; // { initial: number }
 */
export type ConfigOf<F> = F extends Factory<infer C, any> ? C 
  : F extends FactoryWithDeps<infer C, any, any> ? C 
  : never;

/**
 * Extracts the API type from a factory
 * @example
 * type API = APIOf<typeof createCounter>; // CounterAPI
 */
export type APIOf<F> = F extends Factory<any, infer A> ? A 
  : F extends FactoryWithDeps<any, any, infer A> ? A 
  : never;

// =============================================================================
// 5. CHAINABLE API HELPERS
// =============================================================================

/**
 * Marks methods as chainable (returns new API instance)
 * @example
 * const api = provideTo(state)({
 *   ...makeChainable({ 
 *     increment: ((s) => ({ count: s.count + 1 })) satisfies Chainable<State>
 *   })
 * });
 */
export type Chainable<S> = StateUpdater<S>;

/**
 * Type for methods that should NOT be chainable
 * @example
 * const methods = {
 *   get: ((s) => s.count) satisfies NonChainable<State, number>
 * };
 */
export type NonChainable<S, R = any> = StateGetter<S, R> | SideEffect<S>;

/**
 * Ensures a methods object only contains chainable methods
 * @example
 * const chainableMethods: OnlyChainable<State> = {
 *   increment: (s) => ({ count: s.count + 1 }),
 *   reset: (s) => ({ count: 0 })
 * };
 */
export type OnlyChainable<S> = Record<string, Chainable<S>>;

// =============================================================================
// 6. VALIDATION HELPERS
// =============================================================================

/**
 * Ensures a type is a valid Make With subject (plain object)
 * @example
 * type ValidState = ValidSubject<{ count: number }>; // ✅
 * type InvalidState = ValidSubject<string>; // ❌ never
 */
export type ValidSubject<T> = T extends object 
  ? T extends Function 
    ? never 
    : T 
  : never;

/**
 * Ensures methods are properly typed for Make With
 * @example
 * const methods: ValidMethods<State> = {
 *   get: (s) => s.count,
 *   add: (s, n: number) => ({ count: s.count + n })
 * };
 */
export type ValidMethods<S> = Record<string, (subject: S, ...args: any[]) => any>;

/**
 * Constraint to ensure immutable updates
 * @example
 * const updater: ImmutableUpdate<State> = (s) => ({ ...s, count: s.count + 1 });
 */
export type ImmutableUpdate<S> = (state: S, ...args: any[]) => S;

// =============================================================================
// 7. RUNTIME HELPERS
// =============================================================================

/**
 * Type guard for chainable methods
 * @example
 * if (isChainableMethod(method)) {
 *   // method is known to return new state
 * }
 */
export const isChainableMethod = <S>(method: any): method is StateUpdater<S> => {
  return typeof method === 'function' && method.__makeWith_chainable === true;
};

/**
 * Helper to mark a method as chainable at runtime
 * @example
 * const increment = markChainable((s: State) => ({ count: s.count + 1 }));
 */
export const markChainable = <S>(fn: StateUpdater<S>): StateUpdater<S> => {
  (fn as any).__makeWith_chainable = true;
  return fn;
};

// =============================================================================
// 8. RE-EXPORTS FOR CONVENIENCE
// =============================================================================

// Re-export the most commonly used types with shorter names
export type Update<S> = StateUpdater<S>;
export type Get<S, R = any> = StateGetter<S, R>;
export type Effect<S> = SideEffect<S>;
export type API<Config, Result> = Factory<Config, Result>;

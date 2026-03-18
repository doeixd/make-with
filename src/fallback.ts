/**
 * A value predicate used to decide whether a property value is considered
 * "present" on the subject / fallback chain.
 */
export type PresentPredicate = (value: unknown) => boolean;

/**
 * Converts a union such as `A | B | C` into `A & B & C`.
 */
type UnionToIntersection<U> = (
  U extends unknown ? (value: U) => void : never
) extends (value: infer I) => void
  ? I
  : never;

/**
 * The visible merged shape of a list of objects.
 *
 * Example:
 *   MergeVisible<[ { a: number }, { b: string } ]>
 * becomes:
 *   { a: number } & { b: string }
 */
type MergeVisible<T extends readonly object[]> = UnionToIntersection<T[number]>;

/**
 * Options for {@link fallback}.
 */
export interface FallbackOptions<Base = undefined> {
  /**
   * Determines whether a value counts as present.
   *
   * The default matches the original implementation and treats only truthy
   * values as present. In many codebases, a safer alternative is:
   *
   * ```ts
   * (value) => value !== undefined && value !== null
   * ```
   */
  isPresent?: PresentPredicate;

  /**
   * Value returned when no source in the chain provides a present value.
   */
  base?: Base;

  /**
   * Enables deep fallback behavior for nested objects and functions.
   *
   * When enabled, if the resolved value for a property is object-like, a nested
   * proxy is returned so fallback lookup continues recursively.
   *
   * Default: `true`
   */
  deep?: boolean;
}

/**
 * A cached proxy chain key.
 *
 * Proxy identity must be stable for the same exact source chain, not merely the
 * same primary object. Caching only by the primary object is incorrect because
 * the same object can participate in multiple different fallback chains.
 */
type SourceChain = readonly [object, ...object[]];

/**
 * Creates a proxy over `subject` that reads missing / non-present properties
 * from one or more fallback objects.
 *
 * ## Behavior
 *
 * Read order:
 * 1. Subject
 * 2. First fallback
 * 3. Second fallback
 * 4. ...
 * 5. `options.base` if nothing present is found
 *
 * Write behavior:
 * 1. If the subject already has the property, write to the subject.
 * 2. Otherwise, if a fallback already has the property, write to the first such fallback.
 * 3. Otherwise, define the property on the subject.
 *
 * ## Features
 *
 * - Deep recursive fallback lookup for nested objects
 * - Getter support via `Reflect.get(..., receiver)`
 * - Setter support via `Reflect.set(..., receiver)`
 * - Method calls preserve `this`
 * - Stable nested proxy identity via source-chain caching
 * - `in`, `Object.keys`, `Reflect.ownKeys`, and property descriptors behave sensibly
 * - No mutation of the provided `fallbacks` array
 *
 * ## Type inference
 *
 * The returned type is the visible merged shape:
 *
 * `Subject & Fallback1 & Fallback2 & ...`
 *
 * This is a strong top-level approximation of runtime behavior. Since this
 * utility is proxy-based and resolves properties dynamically, TypeScript cannot
 * perfectly model every deep runtime interaction.
 *
 * @example
 * ```ts
 * const user = { name: "Ada" };
 * const defaults = { role: "admin", active: true };
 *
 * const value = fallback(user, [defaults]);
 * //    ^? { name: string } & { role: string; active: boolean }
 *
 * value.name;   // "Ada"
 * value.role;   // "admin"
 * value.active; // true
 * ```
 *
 * @example
 * ```ts
 * const config = fallback(
 *   { api: { timeout: undefined } },
 *   [{ api: { timeout: 5000, retries: 3 } }],
 *   {
 *     isPresent: (v) => v !== undefined && v !== null,
 *   },
 * );
 *
 * config.api.timeout; // 5000
 * config.api.retries; // 3
 * ```
 *
 * @example
 * ```ts
 * class Defaults {
 *   #name = "guest";
 *
 *   get name() {
 *     return this.#name.toUpperCase();
 *   }
 *
 *   set name(value: string) {
 *     this.#name = value.trim();
 *   }
 * }
 *
 * const value = fallback({ age: 20 }, [new Defaults()], {
 *   isPresent: (v) => v !== undefined && v !== null,
 * });
 *
 * value.name;      // "GUEST"
 * value.name = "  ada  ";
 * value.name;      // "ADA"
 * value.age = 21;
 * ```
 */
export function fallback<
  Subject extends object,
  const Fallbacks extends readonly object[],
  Base = undefined,
>(
  subject: Subject,
  fallbacks?: Fallbacks,
  options?: FallbackOptions<Base>,
): Subject & MergeVisible<[Subject, ...Fallbacks]>;
export function fallback<
  Subject extends object,
  const Fallbacks extends readonly object[],
  Base = undefined,
>(
  subject: Subject,
  fallbacks: Fallbacks = [] as unknown as Fallbacks,
  options: FallbackOptions<Base> = {},
): Subject & MergeVisible<[Subject, ...Fallbacks]> {
  const isPresent: PresentPredicate =
    options.isPresent ?? ((value) => Boolean(value));
  const base = options.base as Base;
  const deep = options.deep ?? true;

  /**
   * Returns `true` for non-null objects and functions.
   *
   * Functions are included intentionally so methods / callable objects can
   * participate in deep fallback behavior when relevant.
   */
  const isObjectLike = (value: unknown): value is object =>
    (typeof value === "object" && value !== null) ||
    typeof value === "function";

  /**
   * Weakly caches source-chain nodes.
   *
   * This forms a tree:
   *   source0 -> source1 -> source2 -> ... -> proxy
   *
   * That makes cache hits exact for the whole chain while still allowing
   * garbage collection.
   */
  interface CacheNode {
    next: WeakMap<object, CacheNode>;
    proxy?: object;
  }

  const rootCache: CacheNode = {
    next: new WeakMap<object, CacheNode>(),
  };

  /**
   * Returns the cache node corresponding to the exact source chain, creating it
   * if necessary.
   */
  const getCacheNode = (sources: SourceChain): CacheNode => {
    let node = rootCache;

    for (const source of sources) {
      let next = node.next.get(source);
      if (!next) {
        next = { next: new WeakMap<object, CacheNode>() };
        node.next.set(source, next);
      }
      node = next;
    }

    return node;
  };

  /**
   * Resolves the first present value for a property across the given sources.
   *
   * `receiver` is forwarded so native getter semantics are preserved.
   */
  const resolveValue = (
    key: PropertyKey,
    sources: readonly object[],
    receiver: unknown,
  ): unknown => {
    for (let index = 0; index < sources.length; index += 1) {
      const value = Reflect.get(sources[index], key, receiver);
      if (isPresent(value)) return value;
    }

    return base;
  };

  /**
   * Collects nested object-like values for a property across the source chain.
   *
   * This powers deep fallback behavior. Unlike `resolveValue`, this does not
   * stop at the first present value because nested fallback chains must be built
   * from all object-like candidates in order.
   */
  const resolveNestedSources = (
    key: PropertyKey,
    sources: readonly object[],
    receiver: unknown,
  ): object[] => {
    const nested: object[] = [];

    for (let index = 0; index < sources.length; index += 1) {
      const value = Reflect.get(sources[index], key, receiver);
      if (isObjectLike(value)) nested.push(value);
    }

    return nested;
  };

  /**
   * Chooses the write target for a property.
   *
   * We use `hasOwnProperty` here rather than `Reflect.has` so inherited
   * prototype properties do not divert writes away from the subject.
   */
  const resolveWriteTarget = (
    key: PropertyKey,
    sources: readonly [object, ...object[]],
  ): object => {
    const hasOwn = Object.prototype.hasOwnProperty;

    if (hasOwn.call(sources[0], key)) return sources[0];

    for (let index = 1; index < sources.length; index += 1) {
      if (hasOwn.call(sources[index], key)) return sources[index];
    }

    return sources[0];
  };

  /**
   * Builds a proxied object for an exact source chain.
   */
  const createProxy = <T extends object>(
    sources: readonly [T, ...object[]],
  ): T => {
    const cacheNode = getCacheNode(sources);

    if (cacheNode.proxy) {
      return cacheNode.proxy as T;
    }

    const primary = sources[0];

    const proxy = new Proxy(primary, {
      /**
       * Resolves properties from the source chain.
       *
       * If `deep` is enabled and the resolved property is object-like, a nested
       * fallback proxy is returned.
       */
      get(_target, key, receiver) {
        const value = resolveValue(key, sources, receiver);

        if (!deep || !isObjectLike(value)) {
          return typeof value === "function" ? value.bind(receiver) : value;
        }

        const nestedSources = resolveNestedSources(key, sources, receiver);

        if (nestedSources.length === 0) {
          return value;
        }

        const [nestedPrimary, ...nestedFallbacks] = nestedSources;
        return createProxy([nestedPrimary, ...nestedFallbacks]);
      },

      /**
       * Writes to the most sensible source in the chain.
       */
      set(_target, key, value, receiver) {
        const writeTarget = resolveWriteTarget(key, sources);
        return Reflect.set(writeTarget, key, value, receiver);
      },

      /**
       * Makes the `in` operator reflect the merged visible shape.
       *
       * This intentionally checks existence rather than "present-ness", which is
       * the standard meaning of `in`.
       */
      has(_target, key) {
        for (let index = 0; index < sources.length; index += 1) {
          if (Reflect.has(sources[index], key)) return true;
        }
        return false;
      },

      /**
       * Returns the merged own-key set for the source chain.
       *
       * Proxy `ownKeys` must return only `string | symbol`.
       */
      ownKeys(): Array<string | symbol> {
        const seen = new Set<string | symbol>();

        for (let index = 0; index < sources.length; index += 1) {
          for (const key of Reflect.ownKeys(sources[index])) {
            seen.add(key);
          }
        }

        return [...seen];
      },

      /**
       * Returns the first own property descriptor found in the chain.
       *
       * We force `configurable: true` to satisfy proxy invariants safely for the
       * synthesized merged view.
       *
       * If no descriptor exists anywhere and `base !== undefined`, we expose a
       * synthetic data descriptor so reflective access has something meaningful
       * to work with.
       */
      getOwnPropertyDescriptor(_target, key) {
        for (let index = 0; index < sources.length; index += 1) {
          const descriptor = Reflect.getOwnPropertyDescriptor(
            sources[index],
            key,
          );
          if (descriptor) {
            return {
              ...descriptor,
              configurable: true,
            };
          }
        }

        if (base !== undefined) {
          return {
            configurable: true,
            enumerable: true,
            writable: true,
            value: base,
          };
        }

        return undefined;
      },

      /**
       * Defines properties on the subject.
       */
      defineProperty(_target, key, attributes) {
        return Reflect.defineProperty(sources[0], key, attributes);
      },

      /**
       * Deletes only from the subject.
       *
       * Fallbacks remain immutable from the merged-view perspective unless the
       * caller writes to them explicitly through resolution rules.
       */
      deleteProperty(_target, key) {
        return Reflect.deleteProperty(sources[0], key);
      },

      /**
       * Prevents accidental prototype mutation of the merged virtual object.
       *
       * The subject's prototype is surfaced as the proxy's prototype.
       */
      getPrototypeOf(_target) {
        return Reflect.getPrototypeOf(sources[0]);
      },

      /**
       * Prototype writes affect only the subject.
       */
      setPrototypeOf(_target, prototype) {
        return Reflect.setPrototypeOf(sources[0], prototype);
      },

      /**
       * Extensibility checks are delegated to the subject.
       */
      isExtensible(_target) {
        return Reflect.isExtensible(sources[0]);
      },

      /**
       * Preventing extensions applies only to the subject.
       */
      preventExtensions(_target) {
        return Reflect.preventExtensions(sources[0]);
      },
    });

    cacheNode.proxy = proxy;
    return proxy as T;
  };

  return createProxy([subject, ...fallbacks]) as Subject &
    MergeVisible<[Subject, ...Fallbacks]>;
}

/**
 * Creates a deep, static snapshot from a value returned by {@link fallback}.
 *
 * The result is a plain object / array graph with all readable values resolved
 * eagerly at snapshot time. No proxies are retained in the returned structure.
 *
 * ## Behavior
 *
 * - Deeply walks enumerable own keys via `Reflect.ownKeys`
 * - Resolves getters once, at snapshot time
 * - Copies arrays as arrays
 * - Preserves repeated references and cycles
 * - Leaves non-plain built-ins as-is by default:
 *   - `Date`
 *   - `RegExp`
 *   - `Map`
 *   - `Set`
 *   - typed arrays
 *   - functions
 *
 * That default is usually the safest choice for a "static materialized view"
 * of a proxied fallback object. If you want cloning behavior for `Map` / `Set`
 * / `Date`, that can be added too.
 *
 * @example
 * ```ts
 * const value = fallback(
 *   { user: { name: undefined } },
 *   [{ user: { name: "Ada", role: "admin" } }],
 *   { isPresent: (v) => v !== undefined && v !== null },
 * );
 *
 * const snap = snapshot(value);
 * // {
 * //   user: {
 * //     name: "Ada",
 * //     role: "admin"
 * //   }
 * // }
 * ```
 */
export function snapshot<T>(value: T): Snapshot<T> {
  const seen = new WeakMap<object, unknown>();

  return snapshotValue(value, seen) as Snapshot<T>;
}

/**
 * Deep snapshot result type.
 *
 * Notes:
 * - functions are preserved as-is
 * - arrays are recursively snapshotted
 * - object properties are recursively snapshotted
 *
 * This is a practical type-level approximation of the runtime result.
 */
export type Snapshot<T> = T extends (...args: any[]) => any
  ? T
  : T extends readonly (infer U)[]
    ? Snapshot<U>[]
    : T extends object
      ? { [K in keyof T]: Snapshot<T[K]> }
      : T;

function snapshotValue<T>(
  value: T,
  seen: WeakMap<object, unknown>,
): Snapshot<T> {
  if (value === null || typeof value !== "object") {
    return value as Snapshot<T>;
  }

  if (typeof value === "function") {
    return value as Snapshot<T>;
  }

  if (
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set ||
    ArrayBuffer.isView(value) ||
    value instanceof ArrayBuffer
  ) {
    return value as Snapshot<T>;
  }

  const existing = seen.get(value as object);
  if (existing) {
    return existing as Snapshot<T>;
  }

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);

    for (let i = 0; i < value.length; i += 1) {
      out[i] = snapshotValue(value[i], seen);
    }

    return out as Snapshot<T>;
  }

  const proto = Object.getPrototypeOf(value);
  const isPlainObject = proto === Object.prototype || proto === null;

  /**
   * For non-plain objects, we still materialize enumerable own properties into a
   * plain object. That gives a stable static view of class instances / proxied
   * nested objects without preserving prototype behavior.
   */
  const out: Record<string | symbol, unknown> = {};
  seen.set(value as object, out);

  for (const key of Reflect.ownKeys(value as object)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value as object, key);
    if (!descriptor?.enumerable) continue;

    out[key] = snapshotValue(Reflect.get(value as object, key), seen);
  }

  if (isPlainObject) {
    return out as Snapshot<T>;
  }

  return out as Snapshot<T>;
}

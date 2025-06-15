/**
 * 🧰 Make With - Complete Playground Examples
 *
 * This file demonstrates every feature of the library, starting from the simplest
 * primitives and building up to advanced patterns. Run these examples to see how
 * each piece works!
 */

import {
  provide,
  _with, // Primitive: partial application
  make,
  collectFns, // Primitive: function collection
  provideTo,
  makeWith, // Core: create APIs
  makeChainable,
  rebind, // Core: enable chaining
  makeLayered, // Advanced: layered composition
  enrich, // Advanced: factory composition
} from "./src/index";

console.log("🚀 Make With Playground - Let's explore!\n");

// ============================================================================
// 1. PRIMITIVES - The Building Blocks
// ============================================================================

console.log("=== 1. PRIMITIVES ===\n");

// ----------------------------------------------------------------------------
// 1.1 provide (_with) - Partial Application
// ----------------------------------------------------------------------------
console.log("1.1 provide - Baking in context:");

const config = { apiKey: "secret-123", baseUrl: "https://api.example.com" };

// Without provide - repetitive
function fetchUser(config: any, id: string) {
  return `Fetching user ${id} from ${config.baseUrl}`;
}
function fetchPosts(config: any, userId: string) {
  return `Fetching posts for ${userId} from ${config.baseUrl}`;
}

// With provide - clean!
const [getUser, getPosts] = provide(config)(
  (cfg, id: string) => `Fetching user ${id} from ${cfg.baseUrl}`,
  (cfg, userId: string) => `Fetching posts for ${userId} from ${cfg.baseUrl}`,
);

console.log(getUser("123")); // No need to pass config!
console.log(getPosts("123"));
console.log("");

// ----------------------------------------------------------------------------
// 1.2 make (collectFns) - Organizing Functions
// ----------------------------------------------------------------------------
console.log("1.2 make - Creating function maps:");

// From named functions
function add(a: number, b: number) {
  return a + b;
}
function multiply(a: number, b: number) {
  return a * b;
}

const mathOps1 = make(add, multiply);
console.log("From functions:", mathOps1); // { add: [Function], multiply: [Function] }

// From object (more common)
const mathOps2 = make({
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => a / b,
});
console.log("From object:", Object.keys(mathOps2));
console.log("");

// ============================================================================
// 2. CORE UTILITIES - Building Real APIs
// ============================================================================

console.log("=== 2. CORE UTILITIES ===\n");

// ----------------------------------------------------------------------------
// 2.1 provideTo (makeWith) - Creating Basic APIs
// ----------------------------------------------------------------------------
console.log("2.1 provideTo - Your first API:");

// A simple calculator API
const calculator = provideTo({ value: 0 })({
  getValue: (state) => state.value,
  setValue: (state, newValue: number) => {
    console.log(`Setting value to ${newValue}`);
    state.value = newValue; // Direct mutation is fine here
  },
  add: (state, amount: number) => state.value + amount,
  multiply: (state, factor: number) => state.value * factor,
});

console.log("Initial value:", calculator.getValue());
calculator.setValue(10);
console.log("After setValue(10):", calculator.getValue());
console.log("add(5) returns:", calculator.add(5)); // Returns 15, doesn't mutate
console.log("Current value still:", calculator.getValue()); // Still 10!
console.log("");

// ----------------------------------------------------------------------------
// 2.2 makeChainable (rebind) - Immutable Chaining
// ----------------------------------------------------------------------------
console.log("2.2 makeChainable - Building chainable APIs:");

// An immutable counter
const counter = provideTo({ count: 0 })({
  // Chainable methods that return new state
  ...makeChainable({
    increment: (s) => ({ count: s.count + 1 }),
    decrement: (s) => ({ count: s.count - 1 }),
    add: (s, amount: number) => ({ count: s.count + amount }),
    reset: () => ({ count: 0 }),
  }),
  // Regular methods
  get: (s) => s.count,
  isPositive: (s) => s.count > 0,
});

console.log("Starting count:", counter.get());

// Beautiful chaining!
const result = counter.increment().increment().add(5).decrement();

console.log("After chain:", result.get()); // 6
console.log("Original unchanged:", counter.get()); // 0
console.log("Is result positive?", result.isPositive()); // true
console.log("");

// ============================================================================
// 3. REAL-WORLD PATTERNS
// ============================================================================

console.log("=== 3. REAL-WORLD PATTERNS ===\n");

// ----------------------------------------------------------------------------
// 3.1 API Client Pattern
// ----------------------------------------------------------------------------
console.log("3.1 API Client with configuration:");

interface ApiConfig {
  baseUrl: string;
  token: string;
  retries: number;
}

const createApiClient = (config: ApiConfig) =>
  provideTo(config)({
    get: async (cfg, path: string) => {
      console.log(
        `GET ${cfg.baseUrl}${path} (with token: ${cfg.token.slice(0, 5)}...)`,
      );
      // Simulated response
      return { data: `Response from ${path}` };
    },
    post: async (cfg, path: string, data: any) => {
      console.log(`POST ${cfg.baseUrl}${path}`, data);
      return { data: "Created", id: 123 };
    },
    withToken: (cfg, newToken: string) =>
      createApiClient({ ...cfg, token: newToken }),
  });

const api = createApiClient({
  baseUrl: "https://api.app.com",
  token: "original-token-123",
  retries: 3,
});

await api.get("/users");
await api.post("/users", { name: "Alice" });

// Create new client with different token
const apiWithNewToken = api.withToken("new-token-456");
await apiWithNewToken.get("/profile");
console.log("");

// ----------------------------------------------------------------------------
// 3.2 Mutable State Pattern (Like React's useState)
// ----------------------------------------------------------------------------
console.log("3.2 Mutable state pattern:");

// Simple mutable state
const createState = <T>(initial: T) => {
  const state = { value: initial };
  const [get, set] = provide(state)(
    (s) => s.value,
    (s, newValue: T) => {
      s.value = newValue;
    },
  );
  return { get, set };
};

const name = createState("Alice");
console.log("Initial name:", name.get());
name.set("Bob");
console.log("After set:", name.get());

// More complex mutable store
const createStore = <T extends object>(initial: T) =>
  provideTo({ ...initial })({
    get: (s) => s,
    set: (s, updates: Partial<T>) => Object.assign(s, updates),
    reset: (s) => Object.assign(s, initial),
  });

const userStore = createStore({
  name: "Guest",
  isLoggedIn: false,
  preferences: { theme: "light" },
});

console.log("Initial store:", userStore.get());
userStore.set({ name: "Alice", isLoggedIn: true });
console.log("After login:", userStore.get());
console.log("");

// ----------------------------------------------------------------------------
// 3.3 Builder Pattern
// ----------------------------------------------------------------------------
console.log("3.3 Builder pattern for complex objects:");

interface QueryConfig {
  table: string;
  conditions: string[];
  orderBy?: string;
  limit?: number;
}

const queryBuilder = provideTo<QueryConfig>({
  table: "",
  conditions: [],
})({
  ...makeChainable({
    from: (s, table: string) => ({ ...s, table }),
    where: (s, condition: string) => ({
      ...s,
      conditions: [...s.conditions, condition],
    }),
    orderBy: (s, field: string) => ({ ...s, orderBy: field }),
    limit: (s, n: number) => ({ ...s, limit: n }),
  }),
  build: (s) => {
    let query = `SELECT * FROM ${s.table}`;
    if (s.conditions.length > 0) {
      query += ` WHERE ${s.conditions.join(" AND ")}`;
    }
    if (s.orderBy) query += ` ORDER BY ${s.orderBy}`;
    if (s.limit) query += ` LIMIT ${s.limit}`;
    return query;
  },
});

const query = queryBuilder
  .from("users")
  .where("age > 18")
  .where('status = "active"')
  .orderBy("created_at DESC")
  .limit(10)
  .build();

console.log("Built query:", query);
console.log("");

// ============================================================================
// 4. ADVANCED PATTERNS - makeLayered
// ============================================================================

console.log("=== 4. ADVANCED PATTERNS ===\n");

// ----------------------------------------------------------------------------
// 4.1 Basic Layers - Methods Calling Methods
// ----------------------------------------------------------------------------
console.log("4.1 Layered API with orchestration:");

const calculator2 = makeLayered({ value: 10 })(
  // Base layer - chainable state updates
  makeChainable({
    add: (s, n: number) => ({ value: s.value + n }),
    multiply: (s, n: number) => ({ value: s.value * n }),
    set: (s, n: number) => ({ value: n }),
  }),
)(
  // Getter layer
  {
    get: (s) => s.value,
    isPositive: (s) => s.value > 0,
  },
)(
  // Orchestration layer - methods use 'self' to call other methods
  {
    double: (self) => self.multiply(2),
    addTwice: (self, n: number) => self.add(n).add(n),
    incrementUntilPositive: (self) => {
      let current = self;
      while (!current.isPositive()) {
        current = current.add(1);
      }
      return current;
    },
  },
)(); // Terminate!

console.log("Starting value:", calculator2.get());
console.log("After double():", calculator2.double().get());
console.log("After addTwice(3):", calculator2.addTwice(3).get());

const negative = calculator2.set(-5);
console.log("Set to -5:", negative.get());
console.log(
  "After incrementUntilPositive:",
  negative.incrementUntilPositive().get(),
);
console.log("");

// ----------------------------------------------------------------------------
// 4.2 Conditional Layers - Building Dynamic APIs
// ----------------------------------------------------------------------------
console.log("4.2 Dynamic API based on user role:");

interface User {
  name: string;
  role: "admin" | "user" | "guest";
}

const createUserApi = (user: User) => {
  // Start with base functionality
  let builder = makeLayered({ user, logs: [] as string[] })(
    // Base methods everyone gets
    {
      getProfile: (s) => s.user,
      log: (s, message: string) => {
        s.logs.push(`[${s.user.name}] ${message}`);
        console.log(`Log: ${message}`);
      },
      getLogs: (s) => s.logs,
    },
  );

  // Add user-specific methods
  if (user.role === "user" || user.role === "admin") {
    builder = builder({
      updateProfile: (self, updates: Partial<User>) => {
        self.log(`Updating profile: ${JSON.stringify(updates)}`);
        Object.assign(self.getProfile(), updates);
        return self;
      },
    });
  }

  // Add admin-only methods
  if (user.role === "admin") {
    builder = builder({
      deleteUser: (self, username: string) => {
        self.log(`ADMIN: Deleted user ${username}`);
        return self;
      },
      viewAllLogs: (self) => {
        self.log("ADMIN: Viewing all system logs");
        return ["System log 1", "System log 2", ...self.getLogs()];
      },
    });
  }

  return builder();
};

// Different APIs based on role
const guestApi = createUserApi({ name: "Guest", role: "guest" });
const userApi = createUserApi({ name: "Alice", role: "user" });
const adminApi = createUserApi({ name: "Admin", role: "admin" });

console.log("Guest can:", Object.keys(guestApi));
console.log("User can:", Object.keys(userApi));
console.log("Admin can:", Object.keys(adminApi));

// Use the APIs
adminApi.deleteUser("suspicious-user");
console.log("Admin logs:", adminApi.getLogs());
console.log("");

// ----------------------------------------------------------------------------
// 4.2.1 Advanced Conditional APIs - Feature Flags & Capabilities
// ----------------------------------------------------------------------------
console.log("4.2.1 Advanced conditional APIs:");

// Feature-based API construction
interface Features {
  analytics?: boolean;
  advancedSearch?: boolean;
  bulkOperations?: boolean;
  experimental?: boolean;
}

const createFeatureApi = (features: Features = {}) => {
  // Always start with core
  let api = provideTo({ data: [] as any[], features })({
    add: (s, item: any) => {
      s.data.push(item);
    },
    get: (s) => s.data,
    clear: (s) => {
      s.data = [];
    },
  });

  // Conditionally add analytics
  if (features.analytics) {
    api = Object.assign(
      api,
      provideTo({ calls: 0 })({
        trackCall: (s) => {
          s.calls++;
        },
        getAnalytics: (s) => ({ totalCalls: s.calls }),
      }),
    );
  }

  // Conditionally add advanced search
  if (features.advancedSearch) {
    api = Object.assign(api, {
      search: (query: string) => {
        console.log(`Advanced search: ${query}`);
        return api
          .get()
          .filter((item: any) => JSON.stringify(item).includes(query));
      },
      searchRegex: (pattern: RegExp) => {
        return api
          .get()
          .filter((item: any) => pattern.test(JSON.stringify(item)));
      },
    });
  }

  // Conditionally add bulk operations
  if (features.bulkOperations) {
    api = Object.assign(api, {
      addMany: (items: any[]) => items.forEach((item) => api.add(item)),
      deleteWhere: (predicate: (item: any) => boolean) => {
        const filtered = api.get().filter((item: any) => !predicate(item));
        api.clear();
        filtered.forEach((item: any) => api.add(item));
      },
    });
  }

  return api;
};

// Create different feature sets
const basicApi = createFeatureApi();
const analyticsApi = createFeatureApi({ analytics: true });
const fullApi = createFeatureApi({
  analytics: true,
  advancedSearch: true,
  bulkOperations: true,
});

console.log("Basic API has:", Object.keys(basicApi));
console.log("Analytics API has:", Object.keys(analyticsApi));
console.log("Full API has:", Object.keys(fullApi));

// Use the APIs with type safety
fullApi.addMany([{ name: "Alice" }, { name: "Bob" }]);
console.log("Search results:", fullApi.search("Alice"));
console.log("");

// ----------------------------------------------------------------------------
// 4.3 Plugin System with Layers
// ----------------------------------------------------------------------------
console.log("4.3 Plugin system:");

// Plugin interface
type Plugin<T> = (self: T) => any;

// Core functionality
const createApp = () => {
  const app = makeLayered({ plugins: [] as string[] })(
    // Core methods
    {
      getName: () => "MyApp",
      getPlugins: (s) => s.plugins,
      log: (s, msg: string) => console.log(`[App] ${msg}`),
    },
  );

  // Plugin: Analytics
  const analyticsPlugin: Plugin<any> = {
    track: (self, event: string) => {
      self.log(`Analytics: ${event}`);
      return self;
    },
  };

  // Plugin: Auth
  const authPlugin: Plugin<any> = {
    login: (self, username: string) => {
      self.log(`User ${username} logged in`);
      self.track?.(`login:${username}`); // Use analytics if available
      return self;
    },
    logout: (self) => {
      self.log("User logged out");
      self.track?.("logout");
      return self;
    },
  };

  // Apply plugins
  return app(analyticsPlugin)(authPlugin)();
};

const app = createApp();
app.login("alice");
app.logout();
console.log("");

// ============================================================================
// 5. ADVANCED UTILITIES
// ============================================================================

console.log("=== 5. ADVANCED UTILITIES ===\n");

// ----------------------------------------------------------------------------
// 5.1 enrich - Composing Factory Functions
// ----------------------------------------------------------------------------
console.log("5.1 enrich - Building objects in stages:");

// Stage 1: Create base entity
const createProduct = (name: string, price: number) => ({
  id: Math.random().toString(36).substr(2, 9),
  name,
  price,
  createdAt: new Date(),
});

// Stage 2: Add computed properties based on stage 1
const addPricing = (product: ReturnType<typeof createProduct>) => ({
  priceWithTax: product.price * 1.2,
  discount: product.price > 100 ? 0.1 : 0,
  finalPrice: product.price * (1 - (product.price > 100 ? 0.1 : 0)),
});

// Stage 3: Add methods that use previous stages
const addMethods = (
  product: ReturnType<typeof createProduct> & ReturnType<typeof addPricing>,
) => ({
  display: () => `${product.name} - $${product.finalPrice.toFixed(2)}`,
  applyDiscount: (percent: number) => ({
    ...product,
    finalPrice: product.price * (1 - percent),
  }),
});

// Compose them all together
const createFullProduct = enrich(enrich(createProduct, addPricing), addMethods);

const laptop = createFullProduct("Laptop", 1200);
console.log("Product:", laptop.display());
console.log("Price with tax:", laptop.priceWithTax);
console.log("Discount:", laptop.discount);
console.log("");

// ----------------------------------------------------------------------------
// 5.2 Complex State Machine
// ----------------------------------------------------------------------------
console.log("5.2 State machine pattern:");

type State = "idle" | "loading" | "success" | "error";

interface StateMachine {
  state: State;
  data?: any;
  error?: string;
}

const createStateMachine = () =>
  provideTo<StateMachine>({ state: "idle" })({
    ...makeChainable({
      start: (s) => ({ ...s, state: "loading" as State }),
      succeed: (s, data: any) => ({
        state: "success" as State,
        data,
        error: undefined,
      }),
      fail: (s, error: string) => ({
        state: "error" as State,
        error,
        data: undefined,
      }),
      reset: () => ({ state: "idle" as State }),
    }),
    // Getters
    getState: (s) => s.state,
    getData: (s) => s.data,
    getError: (s) => s.error,
    isLoading: (s) => s.state === "loading",
    isSuccess: (s) => s.state === "success",
    isError: (s) => s.state === "error",
  });

const machine = createStateMachine();
console.log("Initial state:", machine.getState());

const loadingMachine = machine.start();
console.log("After start:", loadingMachine.getState());
console.log("Is loading?", loadingMachine.isLoading());

const successMachine = loadingMachine.succeed({ users: ["Alice", "Bob"] });
console.log("After succeed:", successMachine.getState());
console.log("Data:", successMachine.getData());
console.log("");

// ----------------------------------------------------------------------------
// 5.3 Performance: Mutable Builder Pattern
// ----------------------------------------------------------------------------
console.log("5.3 High-performance mutable builder:");

interface StringBuilder {
  parts: string[];
}

const createStringBuilder = () =>
  makeLayered<StringBuilder>({ parts: [] })(
    // Base methods that expose raw state
    {
      getRawState: (s) => s,
      toString: (s) => s.parts.join(""),
    },
  )(
    // Mutable methods that return self for chaining
    {
      append: (self, str: string) => {
        self.getRawState().parts.push(str);
        return self; // Return self, not new instance
      },
      appendLine: (self, str: string) => {
        self.getRawState().parts.push(str + "\n");
        return self;
      },
      clear: (self) => {
        self.getRawState().parts = [];
        return self;
      },
    },
  )();

const sb = createStringBuilder();
const result = sb
  .append("Hello")
  .append(" ")
  .append("World")
  .appendLine("!")
  .append("How are you?")
  .toString();

console.log("Built string:", JSON.stringify(result));
console.log("");

// ============================================================================
// 6. ADVANCED COMPOSITION PATTERNS
// ============================================================================

console.log("=== 6. ADVANCED COMPOSITION ===\n");

// ----------------------------------------------------------------------------
// 6.1 Custom Helpers - Building Your Own Utilities
// ----------------------------------------------------------------------------
console.log("6.1 Creating custom helpers:");

// Helper 1: asImmutable - Ensures all methods return new instances
function asImmutable<S extends object>(methods: Methods<S>): Methods<S> {
  const immutableMethods: Methods<S> = {};

  for (const [key, fn] of Object.entries(methods)) {
    immutableMethods[key] = (state: S, ...args: any[]) => {
      // Clone the state before passing to the function
      const clonedState = JSON.parse(JSON.stringify(state));
      const result = fn(clonedState, ...args);

      // If the function returns the state, ensure it's a new object
      if (result === clonedState) {
        return { ...result };
      }
      return result;
    };
  }

  return immutableMethods;
}

// Helper 2: withValidation - Adds validation to methods
function withValidation<S extends object>(
  methods: Methods<S>,
  validators: Partial<
    Record<keyof typeof methods, (state: S, ...args: any[]) => void>
  >,
): Methods<S> {
  const validatedMethods: Methods<S> = {};

  for (const [key, fn] of Object.entries(methods)) {
    validatedMethods[key] = (state: S, ...args: any[]) => {
      // Run validator if exists
      const validator = validators[key as keyof typeof validators];
      if (validator) {
        validator(state, ...args);
      }
      return fn(state, ...args);
    };
  }

  return validatedMethods;
}

// Helper 3: withLogging - Logs all method calls
function withLogging<S extends object>(
  methods: Methods<S>,
  logPrefix = "[LOG]",
): Methods<S> {
  const loggedMethods: Methods<S> = {};

  for (const [key, fn] of Object.entries(methods)) {
    loggedMethods[key] = (state: S, ...args: any[]) => {
      console.log(`${logPrefix} Calling ${key} with args:`, args);
      const result = fn(state, ...args);
      console.log(`${logPrefix} ${key} returned:`, result);
      return result;
    };
  }

  return loggedMethods;
}

// Using the helpers together
const bankAccount = provideTo({ balance: 1000, transactions: [] as string[] })({
  ...withLogging(
    withValidation(
      asImmutable({
        deposit: (s, amount: number) => {
          s.balance += amount;
          s.transactions.push(`+${amount}`);
          return s;
        },
        withdraw: (s, amount: number) => {
          s.balance -= amount;
          s.transactions.push(`-${amount}`);
          return s;
        },
      }),
      {
        deposit: (s, amount) => {
          if (amount <= 0) throw new Error("Deposit must be positive");
          if (amount > 10000) throw new Error("Deposit too large");
        },
        withdraw: (s, amount) => {
          if (amount <= 0) throw new Error("Withdrawal must be positive");
          if (amount > s.balance) throw new Error("Insufficient funds");
        },
      },
    ),
    "[BANK]",
  ),
  getBalance: (s) => s.balance,
  getTransactions: (s) => s.transactions,
});

console.log("Initial balance:", bankAccount.getBalance());
try {
  bankAccount.deposit(500);
  bankAccount.withdraw(200);
  bankAccount.withdraw(2000); // Will throw
} catch (e) {
  console.log("Error:", e.message);
}
console.log("");

// Helper 4: makeAsync - Converts sync methods to async
function makeAsync<S extends object>(methods: Methods<S>): Methods<S> {
  const asyncMethods: Methods<S> = {};

  for (const [key, fn] of Object.entries(methods)) {
    asyncMethods[key] = async (state: S, ...args: any[]) => {
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      return fn(state, ...args);
    };
  }

  return asyncMethods;
}

// Helper 5: makeCached - Adds memoization
function makeCached<S extends object>(
  methods: Methods<S>,
  getCacheKey?: (methodName: string, state: S, args: any[]) => string,
): Methods<S> {
  const cache = new Map<string, any>();
  const cachedMethods: Methods<S> = {};

  for (const [key, fn] of Object.entries(methods)) {
    cachedMethods[key] = (state: S, ...args: any[]) => {
      const cacheKey = getCacheKey
        ? getCacheKey(key, state, args)
        : `${key}:${JSON.stringify(args)}`;

      if (cache.has(cacheKey)) {
        console.log(`[CACHE HIT] ${key}`);
        return cache.get(cacheKey);
      }

      console.log(`[CACHE MISS] ${key}`);
      const result = fn(state, ...args);
      cache.set(cacheKey, result);
      return result;
    };
  }

  return cachedMethods;
}

// Example using makeCached
const calculator3 = provideTo({ memory: 0 })({
  ...makeCached({
    fibonacci: (s, n: number): number => {
      if (n <= 1) return n;
      // This would normally be slow, but caching helps!
      return calculator3.fibonacci(n - 1) + calculator3.fibonacci(n - 2);
    },
    factorial: (s, n: number): number => {
      if (n <= 1) return 1;
      return n * calculator3.factorial(n - 1);
    },
  }),
});

console.log("Fibonacci(10):", calculator3.fibonacci(10));
console.log("Fibonacci(10) again:", calculator3.fibonacci(10)); // Cache hit!
console.log("");

// ----------------------------------------------------------------------------
// 6.2 Middleware/Interceptor Pattern
// ----------------------------------------------------------------------------
console.log("6.1 Middleware pattern:");

type Middleware<T> = (next: T) => T;

const withLogging: Middleware<any> = (next) => ({
  ...next,
  request: async (...args: any[]) => {
    console.log("[LOG] Request started:", args[0]);
    const result = await next.request(...args);
    console.log("[LOG] Request completed");
    return result;
  },
});

const withRetry: Middleware<any> = (next) => ({
  ...next,
  request: async (...args: any[]) => {
    let lastError;
    for (let i = 0; i < 3; i++) {
      try {
        return await next.request(...args);
      } catch (e) {
        lastError = e;
        console.log(`[RETRY] Attempt ${i + 1} failed`);
      }
    }
    throw lastError;
  },
});

// Base HTTP client
const baseClient = {
  request: async (url: string) => {
    console.log(`[HTTP] GET ${url}`);
    if (Math.random() > 0.7) throw new Error("Network error");
    return { data: "Success!" };
  },
};

// Apply middleware
const enhancedClient = withLogging(withRetry(baseClient));

try {
  await enhancedClient.request("/api/data");
} catch (e) {
  console.log("Final error:", e.message);
}
console.log("");

// ----------------------------------------------------------------------------
// 6.3 Pseudo-Modules & Method Composition (Frankenstein Classes)
// ----------------------------------------------------------------------------
console.log("6.3 Composing methods from different modules:");

// Module 1: Authentication methods
const authMethods = {
  login: (state: any, username: string, password: string) => {
    console.log(`Authenticating ${username}...`);
    return { ...state, user: { username, isAuthenticated: true } };
  },
  logout: (state: any) => {
    console.log("Logging out...");
    return { ...state, user: null };
  },
  checkAuth: (state: any) => !!state.user?.isAuthenticated,
};

// Module 2: Data persistence methods
const persistenceMethods = {
  save: (state: any, key: string) => {
    console.log(`Saving to ${key}...`);
    // Simulate save
    return { ...state, lastSaved: new Date() };
  },
  load: (state: any, key: string) => {
    console.log(`Loading from ${key}...`);
    // Simulate load
    return { ...state, lastLoaded: new Date() };
  },
  clearCache: (state: any) => {
    console.log("Clearing cache...");
    return { ...state, cache: {} };
  },
};

// Module 3: Analytics methods
const analyticsMethods = {
  track: (state: any, event: string, data?: any) => {
    const events = state.events || [];
    events.push({ event, data, timestamp: new Date() });
    console.log(`Tracked: ${event}`);
    return { ...state, events };
  },
  getEvents: (state: any) => state.events || [],
  clearEvents: (state: any) => ({ ...state, events: [] }),
};

// Module 4: Utility methods from different sources
const arrayUtils = {
  addItem: (state: any, item: any) => ({
    ...state,
    items: [...(state.items || []), item],
  }),
  removeItem: (state: any, predicate: (item: any) => boolean) => ({
    ...state,
    items: (state.items || []).filter((item: any) => !predicate(item)),
  }),
  findItems: (state: any, predicate: (item: any) => boolean) =>
    (state.items || []).filter(predicate),
};

// Create a Frankenstein class by cherry-picking methods
const createHybridApi = (initialState = {}) => {
  // Cherry-pick specific methods from different modules
  const methods = {
    // From auth module
    login: authMethods.login,
    logout: authMethods.logout,

    // From persistence module
    save: persistenceMethods.save,

    // From analytics
    track: analyticsMethods.track,

    // From array utils
    addItem: arrayUtils.addItem,
    removeItem: arrayUtils.removeItem,

    // Custom method that uses multiple modules
    loginAndTrack: (state: any, username: string, password: string) => {
      // Compose methods from different modules
      let newState = authMethods.login(state, username, password);
      newState = analyticsMethods.track(newState, "user:login", { username });
      return newState;
    },
  };

  return provideTo(initialState)(makeChainable(methods));
};

// Use the hybrid API
const app = createHybridApi({ items: [] });
const loggedInApp = app
  .loginAndTrack("alice", "password123")
  .addItem({ id: 1, name: "Task 1" })
  .track("item:added")
  .save("app-state");

console.log("Current user:", loggedInApp.login.name); // Would need getter
console.log("");

// ----------------------------------------------------------------------------
// 6.3.1 Advanced Module Composition with Mixins
// ----------------------------------------------------------------------------
console.log("6.3.1 Advanced module composition:");

// Define module interfaces
interface TimestampModule {
  createdAt: Date;
  updatedAt: Date;
}

interface VersionModule {
  version: number;
}

// Module factories (like mixins)
const withTimestamps = <T extends object>(methods: Methods<T>) => ({
  ...methods,
  updateTimestamp: (state: T & TimestampModule) => ({
    ...state,
    updatedAt: new Date(),
  }),
  getAge: (state: T & TimestampModule) =>
    Date.now() - state.createdAt.getTime(),
});

const withVersioning = <T extends object>(methods: Methods<T>) => ({
  ...methods,
  incrementVersion: (state: T & VersionModule) => ({
    ...state,
    version: state.version + 1,
  }),
  resetVersion: (state: T & VersionModule) => ({
    ...state,
    version: 1,
  }),
});

const withValidation = <T extends object>(
  methods: Methods<T>,
  rules: Partial<
    Record<keyof typeof methods, (state: T, ...args: any[]) => boolean>
  >,
) => {
  const validated: Methods<T> = {};
  for (const [key, method] of Object.entries(methods)) {
    validated[key] = (state: T, ...args: any[]) => {
      const rule = rules[key as keyof typeof rules];
      if (rule && !rule(state, ...args)) {
        throw new Error(`Validation failed for ${key}`);
      }
      return method(state, ...args);
    };
  }
  return validated;
};

// Base document functionality
const documentMethods = {
  setTitle: (state: any, title: string) => ({ ...state, title }),
  setContent: (state: any, content: string) => ({ ...state, content }),
  publish: (state: any) => ({ ...state, published: true }),
  unpublish: (state: any) => ({ ...state, published: false }),
};

// Compose multiple modules into one
const createDocument = (title: string) => {
  const initialState = {
    title,
    content: "",
    published: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };

  // Layer the modules
  const methods = withTimestamps(
    withVersioning(
      withValidation(documentMethods, {
        setTitle: (s, title) => title.length > 0,
        setContent: (s, content) => content.length <= 10000,
      }),
    ),
  );

  return provideTo(initialState)(makeChainable(methods));
};

const doc = createDocument("My Document");
const updatedDoc = doc
  .setContent("Hello, world!")
  .incrementVersion()
  .updateTimestamp()
  .publish();

console.log("Document age:", doc.getAge(), "ms");
console.log("");

// ----------------------------------------------------------------------------
// 6.3.2 Creating Higher-Order Modules
// ----------------------------------------------------------------------------
console.log("6.3.2 Higher-order modules:");

// A higher-order module that adds CRUD operations to any entity
const createCrudModule = <T extends { id: string }>(
  entityName: string,
  validator?: (entity: T) => boolean,
) => ({
  [`create${entityName}`]: (state: any, entity: Omit<T, "id">) => {
    const newEntity = {
      ...entity,
      id: Math.random().toString(36).substr(2, 9),
    } as T;

    if (validator && !validator(newEntity)) {
      throw new Error(`Invalid ${entityName}`);
    }

    return {
      ...state,
      [entityName.toLowerCase() + "s"]: [
        ...(state[entityName.toLowerCase() + "s"] || []),
        newEntity,
      ],
    };
  },

  [`update${entityName}`]: (state: any, id: string, updates: Partial<T>) => {
    const key = entityName.toLowerCase() + "s";
    return {
      ...state,
      [key]: (state[key] || []).map((item: T) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    };
  },

  [`delete${entityName}`]: (state: any, id: string) => {
    const key = entityName.toLowerCase() + "s";
    return {
      ...state,
      [key]: (state[key] || []).filter((item: T) => item.id !== id),
    };
  },

  [`get${entityName}`]: (state: any, id: string) => {
    const key = entityName.toLowerCase() + "s";
    return (state[key] || []).find((item: T) => item.id === id);
  },

  [`getAll${entityName}s`]: (state: any) => {
    const key = entityName.toLowerCase() + "s";
    return state[key] || [];
  },
});

// Create a complex app by combining CRUD modules for different entities
interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
}

interface Comment {
  id: string;
  text: string;
  postId: string;
  authorId: string;
}

const createBlogApp = () => {
  // Combine multiple CRUD modules
  const methods = {
    ...createCrudModule<User>("User", (user) => user.email.includes("@")),
    ...createCrudModule<Post>("Post", (post) => post.title.length > 0),
    ...createCrudModule<Comment>(
      "Comment",
      (comment) => comment.text.length > 0,
    ),

    // Add custom methods that work across entities
    getPostsWithComments: (state: any) => {
      const posts = state.posts || [];
      const comments = state.comments || [];

      return posts.map((post: Post) => ({
        ...post,
        comments: comments.filter((c: Comment) => c.postId === post.id),
      }));
    },

    getUserActivity: (state: any, userId: string) => {
      const posts = (state.posts || []).filter(
        (p: Post) => p.authorId === userId,
      );
      const comments = (state.comments || []).filter(
        (c: Comment) => c.authorId === userId,
      );

      return {
        user: state.users?.find((u: User) => u.id === userId),
        postCount: posts.length,
        commentCount: comments.length,
        posts,
        comments,
      };
    },
  };

  return provideTo({
    users: [],
    posts: [],
    comments: [],
  })(makeChainable(methods));
};

// Use the blog app
const blog = createBlogApp();

// Create some data
let app = blog
  .createUser({ name: "Alice", email: "alice@example.com" })
  .createUser({ name: "Bob", email: "bob@example.com" });

const users = app.getAllUsers();
const alice = users[0];

app = app
  .createPost({
    title: "Hello World",
    content: "My first post!",
    authorId: alice.id,
  })
  .createComment({
    text: "Great post!",
    postId: app.getAllPosts()[0].id,
    authorId: users[1].id,
  });

console.log("Posts with comments:", app.getPostsWithComments());
console.log("Alice's activity:", app.getUserActivity(alice.id));
console.log("");

// ----------------------------------------------------------------------------
// 6.4 Event Emitter Pattern
// ----------------------------------------------------------------------------
console.log("6.4 Event emitter with make-with:");

type EventMap = Record<string, any>;
type EventEmitter<T extends EventMap> = {
  events: { [K in keyof T]?: ((data: T[K]) => void)[] };
};

const createEventEmitter = <T extends EventMap>() =>
  provideTo<EventEmitter<T>>({ events: {} })({
    on: (s, event: keyof T, handler: (data: T[keyof T]) => void) => {
      if (!s.events[event]) s.events[event] = [];
      s.events[event]!.push(handler);
      return () => {
        // Return unsubscribe function
        const handlers = s.events[event];
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) handlers.splice(index, 1);
        }
      };
    },
    emit: (s, event: keyof T, data: T[keyof T]) => {
      const handlers = s.events[event];
      if (handlers) handlers.forEach((h) => h(data));
    },
    removeAll: (s, event?: keyof T) => {
      if (event) {
        delete s.events[event];
      } else {
        s.events = {};
      }
    },
  });

// Usage
interface AppEvents {
  login: { username: string };
  logout: void;
  error: { message: string };
}

const events = createEventEmitter<AppEvents>();

const unsubscribe = events.on("login", (data) => {
  console.log(`User logged in: ${data.username}`);
});

events.on("error", (data) => {
  console.log(`Error occurred: ${data.message}`);
});

events.emit("login", { username: "alice" });
events.emit("error", { message: "Something went wrong" });

unsubscribe(); // Remove login handler
events.emit("login", { username: "bob" }); // Won't log
console.log("");

// ============================================================================
// 7. REAL APP EXAMPLE - Todo List
// ============================================================================

console.log("=== 7. COMPLETE APP EXAMPLE ===\n");

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

interface TodoState {
  todos: Todo[];
  filter: "all" | "active" | "completed";
}

const createTodoApp = () =>
  makeLayered<TodoState>({
    todos: [],
    filter: "all",
  })(
    // State updates (chainable)
    makeChainable({
      addTodo: (s, text: string) => ({
        ...s,
        todos: [
          ...s.todos,
          {
            id: Date.now().toString(),
            text,
            completed: false,
            createdAt: new Date(),
          },
        ],
      }),
      toggleTodo: (s, id: string) => ({
        ...s,
        todos: s.todos.map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo,
        ),
      }),
      deleteTodo: (s, id: string) => ({
        ...s,
        todos: s.todos.filter((todo) => todo.id !== id),
      }),
      setFilter: (s, filter: TodoState["filter"]) => ({
        ...s,
        filter,
      }),
      clearCompleted: (s) => ({
        ...s,
        todos: s.todos.filter((todo) => !todo.completed),
      }),
    }),
  )(
    // Getters
    {
      getAllTodos: (s) => s.todos,
      getFilter: (s) => s.filter,
      getFilteredTodos: (s) => {
        switch (s.filter) {
          case "active":
            return s.todos.filter((t) => !t.completed);
          case "completed":
            return s.todos.filter((t) => t.completed);
          default:
            return s.todos;
        }
      },
      getStats: (s) => ({
        total: s.todos.length,
        active: s.todos.filter((t) => !t.completed).length,
        completed: s.todos.filter((t) => t.completed).length,
      }),
    },
  )(
    // High-level operations using self
    {
      addMultipleTodos: (self, texts: string[]) => {
        let current = self;
        for (const text of texts) {
          current = current.addTodo(text);
        }
        return current;
      },
      completeAll: (self) => {
        let current = self;
        const todos = current.getAllTodos();
        for (const todo of todos) {
          if (!todo.completed) {
            current = current.toggleTodo(todo.id);
          }
        }
        return current;
      },
      // Demo method that shows the whole flow
      demo: (self) => {
        console.log("=== TODO APP DEMO ===");

        // Add some todos
        let app = self.addMultipleTodos([
          "Learn make-with",
          "Build awesome APIs",
          "Share with team",
        ]);

        console.log("Added todos:", app.getStats());

        // Complete first todo
        const firstTodo = app.getAllTodos()[0];
        app = app.toggleTodo(firstTodo.id);
        console.log("After completing first:", app.getStats());

        // Filter
        app = app.setFilter("active");
        console.log(
          "Active todos:",
          app.getFilteredTodos().map((t) => t.text),
        );

        // Complete all
        app = app.completeAll();
        console.log("After complete all:", app.getStats());

        // Clear completed
        app = app.clearCompleted();
        console.log("After clear completed:", app.getStats());

        return app;
      },
    },
  )();

const todoApp = createTodoApp();
todoApp.demo();

console.log(
  "\n🎉 Exploration complete! You've seen every feature of make-with.",
);

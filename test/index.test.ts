import { describe, it, expect } from 'vitest';
import { _with, make, makeWith } from '../src/index';

// Helper types and functions for testing
interface TestState { value: number; }
const testSubject: TestState = { value: 5 };

describe('Functional Utilities Library', () => {
  describe('_with', () => {
    it('partially applies subject to single function', () => {
      const mod = _with(testSubject);
      const getValue = mod((s: TestState) => s.value)[0];
      expect(getValue()).toBe(5);
    });

    it('partially applies subject to multiple functions', () => {
      const mod = _with(testSubject);
      const [getValue, increment] = mod(
        (s: TestState) => s.value,
        (s: TestState, n: number) => s.value + n
      );
      expect(getValue()).toBe(5);
      expect(increment(3)).toBe(8);
    });

    it('preserves argument and return types', () => {
      const mod = _with(testSubject);
      const [add] = mod((s: TestState, n: number) => s.value + n);
      expect(add(2)).toBe(7);
    });

    it('throws error for non-function input', () => {
      const mod = _with(testSubject);
      expect(() => mod(42 as any)).toThrow('[_with] Argument at index 0 must be a function');
    });

    it('throws error when no functions provided', () => {
      const mod = _with(testSubject);
      expect(() => mod()).toThrow('[_with] At least one function must be provided');
    });
  });

  describe('make', () => {
    describe('array input', () => {
      it('creates object from named functions', () => {
        function add(a: number, b: number): number { return a + b; }
        function multiply(a: number, b: number): number { return a * b; }
        const ops = make(add, multiply);
        expect(ops.add(2, 3)).toBe(5);
        expect(ops.multiply(4, 2)).toBe(8);
      });

      it('throws for unnamed functions', () => {
        expect(() => make((a: number) => a)).toThrow('[make] Function at index 0 must have a non-empty name');
      });

      it('throws for non-function elements', () => {
        expect(() => make(42 as any)).toThrow('[make] Argument at index 0 must be a function');
      });

      it('throws for duplicate function names', () => {
        function add(a: number) { return a; }
        expect(() => make(add, add)).toThrow('[make] Duplicate function name "add"');
      });

      it('rejects nested arrays as invalid arguments', () => {
        function add(a: number, b: number) { return a + b; }
        // @ts-expect-error
        expect(() => make([add])).toThrow();
      });
    });

    describe('object input', () => {
      it('creates object from function map', () => {
        const ops = make({
          toUpper: (s: string) => s.toUpperCase(),
          repeat: (s: string, n: number) => s.repeat(n)
        });
        expect(ops.toUpper('hello')).toBe('HELLO');
        expect(ops.repeat('hi', 2)).toBe('hihi');
      });

      it('throws for non-function values', () => {
        expect(() => make({ invalid: 42 as any })).toThrow();
      });

      it('works with empty object', () => {
        const ops = make({});
        expect(typeof ops).toBe('object');
      });
    });
  });

  describe('makeWith', () => {
    describe('validation', () => {
      it('throws for non-object functions map', () => {
        expect(() => makeWith(testSubject)(42 as any)).toThrow('[makeWith] Functions map must be a non-null object');
      });

      it('throws for null functions map', () => {
        expect(() => makeWith(testSubject)(null as any)).toThrow('[makeWith] Functions map must be a non-null object');
      });
    });

    describe('object input', () => {
      it('creates object with partially applied functions', () => {
        const ops = makeWith(testSubject)({
          increment: (s: TestState, n: number) => s.value + n,
          double: (s: TestState) => s.value * 2
        });
        expect(ops.increment(3)).toBe(8);
        expect(ops.double()).toBe(10);
      });

      it('throws for non-function values', () => {
        expect(() => makeWith(testSubject)({ invalid: 42 as any })).toThrow('[makeWith] API creation failed');
      });

      it('works with empty object', () => {
        const ops = makeWith(testSubject)({});
        expect(typeof ops).toBe('object');
      });

      it('preserves argument and return types', () => {
        const ops = makeWith(testSubject)({
          add: (s: TestState, n: number) => s.value + n
        });
        expect(ops.add(2)).toBe(7);
      });
    });
  });

  // Type safety tests (compile-time checks)
  describe('type safety', () => {
    it('_with enforces subject type', () => {
      const mod = _with(testSubject);
      // @ts-expect-error: Function must accept TestState
      mod((s: string) => s.length);
    });

    it('make enforces function input', () => {
      // @ts-expect-error: Must be functions or object with functions
      expect(() => make(42)).toThrow();
    });

    it('makeWith enforces subject type', () => {
      const mod = makeWith(testSubject);
      // @ts-expect-error: Function must accept TestState
      mod({ invalid: (s: string) => s.length });
    });
  });
});

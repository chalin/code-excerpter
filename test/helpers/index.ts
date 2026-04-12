/**
 * Shared helpers for Vitest suites (narrowing, repeated checks, fixtures).
 */
import { expect } from "vitest";
import type { Directive } from "../../src/directive.js";

/** Runtime check via Vitest; narrows `d` for TypeScript after the call. */
export function expectDirective(d: Directive | null): asserts d is Directive {
  expect(d).not.toBeNull();
}

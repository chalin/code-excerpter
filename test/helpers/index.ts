/**
 * Shared helpers for Vitest suites (narrowing, repeated checks, fixtures).
 */
import { expect } from "vitest";
import type { Directive } from "../../src/directive.js";

export { dedent } from "./dedent.js";
export { re } from "./re.js";

/** Runtime check via Vitest; narrows `d` for TypeScript after the call. */
export function expectDirective(d: Directive | null): asserts d is Directive {
  expect(d).not.toBeNull();
}

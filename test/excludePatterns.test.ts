import { describe, expect, it } from "vitest";
import { compileExcludePatterns } from "../src/excludePatterns.js";

describe("compileExcludePatterns", () => {
  it("returns regexes for valid patterns", () => {
    const r = compileExcludePatterns(["vendor", "/\\.git/"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patterns).toHaveLength(2);
    expect(r.patterns[0]!.test("path/vendor/x")).toBe(true);
    expect(r.patterns[1]!.test("a/.git/b")).toBe(true);
  });

  it("returns ok for an empty list", () => {
    const r = compileExcludePatterns([]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patterns).toEqual([]);
  });

  it("returns a single error line for a malformed pattern", () => {
    const r = compileExcludePatterns(["\u005b"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/^error: invalid --exclude pattern/);
    expect(r.error).toMatch(/Invalid regular expression/i);
  });
});

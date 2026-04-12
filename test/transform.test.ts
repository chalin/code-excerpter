import { describe, expect, it, vi } from "vitest";
import {
  applyExcerptTransforms,
  applyFrom,
  applyRemove,
  applyRetain,
  applySkip,
  applyTake,
  applyTo,
  encodeSlashChar,
  parseReplacePipeline,
  patternToLinePredicate,
} from "../src/transform.js";

describe("transform", () => {
  describe("patternToLinePredicate", () => {
    it("substring match", () => {
      const p = patternToLinePredicate("foo");
      expect(p).not.toBeNull();
      expect(p!("afoob")).toBe(true);
      expect(p!("bar")).toBe(false);
    });

    it("regex form", () => {
      const p = patternToLinePredicate("/^\\s{2}bar/");
      expect(p).not.toBeNull();
      expect(p!("  bar")).toBe(true);
      expect(p!(" bar")).toBe(false);
    });

    it("invalid regexp reports and returns null", () => {
      const onError = vi.fn();
      const p = patternToLinePredicate("/(/", onError);
      expect(p).toBeNull();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe("applySkip", () => {
    it("non-negative", () => {
      expect(applySkip(["a", "b", "c"], 1)).toEqual(["b", "c"]);
      expect(applySkip(["a", "b", "c"], 0)).toEqual(["a", "b", "c"]);
    });

    it("negative drops from end", () => {
      expect(applySkip(["a", "b", "c"], -1)).toEqual(["a", "b"]);
      expect(applySkip(["a", "b", "c"], -2)).toEqual(["a"]);
    });
  });

  describe("applyTake", () => {
    it("non-negative", () => {
      expect(applyTake(["a", "b", "c"], 2)).toEqual(["a", "b"]);
      expect(applyTake(["a", "b", "c"], 0)).toEqual([]);
    });

    it("negative keeps trailing slice", () => {
      expect(applyTake(["a", "b", "c"], -1)).toEqual(["b", "c"]);
      expect(applyTake(["a", "b", "c"], -2)).toEqual(["a", "b", "c"]);
    });
  });

  describe("applyFrom", () => {
    it("starts at first match", () => {
      const pred = (s: string) => s.includes("x");
      expect(applyFrom(["a", "bx", "c"], pred)).toEqual(["bx", "c"]);
    });

    it("no match yields empty", () => {
      const pred = (s: string) => s.includes("z");
      expect(applyFrom(["a", "b"], pred)).toEqual([]);
    });
  });

  describe("applyTo", () => {
    it("includes first matching line", () => {
      const pred = (s: string) => s.includes("stop");
      expect(applyTo(["a", "b stop", "c"], pred)).toEqual(["a", "b stop"]);
    });

    it("no match leaves lines unchanged", () => {
      const pred = (s: string) => s.includes("z");
      expect(applyTo(["a", "b"], pred)).toEqual(["a", "b"]);
    });
  });

  describe("applyRemove / applyRetain", () => {
    it("remove", () => {
      const pred = (s: string) => /omit/.test(s);
      expect(applyRemove(["keep", "omit this", "x"], pred)).toEqual([
        "keep",
        "x",
      ]);
    });

    it("retain", () => {
      const pred = (s: string) => s.startsWith("!");
      expect(applyRetain(["a", "!b", "c", "!d"], pred)).toEqual(["!b", "!d"]);
    });
  });

  describe("encodeSlashChar", () => {
    it("decodes escapes", () => {
      expect(encodeSlashChar(String.raw`a\n\t\\b`)).toBe("a\n\t\\b");
    });

    it("hex", () => {
      expect(encodeSlashChar(String.raw`\x41`)).toBe("A");
    });
  });

  describe("parseReplacePipeline", () => {
    it("single segment", () => {
      const fn = parseReplacePipeline(`/foo/bar/g`);
      expect(fn).not.toBeNull();
      expect(fn!("foo")).toBe("bar");
    });

    it("multiple segments compose left-to-right", () => {
      const fn = parseReplacePipeline(`/a/x/g;/x/b/g`);
      expect(fn).not.toBeNull();
      expect(fn!("a")).toBe("b");
    });

    it("invalid reports via onError", () => {
      const onError = vi.fn();
      const fn = parseReplacePipeline(`foo`, onError);
      expect(fn).toBeNull();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe("applyExcerptTransforms", () => {
    it("applies spec order: skip then take", () => {
      const lines = ["a", "b", "c", "d", "e"];
      const out = applyExcerptTransforms(lines, { skip: "1", take: "2" });
      expect(out).toEqual(["b", "c"]);
      expect(lines).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("from then to", () => {
      const out = applyExcerptTransforms(
        ["skip", "one", "two", "end", "tail"],
        { from: "one", to: "end" },
      );
      expect(out).toEqual(["one", "two", "end"]);
    });

    it("remove then retain", () => {
      const out = applyExcerptTransforms(["ax", "b", "ay", "bz"], {
        remove: "b",
        retain: "a",
      });
      expect(out).toEqual(["ax", "ay"]);
    });

    it("replace then indent-by", () => {
      const out = applyExcerptTransforms(["x1", "y1"], {
        replace: `/1/!/g`,
        indentBy: "2",
      });
      expect(out).toEqual(["  x!", "  y!"]);
    });

    it("replace with capture groups", () => {
      const out = applyExcerptTransforms(["line:42"], {
        replace: String.raw`/line:(\d+)/L$1/g`,
      });
      expect(out).toEqual(["L42"]);
    });

    it("indent-by out of range", () => {
      const onError = vi.fn();
      const out = applyExcerptTransforms(["a"], { indentBy: "101" }, onError);
      expect(out).toEqual(["a"]);
      expect(onError).toHaveBeenCalled();
    });

    it("omit replace when invalid", () => {
      const onError = vi.fn();
      const out = applyExcerptTransforms(["ab"], { replace: "bad" }, onError);
      expect(out).toEqual(["ab"]);
      expect(onError).toHaveBeenCalled();
    });

    it("invalid skip is ignored", () => {
      expect(applyExcerptTransforms(["a", "b"], { skip: "x" })).toEqual([
        "a",
        "b",
      ]);
    });
  });
});

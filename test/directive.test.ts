import { describe, expect, it } from "vitest";
import { tryParseDirective } from "../src/directive.js";
import { expectDirective } from "./helpers/index.js";

describe("directive", () => {
  describe("basic", () => {
    it("not a directive", () => {
      const d = tryParseDirective("");
      expect(d).toBeNull();
    });

    it("startRegion", () => {
      const d = tryParseDirective("#docregion");
      expectDirective(d);
      expect(d.kind).toBe("startRegion");
      expect(d.rawArgs).toBe("");
      expect(d.args).toEqual([]);
    });

    it("endRegion", () => {
      const d = tryParseDirective("#enddocregion");
      expectDirective(d);
      expect(d.kind).toBe("endRegion");
      expect(d.rawArgs).toBe("");
      expect(d.args).toEqual([]);
    });
  });

  // Leading and trailing text is ignored
  describe("context insensitive", () => {
    it("startRegion", () => {
      const spaces = "  ";
      const d = tryParseDirective(`${spaces}// #docregion`);
      expectDirective(d);
      expect(d.kind).toBe("startRegion");
      expect(d.rawArgs).toBe("");
      expect(d.args).toEqual([]);
      expect(d.indentation).toBe(spaces);
    });

    it("endRegion", () => {
      const d = tryParseDirective(" #enddocregion a,b,  c  ");
      expectDirective(d);
      expect(d.kind).toBe("endRegion");
      expect(d.rawArgs).toBe("a,b,  c");
      expect(d.args).toEqual(["a", "b", "c"]);
      expect(d.indentation).toBe(" ");
    });
  });

  describe("close comment syntax:", () => {
    describe("HTML:", () => {
      it("startRegion", () => {
        const d = tryParseDirective("<!--#docregion-->");
        expectDirective(d);
        expect(d.kind).toBe("startRegion");
        expect(d.rawArgs).toBe("");
        expect(d.args).toEqual([]);
        expect(d.indentation).toBe("");
      });

      it("endRegion", () => {
        const d = tryParseDirective("<!-- #enddocregion a -->  ");
        expectDirective(d);
        expect(d.kind).toBe("endRegion");
        expect(d.rawArgs).toBe("a");
        expect(d.args).toEqual(["a"]);
        expect(d.indentation).toBe("");
      });
    });

    describe("CSS:", () => {
      it("startRegion", () => {
        const d = tryParseDirective("/*#docregion*/");
        expectDirective(d);
        expect(d.kind).toBe("startRegion");
        expect(d.rawArgs).toBe("");
        expect(d.args).toEqual([]);
        expect(d.indentation).toBe("");
      });

      it("endRegion", () => {
        const d = tryParseDirective("/* #enddocregion a */  ");
        expectDirective(d);
        expect(d.kind).toBe("endRegion");
        expect(d.rawArgs).toBe("a");
        expect(d.args).toEqual(["a"]);
        expect(d.indentation).toBe("");
      });
    });
  });

  describe("problem cases:", () => {
    it("Deprecated unquoted default region name", () => {
      const d = tryParseDirective("#docregion ,a");
      expectDirective(d);
      expect(d.kind).toBe("startRegion");
      expect(d.rawArgs).toBe(",a");
      expect(d.args).toEqual(["", "a"]);
      expect(d.issues).toEqual(["unquoted default region name is deprecated"]);
    });

    it('Duplicate "a" region', () => {
      const d = tryParseDirective("#docregion a,b,c,a");
      expectDirective(d);
      expect(d.kind).toBe("startRegion");
      expect(d.rawArgs).toBe("a,b,c,a");
      expect(d.args).toEqual(["a", "b", "c"]);
      expect(d.issues).toEqual(['repeated argument "a"']);
    });

    it('Duplicate "" region', () => {
      const d = tryParseDirective("#docregion '',''");
      expectDirective(d);
      expect(d.kind).toBe("startRegion");
      expect(d.rawArgs).toBe("'',''");
      expect(d.args).toEqual([""]);
      expect(d.issues).toEqual(['repeated argument ""']);
    });
  });

  describe("edge cases", () => {
    it("word boundary: #docregionfoo is not a directive", () => {
      const d = tryParseDirective("the word #docregionfoo is not a directive");
      expect(d).toBeNull();
    });

    it("#docregion '' parses as default region with no issues", () => {
      const d = tryParseDirective("#docregion ''");
      expectDirective(d);
      expect(d.kind).toBe("startRegion");
      expect(d.args).toEqual([""]);
      expect(d.issues).toEqual([]);
    });

    it("plain text returns null", () => {
      const d = tryParseDirective("hello world");
      expect(d).toBeNull();
    });
  });
});

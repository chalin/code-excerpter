import { describe, expect, it, vi } from "vitest";
import {
  injectMarkdown,
  PROC_INSTR_RE,
  type MarkdownInjectContext,
} from "../src/inject.js";

function ctx(files: Record<string, string>, base = ""): MarkdownInjectContext {
  return {
    readFile: (p) => files[p] ?? null,
    pathBase: base,
  };
}

describe("inject", () => {
  describe("PROC_INSTR_RE", () => {
    it("matches quoted path and named args", () => {
      const m = '<?code-excerpt "lib/a.dart (r)" skip="1"?>'.match(
        PROC_INSTR_RE,
      );
      expect(m?.groups?.unnamed).toBe("lib/a.dart (r)");
      expect(m?.groups?.named?.trim()).toBe('skip="1"');
    });

    it("matches set instruction", () => {
      const x = '<?code-excerpt path-base="ex"?>'.match(PROC_INSTR_RE);
      expect(x?.groups?.unnamed).toBeUndefined();
      expect(x?.groups?.named?.trim()).toBe('path-base="ex"');
    });

    it("does not match when non-whitespace follows the closing ?>", () => {
      expect(
        '<?code-excerpt "a.dart"?> trailing'.match(PROC_INSTR_RE),
      ).toBeNull();
    });

    it("allows trailing whitespace after ?>", () => {
      const m = '<?code-excerpt "a.dart"?>   \t'.match(PROC_INSTR_RE);
      expect(m?.groups?.unnamed).toBe("a.dart");
    });
  });

  describe("injectMarkdown", () => {
    it("injects default region from dart source", () => {
      const src = `// #docregion
final x = 1;
// #enddocregion
`;
      const md = [
        '<?code-excerpt "lib/a.dart"?>',
        "",
        "```dart",
        "old",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "lib/a.dart": src }));
      expect(out).toContain("final x = 1;");
      expect(out).not.toContain("old");
    });

    it("applies path-base before resolving path", () => {
      const src = "// ok\n";
      const md = [
        '<?code-excerpt path-base="p"?>',
        '<?code-excerpt "b.dart"?>',
        "",
        "```",
        ".",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "p/b.dart": src }));
      expect(out).toContain("// ok");
    });

    it("applies skip transform", () => {
      const src = `// #docregion
a
b
// #enddocregion
`;
      const md = [
        '<?code-excerpt "f.dart" skip="1"?>',
        "",
        "```",
        "x",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "f.dart": src }));
      const fence = out.match(/```[\s\S]*?```/)?.[0] ?? "";
      expect(fence).toContain("b");
      expect(fence).not.toContain("a");
    });

    it("strips list marker prefix in linePrefix", () => {
      const src = `// #docregion
z
// #enddocregion
`;
      const md = [
        '- <?code-excerpt "x.dart"?>',
        "",
        "```",
        ".",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "x.dart": src }));
      expect(out).toMatch(/^\s+z$/m);
    });

    it("returns original block when source is missing", () => {
      const onError = vi.fn();
      const md = [
        '<?code-excerpt "missing.dart"?>',
        "",
        "```",
        "keep",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, { readFile: () => null, onError });
      expect(out).toContain("keep");
      expect(onError).toHaveBeenCalled();
    });

    it("leaves block unchanged for diff-with with error", () => {
      const onError = vi.fn();
      const md = [
        '<?code-excerpt "a.dart" diff-with="b.dart"?>',
        "",
        "```",
        "old",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, {
        readFile: () => "//\n",
        onError,
      });
      expect(out).toContain("old");
      expect(onError).toHaveBeenCalled();
    });

    it("reads implicit default region when file has no directives", () => {
      const src = "plain line\n";
      const md = [
        '<?code-excerpt "plain.txt"?>',
        "",
        "```",
        "x",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "plain.txt": src }));
      expect(out).toContain("plain line");
    });

    it("applies file-level set replace after excerpt transforms", () => {
      const src = `// #docregion
SRC_TOKEN
// #enddocregion
`;
      const md = [
        '<?code-excerpt replace="/SRC_TOKEN/NEW/g"?>',
        '<?code-excerpt "r.dart"?>',
        "",
        "```",
        "x",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "r.dart": src }));
      const fence = out.match(/```[\s\S]*?```/)?.[0] ?? "";
      expect(fence).toContain("NEW");
      expect(fence).not.toContain("SRC_TOKEN");
    });

    it("applies globalReplace from context after file-level replace", () => {
      const src = `// #docregion
aa
// #enddocregion
`;
      const md = [
        '<?code-excerpt replace="/aa/bb/g"?>',
        '<?code-excerpt "g.dart"?>',
        "",
        "```",
        "x",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, {
        readFile: (p) => (p === "g.dart" ? src : null),
        globalReplace: `/bb/cc/g`,
      });
      const fence = out.match(/```[\s\S]*?```/)?.[0] ?? "";
      expect(fence).toContain("cc");
      expect(fence).not.toContain("aa");
    });

    it("throws on invalid globalReplace", () => {
      expect(() =>
        injectMarkdown("x", {
          readFile: () => null,
          globalReplace: "not-valid",
        }),
      ).toThrow(/invalid global replace/);
    });

    it("reports invalid processing instruction when regex does not match", () => {
      const onError = vi.fn();
      const bad = '<?code-excerpt "broken.dart skip="1"?>';
      injectMarkdown(`${bad}\n\`\`\`\nx\n\`\`\`\n`, {
        readFile: () => "//\n",
        onError,
      });
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining("invalid processing instruction"),
      );
    });

    it("warns when text follows ?> on the same line and does not inject", () => {
      const onWarning = vi.fn();
      const onError = vi.fn();
      const src = `// #docregion\nNEVER\n// #enddocregion\n`;
      const md = [
        '<?code-excerpt "t.dart"?> trailing junk',
        "",
        "```",
        "KEEP",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, {
        readFile: (p) => (p === "t.dart" ? src : null),
        onWarning,
        onError,
      });
      expect(onWarning).toHaveBeenCalledWith(
        expect.stringContaining('extraneous text after closing "?>"'),
      );
      expect(onError).not.toHaveBeenCalled();
      expect(out).toContain("KEEP");
      expect(out).not.toContain("NEVER");
    });

    it("warns when PI is not closed with ?>", () => {
      const onWarning = vi.fn();
      const src = `// #docregion\nok\n// #enddocregion\n`;
      const md = ['<?code-excerpt "c.dart">', "", "```", "x", "```", ""].join(
        "\n",
      );
      injectMarkdown(md, {
        readFile: (p) => (p === "c.dart" ? src : null),
        onWarning,
      });
      expect(onWarning).toHaveBeenCalledWith(
        expect.stringMatching(/processing instruction must be closed using/),
      );
    });

    it("errors on unterminated markdown fence and keeps original block", () => {
      const onError = vi.fn();
      const src = `// #docregion\nNOT_INJECTED\n// #enddocregion\n`;
      const md = ['<?code-excerpt "u.dart"?>', "", "```", "keep-inner"].join(
        "\n",
      );
      const out = injectMarkdown(md, {
        readFile: (p) => (p === "u.dart" ? src : null),
        onError,
      });
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining("unterminated markdown code block"),
      );
      expect(out).toContain("keep-inner");
      expect(out).not.toContain("NOT_INJECTED");
    });

    it("errors when code block does not immediately follow excerpt PI", () => {
      const onError = vi.fn();
      const src = "//\n";
      const md = [
        '<?code-excerpt "q.dart"?>',
        "",
        "int x = 0;",
        "```",
        "x",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, {
        readFile: (p) => (p === "q.dart" ? src : null),
        onError,
      });
      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/code block should immediately follow/s),
      );
      expect(out).toContain("int x = 0;");
    });

    it("errors on set instruction with more than one argument", () => {
      const onError = vi.fn();
      const md = [
        '<?code-excerpt path-base="a" replace="/x/y/g"?>',
        '<?code-excerpt "b.dart"?>',
        "",
        "```",
        ".",
        "```",
        "",
      ].join("\n");
      injectMarkdown(md, {
        readFile: () => "//\n",
        onError,
      });
      expect(onError).toHaveBeenCalledWith(
        "set instruction should have at most one argument",
      );
    });

    it("warns and ignores unrecognized set instruction argument", () => {
      const onWarning = vi.fn();
      const md = [
        '<?code-excerpt foo="abc"?>',
        '<?code-excerpt "z.dart"?>',
        "",
        "```",
        ".",
        "```",
        "",
      ].join("\n");
      injectMarkdown(md, {
        readFile: () => "//\n",
        onWarning,
      });
      expect(onWarning).toHaveBeenCalledWith(
        expect.stringMatching(/unrecognized set instruction argument:\s*foo/),
      );
    });

    it("clears file-level replace when set replace is empty", () => {
      const src = `// #docregion\nSRC_TOKEN\n// #enddocregion\n`;
      const md = [
        '<?code-excerpt replace="/SRC_TOKEN/NEW/g"?>',
        '<?code-excerpt replace=""?>',
        '<?code-excerpt "clr.dart"?>',
        "",
        "```",
        "x",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "clr.dart": src }));
      const fence = out.match(/```[\s\S]*?```/)?.[0] ?? "";
      expect(fence).toContain("SRC_TOKEN");
      expect(fence).not.toContain("NEW");
    });

    it("does not apply invalid file-level set replace (reports error)", () => {
      const onError = vi.fn();
      const src = `// #docregion\nSRC_TOKEN\n// #enddocregion\n`;
      const md = [
        '<?code-excerpt replace="not-a-regex-pipeline"?>',
        '<?code-excerpt "inv.dart"?>',
        "",
        "```",
        "x",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, {
        readFile: (p) => (p === "inv.dart" ? src : null),
        onError,
      });
      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/invalid replace attribute/),
      );
      const fence = out.match(/```[\s\S]*?```/)?.[0] ?? "";
      expect(fence).toContain("SRC_TOKEN");
    });

    it("applies globalReplace without file-level set replace", () => {
      const src = `// #docregion\nhello\n// #enddocregion\n`;
      const md = [
        '<?code-excerpt "only-gr.dart"?>',
        "",
        "```",
        "x",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, {
        readFile: (p) => (p === "only-gr.dart" ? src : null),
        globalReplace: `/hello/mundo/g`,
      });
      const fence = out.match(/```[\s\S]*?```/)?.[0] ?? "";
      expect(fence).toContain("mundo");
      expect(fence).not.toContain("hello");
    });

    it("treats set class-only and title-only as no-ops (no warning)", () => {
      const onWarning = vi.fn();
      const src = `// #docregion\nok\n// #enddocregion\n`;
      const md = [
        '<?code-excerpt class="prettyprint"?>',
        '<?code-excerpt title="Sample"?>',
        '<?code-excerpt "noop.dart"?>',
        "",
        "```",
        ".",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, {
        readFile: (p) => (p === "noop.dart" ? src : null),
        onWarning,
      });
      expect(onWarning).not.toHaveBeenCalled();
      expect(out).toContain("ok");
    });

    it("uses region= named argument when path has no (region) suffix", () => {
      const src = `// #docregion r1\nin-r1\n// #enddocregion\n`;
      const md = [
        '<?code-excerpt "reg.dart" region="r1"?>',
        "",
        "```",
        ".",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "reg.dart": src }));
      expect(out).toContain("in-r1");
    });

    it('region="" overrides path-embedded (region) and returns full file', () => {
      const src = [
        "// #docregion greeting",
        "var greeting = 'hello';",
        "// #enddocregion greeting",
        "",
        "void main() {}",
      ].join("\n");
      const md = [
        '<?code-excerpt "a.dart (greeting)" region=""?>',
        "",
        "```",
        ".",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "a.dart": src }));
      expect(out).toContain("var greeting");
      expect(out).toContain("void main()");
    });

    it("substitutes plaster markers when excerptsYaml is true", () => {
      const src = `// #docregion
before
// #enddocregion
// #docregion
after
// #enddocregion
`;
      const md = [
        '<?code-excerpt "pl.dart"?>',
        "",
        "```dart",
        ".",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, {
        readFile: (p) => (p === "pl.dart" ? src : null),
        excerptsYaml: true,
      });
      const fence = out.match(/```dart[\s\S]*?```/)?.[0] ?? "";
      expect(fence).toContain("before");
      expect(fence).toContain("after");
      expect(fence).toMatch(/\/\/\s+···/);
      expect(fence).not.toMatch(/\n···\n/);
    });

    it("strips DEFAULT_PLASTER lines when plaster=none with excerptsYaml", () => {
      const src = `// #docregion
a
// #enddocregion
// #docregion
b
// #enddocregion
`;
      const md = [
        '<?code-excerpt plaster="none"?>',
        '<?code-excerpt "pn.dart"?>',
        "",
        "```dart",
        ".",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, {
        readFile: (p) => (p === "pn.dart" ? src : null),
        excerptsYaml: true,
      });
      const fence = out.match(/```dart[\s\S]*?```/)?.[0] ?? "";
      expect(fence).toContain("a");
      expect(fence).toContain("b");
      expect(fence).not.toContain("···");
    });

    it("errors when input ends after excerpt PI (no code block)", () => {
      const onError = vi.fn();
      const md = ['<?code-excerpt "end.dart"?>', ""].join("\n");
      injectMarkdown(md, {
        readFile: () => "//\n",
        onError,
      });
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining("reached end of input"),
      );
    });

    it("handles liquid prettify fences like backtick fences", () => {
      const src = `// #docregion
liquid
// #enddocregion
`;
      const md = [
        '<?code-excerpt "liq.dart"?>',
        "",
        "{% prettify dart %}",
        ".",
        "{% endprettify %}",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "liq.dart": src }));
      expect(out).toContain("liquid");
    });

    it("does not treat non-prettify Liquid blocks as code fences", () => {
      const src = `// #docregion\nINJECTED\n// #enddocregion\n`;
      const md = [
        '<?code-excerpt "x.dart"?>',
        "",
        "{% if true %}",
        "SHOULD_STAY",
        "{% endif %}",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "x.dart": src }));
      expect(out).toContain("SHOULD_STAY");
      expect(out).not.toContain("INJECTED");
    });

    it("chains multiple replace steps in file-level set replace", () => {
      const src = `// #docregion
ab
// #enddocregion
`;
      const md = [
        '<?code-excerpt replace="/a/x/g;/b/y/g"?>',
        '<?code-excerpt "chain.dart"?>',
        "",
        "```",
        ".",
        "```",
        "",
      ].join("\n");
      const out = injectMarkdown(md, ctx({ "chain.dart": src }));
      const fence = out.match(/```[\s\S]*?```/)?.[0] ?? "";
      expect(fence).toContain("xy");
    });
  });
});

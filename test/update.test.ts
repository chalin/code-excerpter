/**
 * Tests for {@link updatePaths} (Phase 4 filesystem updater).
 *
 * Each test creates a directory tree under the repo’s `tmp/` (gitignored), with
 * markdown and source files, runs {@link updatePaths}, and asserts on the
 * result and written output. Directory names use a human-readable date-time
 * stamp (`YYYY-MM-DD-HHmmss`) plus a short random slug for uniqueness, with up
 * to 10 attempts before failing.
 *
 * By default those trees are deleted after each test. To keep them under
 * `tmp/` for inspection, set `KEEP_TEST_TMP=1` (e.g.
 * `KEEP_TEST_TMP=1 npm run test:base -- test/update.test.ts`).
 *
 * Coverage:
 *
 * - Basic injection + write-back
 * - Unchanged-file no-op (no write)
 * - Recursive directory walking
 * - Dot-directory exclusion
 * - `--exclude` regex patterns
 * - `--dry-run` (no writes)
 * - Error collection for missing source files
 * - Single-file paths
 * - Non-`.md` file skipping
 * - `globalReplace` pass-through
 * - Relative `pathBase` (same as CLI `-p path/to/src` from cwd)
 * - Missing root path (no rejection; `errors` populated)
 * - Explicit `.hidden` / `vendor` roots vs dot-skip and `--exclude` (same
 *   rules as when those dirs appear under a parent root)
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { updatePaths } from "../src/update.js";

const TMP_ROOT = join(process.cwd(), "tmp");
const TEST_TMP_DIR_PREFIX = "ce-test";
const MK_TMP_MAX_ATTEMPTS = 10;

/** Local date and time as `YYYY-MM-DD-HHmm-ss` (e.g. `2026-04-12-1752-41`). */
function formatHumanReadableDateTime(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${day}-${h}${min}-${s}`;
}

function mkTmp(): string {
  mkdirSync(TMP_ROOT, { recursive: true });
  const dateTimeStamp = formatHumanReadableDateTime(new Date());

  for (let attempt = 0; attempt < MK_TMP_MAX_ATTEMPTS; attempt++) {
    const randomSlug = Math.random().toString(36).slice(2, 8);
    const dirBaseName = `${TEST_TMP_DIR_PREFIX}-${dateTimeStamp}-${randomSlug}`;
    const candidate = join(TMP_ROOT, dirBaseName);
    if (existsSync(candidate)) continue;
    try {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Race or transient failure; try another name.
    }
  }

  throw new Error(
    `mkTmp: could not create a unique directory under ${TMP_ROOT} after ${MK_TMP_MAX_ATTEMPTS} attempts`,
  );
}

function writeFixture(base: string, rel: string, content: string): string {
  const full = join(base, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
  return full;
}

const dirs: string[] = [];
function useTmp(): string {
  const d = mkTmp();
  dirs.push(d);
  return d;
}

const keepTestTmp =
  process.env.KEEP_TEST_TMP === "1" || process.env.KEEP_TEST_TMP === "true";

afterEach(() => {
  if (!keepTestTmp) {
    for (const d of dirs) {
      if (existsSync(d)) rmSync(d, { recursive: true, force: true });
    }
  }
  dirs.length = 0;
});

describe("updatePaths", () => {
  it("updates a markdown file with an excerpt", async () => {
    const tmp = useTmp();
    const src = join(tmp, "src");
    const docs = join(tmp, "docs");

    writeFixture(
      src,
      "lib/hello.dart",
      [
        "// #docregion greeting",
        "var greeting = 'hello';",
        "// #enddocregion greeting",
      ].join("\n"),
    );

    writeFixture(
      docs,
      "guide.md",
      [
        '<?code-excerpt "lib/hello.dart (greeting)"?>',
        "",
        "```dart",
        "old content",
        "```",
        "",
      ].join("\n"),
    );

    const result = await updatePaths([docs], { pathBase: src });

    expect(result.filesProcessed).toBe(1);
    expect(result.filesUpdated).toBe(1);
    expect(result.errors).toEqual([]);

    const updated = readFileSync(join(docs, "guide.md"), "utf8");
    expect(updated).toContain("var greeting = 'hello';");
    expect(updated).not.toContain("old content");
  });

  it("resolves excerpts when pathBase is relative to cwd (CLI -p)", async () => {
    const tmp = useTmp();
    const src = join(tmp, "src");
    const docs = join(tmp, "docs");

    writeFixture(
      src,
      "lib/a.dart",
      ["// #docregion", "const k = 42;", "// #enddocregion"].join("\n"),
    );

    writeFixture(
      docs,
      "page.md",
      [
        '<?code-excerpt "lib/a.dart"?>',
        "",
        "```dart",
        "placeholder",
        "```",
        "",
      ].join("\n"),
    );

    const pathBaseRel = relative(process.cwd(), src);
    expect(pathBaseRel).not.toMatch(/^\.\.($|[/\\])/);
    expect(pathBaseRel.length).toBeGreaterThan(0);

    const result = await updatePaths([docs], { pathBase: pathBaseRel });

    expect(result.errors, result.errors.join("\n")).toEqual([]);
    expect(result.filesUpdated).toBe(1);
    expect(readFileSync(join(docs, "page.md"), "utf8")).toContain(
      "const k = 42;",
    );
  });

  it("leaves unchanged files untouched (no write)", async () => {
    const tmp = useTmp();
    const src = join(tmp, "src");
    const docs = join(tmp, "docs");

    writeFixture(
      src,
      "a.dart",
      ["// #docregion", "final x = 1;", "// #enddocregion"].join("\n"),
    );

    const md = [
      '<?code-excerpt "a.dart"?>',
      "",
      "```dart",
      "final x = 1;",
      "```",
      "",
    ].join("\n");
    writeFixture(docs, "already-ok.md", md);

    const result = await updatePaths([docs], { pathBase: src });

    expect(result.filesProcessed).toBe(1);
    expect(result.filesUpdated).toBe(0);
    expect(readFileSync(join(docs, "already-ok.md"), "utf8")).toBe(md);
  });

  it("processes multiple files in a directory tree", async () => {
    const tmp = useTmp();
    const src = join(tmp, "src");
    const docs = join(tmp, "docs");

    writeFixture(src, "f.dart", "// #docregion\nA\n// #enddocregion\n");

    const mdTemplate = [
      '<?code-excerpt "f.dart"?>',
      "",
      "```dart",
      "old",
      "```",
      "",
    ].join("\n");
    writeFixture(docs, "one.md", mdTemplate);
    writeFixture(docs, "sub/two.md", mdTemplate);

    const result = await updatePaths([docs], { pathBase: src });

    expect(result.filesProcessed).toBe(2);
    expect(result.filesUpdated).toBe(2);
  });

  it("skips dot-prefixed directories", async () => {
    const tmp = useTmp();
    const docs = join(tmp, "docs");

    writeFixture(docs, ".hidden/skip.md", '<?code-excerpt "x"?>\n```\n```\n');
    writeFixture(docs, "visible.md", "no PI here\n");

    const result = await updatePaths([docs]);

    expect(result.filesProcessed).toBe(1);
  });

  it("respects --exclude patterns", async () => {
    const tmp = useTmp();
    const docs = join(tmp, "docs");

    writeFixture(docs, "keep.md", "no PI\n");
    writeFixture(docs, "vendor/skip.md", "no PI\n");

    const result = await updatePaths([docs], {
      exclude: [/vendor/],
    });

    expect(result.filesProcessed).toBe(1);
  });

  it("skips markdown when the sole root is a dot-prefixed directory", async () => {
    const tmp = useTmp();
    const root = join(tmp, ".hidden");
    mkdirSync(root, { recursive: true });
    writeFixture(root, "x.md", "no PI\n");

    const result = await updatePaths([root]);

    expect(result.filesProcessed).toBe(0);
  });

  it("skips markdown when the sole root matches --exclude", async () => {
    const tmp = useTmp();
    const root = join(tmp, "vendor");
    mkdirSync(root, { recursive: true });
    writeFixture(root, "x.md", "no PI\n");

    const result = await updatePaths([root], { exclude: [/vendor/] });

    expect(result.filesProcessed).toBe(0);
  });

  it("dry-run does not write files", async () => {
    const tmp = useTmp();
    const src = join(tmp, "src");
    const docs = join(tmp, "docs");

    writeFixture(src, "a.dart", "// #docregion\nNEW\n// #enddocregion\n");
    const original = [
      '<?code-excerpt "a.dart"?>',
      "",
      "```dart",
      "OLD",
      "```",
      "",
    ].join("\n");
    writeFixture(docs, "dry.md", original);

    const result = await updatePaths([docs], {
      pathBase: src,
      dryRun: true,
    });

    expect(result.filesUpdated).toBe(1);
    expect(readFileSync(join(docs, "dry.md"), "utf8")).toBe(original);
  });

  it("collects errors for missing source files", async () => {
    const tmp = useTmp();
    const docs = join(tmp, "docs");

    writeFixture(
      docs,
      "bad.md",
      ['<?code-excerpt "missing.dart"?>', "", "```", "keep", "```", ""].join(
        "\n",
      ),
    );

    const result = await updatePaths([docs]);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/cannot read source file/);
  });

  it("records an error when a root path does not exist", async () => {
    const missing = join(
      process.cwd(),
      `no-such-dir-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    expect(existsSync(missing)).toBe(false);

    const result = await updatePaths([missing]);

    expect(result.filesProcessed).toBe(0);
    expect(result.filesUpdated).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/ENOENT|no such file|not found/i);
  });

  it("still processes existing roots when another root path is missing", async () => {
    const tmp = useTmp();
    const docs = join(tmp, "docs");
    writeFixture(docs, "ok.md", "no PI\n");

    const missing = join(
      process.cwd(),
      `no-such-dir-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    expect(existsSync(missing)).toBe(false);

    const result = await updatePaths([missing, docs]);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.filesProcessed).toBe(1);
    expect(result.filesUpdated).toBe(0);
  });

  it("accepts individual files as paths", async () => {
    const tmp = useTmp();
    writeFixture(tmp, "single.md", "no PI here\n");

    const result = await updatePaths([join(tmp, "single.md")]);

    expect(result.filesProcessed).toBe(1);
    expect(result.filesUpdated).toBe(0);
  });

  it("skips non-md files when given a directory", async () => {
    const tmp = useTmp();
    writeFixture(tmp, "readme.md", "no PI\n");
    writeFixture(tmp, "code.ts", "const x = 1;\n");
    writeFixture(tmp, "data.json", "{}\n");

    const result = await updatePaths([tmp]);

    expect(result.filesProcessed).toBe(1);
  });

  it("passes globalReplace through to injectMarkdown", async () => {
    const tmp = useTmp();
    const src = join(tmp, "src");
    const docs = join(tmp, "docs");

    writeFixture(src, "r.dart", "// #docregion\nhello\n// #enddocregion\n");
    writeFixture(
      docs,
      "gr.md",
      ['<?code-excerpt "r.dart"?>', "", "```dart", "old", "```", ""].join("\n"),
    );

    await updatePaths([docs], {
      pathBase: src,
      globalReplace: "/hello/world/g",
    });

    const updated = readFileSync(join(docs, "gr.md"), "utf8");
    expect(updated).toContain("world");
    expect(updated).not.toContain("hello");
  });
});

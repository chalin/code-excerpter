import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { injectMarkdown, type MarkdownInjectContext } from "../src/inject.js";
import { createDartUpdaterReadFile } from "./helpers/dartUpdaterReadFile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(__dirname, "fixtures/code-excerpt-updater");
const TEST_DATA = join(FIXTURE_ROOT, "test_data");
/** Last-run inject output; diff against `test_data/expected/` (same relative path). */
const GENERATED = join(FIXTURE_ROOT, "generated");

/** Remove prior run output; keep committed `.gitkeep` so the directory stays in git. */
function clearGeneratedOutput(): void {
  if (!existsSync(GENERATED)) {
    mkdirSync(GENERATED, { recursive: true });
    return;
  }
  for (const name of readdirSync(GENERATED)) {
    if (name === ".gitkeep" || name === ".gitignore") continue;
    rmSync(join(GENERATED, name), { recursive: true, force: true });
  }
}

function readSrc(rel: string): string {
  return readFileSync(join(TEST_DATA, "src", rel), "utf8");
}

function readExpected(rel: string): string {
  const expPath = join(TEST_DATA, "expected", rel);
  if (existsSync(expPath)) {
    return readFileSync(expPath, "utf8");
  }
  return readSrc(rel);
}

function assertGolden(
  relFromSrc: string,
  ctx: Omit<MarkdownInjectContext, "readFile"> &
    Pick<MarkdownInjectContext, "readFile">,
): void {
  const input = readSrc(relFromSrc);
  const want = readExpected(relFromSrc);
  const got = injectMarkdown(input, ctx);

  const outPath = join(GENERATED, relFromSrc);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, got, "utf8");

  expect(got).toBe(want);
}

describe("code_excerpt_updater goldens", () => {
  beforeAll(() => {
    clearGeneratedOutput();
  });

  const defaultRead = createDartUpdaterReadFile({
    fragmentDir: join(TEST_DATA, "frag"),
    srcDir: join(TEST_DATA, "diff_src"),
    excerptsYaml: false,
  });

  const defaultCtx: MarkdownInjectContext = {
    readFile: defaultRead,
  };

  const noChange = [
    "no_change/basic_diff.dart",
    "no_change/basic_no_region.dart",
    "no_change/basic_with_args.md",
    "no_change/basic_with_region.dart",
    "no_change/diff.md",
    "no_change/frag_not_found.dart",
    "no_change/invalid_code_block.dart",
    "no_change/invalid_code_excerpt_arg.dart",
    "no_change/missing_code_block.dart",
    "no_change/no_comment_prefix.md",
    "no_change/no_path.md",
    "no_change/no_src.dart",
    "no_change/prettify.md",
    "no_change/skip-and-take.md",
  ];

  it.each(noChange)("no_change: %s", (rel) => {
    assertGolden(rel, defaultCtx);
  });

  const codeUpdates = [
    "arg-order.md",
    "basic_no_region.dart",
    "basic_with_empty_region.md",
    "basic_with_region.dart",
    "escape_ng_interpolation.md",
    "fragment-indentation.md",
    "language-tour.md",
    "list.md",
    "no_comment_prefix.md",
    "prettify.md",
    "remove.md",
    "retain.md",
  ];

  it.each(codeUpdates)("code updates: %s", (rel) => {
    assertGolden(rel, defaultCtx);
  });

  it("trim.dart (trailing whitespace fragment)", () => {
    assertGolden("trim.dart", defaultCtx);
  });

  it("set_path.md (path-base over test_data root)", () => {
    const readFile = createDartUpdaterReadFile({
      fragmentDir: TEST_DATA,
      srcDir: TEST_DATA,
      excerptsYaml: false,
    });
    assertGolden("set_path.md", { readFile });
  });

  it("defaultIndentation: no_change/basic_diff.dart", () => {
    assertGolden("no_change/basic_diff.dart", {
      readFile: defaultRead,
      defaultIndentation: 2,
    });
  });

  it("no_escape_ng_interpolation.md", () => {
    assertGolden("no_escape_ng_interpolation.md", {
      ...defaultCtx,
      escapeNgInterpolation: false,
    });
  });

  it("src_but_no_frag.md", () => {
    const readFile = createDartUpdaterReadFile({
      fragmentDir: join(TEST_DATA, "fragDNE"),
      srcDir: join(TEST_DATA, "diff_src"),
      excerptsYaml: false,
    });
    assertGolden("src_but_no_frag.md", { readFile });
  });

  const excerptYamlDir = join(TEST_DATA, "excerpt_yaml");
  const excerptYamlCtx: MarkdownInjectContext = {
    readFile: createDartUpdaterReadFile({
      fragmentDir: excerptYamlDir,
      srcDir: excerptYamlDir,
      excerptsYaml: true,
    }),
    excerptsYaml: true,
  };

  it.each(["excerpt_yaml.md", "plaster.md"])(
    "excerpt yaml defaults: %s",
    (rel) => {
      assertGolden(rel, excerptYamlCtx);
    },
  );

  it("plaster-global-option.md", () => {
    assertGolden("plaster-global-option.md", {
      ...excerptYamlCtx,
      globalPlasterTemplate: "// Insert your code here $defaultPlaster",
    });
  });

  it("replace.md (CLI-style global replace)", () => {
    const readFile = createDartUpdaterReadFile({
      fragmentDir: join(TEST_DATA, "frag"),
      srcDir: join(TEST_DATA, "diff_src"),
      excerptsYaml: false,
    });
    assertGolden("replace.md", {
      readFile,
      globalReplace: String.raw`/mundo/$&!/g`,
    });
  });

  it.skip("basic_with_region.jade (Jade/Pug dropped from v1 scope)", () => {
    assertGolden("basic_with_region.jade", {
      ...defaultCtx,
      defaultIndentation: 2,
    });
  });
});

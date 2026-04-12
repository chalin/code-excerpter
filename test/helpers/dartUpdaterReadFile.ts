/**
 * Mirrors {@link https://github.com/chalin/code_excerpt_updater/blob/main/lib/src/excerpt_getter.dart | Dart `ExcerptGetter`}
 * resolution for golden tests (fragment `.txt` layout, optional `.excerpt.yaml`, then source).
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { parse as parseYaml } from "yaml";

const YAML_EXT = ".excerpt.yaml";
const BORDER_KEY = "#border";

function fragmentRelativePath(merged: string, region: string): string {
  const norm = merged.replace(/\\/g, "/");
  if (!region) {
    return `${norm}.txt`;
  }
  const d = dirname(norm);
  const base = basename(norm);
  const ext = extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  const fragName = `${stem}-${region}${ext}.txt`;
  return d === "." ? fragName : join(d, fragName).replace(/\\/g, "/");
}

function applyYamlBorder(content: string, border: string): string {
  if (border === "") return content;
  return content
    .split("\n")
    .map((line) => (line.startsWith(border) ? line.slice(1) : line))
    .join("\n");
}

/**
 * @param fragmentDir - Dart `fragmentDirPath` (absolute)
 * @param srcDir - Dart `srcDirPath` (absolute). When Dart passes `''`, pass the same
 *   directory you use for fallbacks (often `join(testData, "diff_src")`).
 */
export function createDartUpdaterReadFile(opts: {
  fragmentDir: string;
  srcDir: string;
  excerptsYaml: boolean;
}): (resolvedPath: string, region?: string) => string | null {
  const { fragmentDir, srcDir, excerptsYaml } = opts;

  return (resolvedPath: string, region = ""): string | null => {
    const merged = resolvedPath.replace(/\\/g, "/");
    const normRegion = region ?? "";

    if (excerptsYaml) {
      const yamlPath = join(fragmentDir, merged + YAML_EXT);
      if (existsSync(yamlPath)) {
        const doc = parseYaml(readFileSync(yamlPath, "utf8")) as Record<
          string,
          unknown
        >;
        let border = "";
        const b = doc[BORDER_KEY];
        if (typeof b === "string") border = b;
        const raw = doc[normRegion];
        if (raw === undefined || raw === null) {
          return null;
        }
        if (typeof raw !== "string") {
          return null;
        }
        const trimmed = raw.trimEnd();
        return applyYamlBorder(trimmed, border);
      }
      if (normRegion !== "") {
        return null;
      }
      const plain = join(fragmentDir, merged);
      if (!existsSync(plain)) {
        return null;
      }
      return readFileSync(plain, "utf8");
    }

    const fragRel = fragmentRelativePath(merged, normRegion);
    const fragPath = join(fragmentDir, fragRel);
    if (existsSync(fragPath)) {
      return readFileSync(fragPath, "utf8");
    }
    if (normRegion !== "") {
      return null;
    }
    const srcPath = join(srcDir, merged);
    if (existsSync(srcPath)) {
      return readFileSync(srcPath, "utf8");
    }
    return null;
  };
}

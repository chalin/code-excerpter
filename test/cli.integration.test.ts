/**
 * Spawns the published CLI entry (`dist/cli.js` via `node`) so tests match the
 * `code-excerpter` binary and avoid `tsx` IPC restrictions in sandboxes. Run
 * `npm run test:base` / `npm run test:watch` so `pretest:*` builds `dist/` first.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const TMP_ROOT = join(repoRoot, "tmp");
const cliDist = join(repoRoot, "dist", "cli.js");
const pkgVersion = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
).version as string;

beforeAll(() => {
  if (!existsSync(cliDist)) {
    throw new Error(
      `Missing ${cliDist}. Run \`npm run build\` first, or use \`npm run test:base\` / \`npm run test:watch\` (pretest builds dist).`,
    );
  }
});

function runCli(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  status: number | null;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliDist, ...args], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (c: string) => {
      stdout += c;
    });
    child.stderr?.on("data", (c: string) => {
      stderr += c;
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ stdout, stderr, status }));
  });
}

const workDirs: string[] = [];
function useWorkDir(): string {
  mkdirSync(TMP_ROOT, { recursive: true });
  const dir = mkdtempSync(join(TMP_ROOT, "ce-cli-"));
  workDirs.push(dir);
  return dir;
}

const keepTestTmp =
  process.env.KEEP_TEST_TMP === "1" || process.env.KEEP_TEST_TMP === "true";

afterEach(() => {
  if (!keepTestTmp) {
    for (const d of workDirs) {
      if (existsSync(d)) rmSync(d, { recursive: true, force: true });
    }
  }
  workDirs.length = 0;
});

describe("CLI (integration)", () => {
  it("prints --help on stdout and exits 0", async () => {
    const { stdout, stderr, status } = await runCli(["--help"]);
    expect(status, "exit code").toBe(0);
    expect(stdout).toMatch(/Usage:\s+code-excerpter/);
    expect(stdout).toMatch(/--dry-run/);
    expect(stderr, "help should not spam stderr").toBe("");
  });

  it("prints --version on stdout and exits 0", async () => {
    const { stdout, stderr, status } = await runCli(["--version"]);
    expect(status, "exit code").toBe(0);
    expect(stdout.trim()).toBe(pkgVersion);
    expect(stderr, "version should not spam stderr").toBe("");
  });

  it("rejects -V (no short version flag)", async () => {
    const { stdout, stderr, status } = await runCli(["-V"]);
    expect(status, "exit code").not.toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toMatch(/unknown option|error:/i);
  });

  it("reports invalid --exclude on stderr and exits 1 without a stack trace", async () => {
    const work = useWorkDir();
    const { stdout, stderr, status } = await runCli(["--exclude", "[", work]);
    expect(status, "exit code").toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toMatch(/^error: invalid --exclude pattern/);
    expect(stderr).toMatch(/Invalid regular expression/i);
    expect(stderr).not.toMatch(/\n\s+at\s+/);
  });

  it("exits 1 under --fail-on-update --dry-run when a file would change", async () => {
    const work = useWorkDir();
    const src = join(work, "src");
    const docs = join(work, "docs");
    mkdirSync(src, { recursive: true });
    mkdirSync(docs, { recursive: true });
    writeFileSync(
      join(src, "a.dart"),
      "// #docregion\nNEW\n// #enddocregion\n",
      "utf8",
    );
    const md = [
      '<?code-excerpt "a.dart"?>',
      "",
      "```dart",
      "OLD",
      "```",
      "",
    ].join("\n");
    const mdPath = join(docs, "page.md");
    writeFileSync(mdPath, md, "utf8");

    const { stdout, stderr, status } = await runCli([
      "-p",
      src,
      "--dry-run",
      "--fail-on-update",
      docs,
    ]);

    expect(status, "exit code").toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toMatch(/needs update:/);
    expect(stderr).toMatch(
      /1 file\(s\) processed, 1 updated, \d+ error\(s\), \d+ warning\(s\); \d+ set directive\(s\), 1 fragment directive\(s\)/,
    );
    expect(readFileSync(mdPath, "utf8")).toBe(md);
  });
});

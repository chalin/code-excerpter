/**
 * Spawns the real CLI (`tsx` + `src/cli.ts`) so Commander wiring, exit codes,
 * and stderr shape are covered beyond unit tests.
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
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const TMP_ROOT = join(repoRoot, "tmp");
const tsxCli = join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
const cliEntry = join(repoRoot, "src", "cli.ts");

function runCli(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  status: number | null;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, cliEntry, ...args], {
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
    expect(stderr).toMatch(/1 file\(s\) processed,\s*1 updated/);
    expect(readFileSync(mdPath, "utf8")).toBe(md);
  });
});

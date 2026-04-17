import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { updatePaths } from '../src/update.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(__dirname, 'fixtures', 'updater');
const GENERATED_ROOT = join(__dirname, 'generated', 'updater');

interface FixtureCaseOptions {
  pathBase?: string;
  targets: string[];
  defaultIndentation?: number;
  globalReplace?: string;
  globalPlasterTemplate?: string;
  escapeNgInterpolation?: boolean;
}

function clearGeneratedOutput(): void {
  rmSync(GENERATED_ROOT, { recursive: true, force: true });
  mkdirSync(GENERATED_ROOT, { recursive: true });
}

function caseNames(): string[] {
  return readdirSync(FIXTURE_ROOT)
    .filter((name) => statSync(join(FIXTURE_ROOT, name)).isDirectory())
    .sort();
}

function loadOptions(caseName: string): FixtureCaseOptions {
  const raw = readFileSync(
    join(FIXTURE_ROOT, caseName, 'options.yaml'),
    'utf8',
  );
  return parseYaml(raw) as FixtureCaseOptions;
}

function listFiles(root: string, rel = ''): string[] {
  if (!existsSync(root)) return [];
  const dir = join(root, rel);
  const entries = readdirSync(dir).sort();
  const files: string[] = [];
  for (const entry of entries) {
    const nextRel = rel ? join(rel, entry) : entry;
    const next = join(root, nextRel);
    if (statSync(next).isDirectory()) {
      files.push(...listFiles(root, nextRel));
    } else {
      files.push(nextRel);
    }
  }
  return files;
}

function isGeneratedOutputFile(rel: string): boolean {
  return rel.split(/[\\/]/, 1)[0] !== 'sources';
}

function writeTestFile(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

function assertGeneratedOutputMatchesExpected(
  workRoot: string,
  expectedRoot: string,
): void {
  const expectedFiles = listFiles(expectedRoot);
  expect(expectedFiles.length).toBeGreaterThan(0);
  const actualFiles = listFiles(workRoot).filter(isGeneratedOutputFile);
  expect(actualFiles).toStrictEqual(expectedFiles);
  for (const rel of expectedFiles) {
    const want = readFileSync(join(expectedRoot, rel), 'utf8');
    const got = readFileSync(join(workRoot, rel), 'utf8');
    expect(got).toBe(want);
  }
}

async function assertFixtureCase(caseName: string): Promise<void> {
  const caseRoot = join(FIXTURE_ROOT, caseName);
  const inputRoot = join(caseRoot, 'input');
  const sourcesRoot = join(caseRoot, 'sources');
  const expectedRoot = join(caseRoot, 'expected');
  const workRoot = join(GENERATED_ROOT, caseName);
  const options = loadOptions(caseName);

  cpSync(inputRoot, workRoot, { recursive: true });
  if (existsSync(sourcesRoot)) {
    cpSync(sourcesRoot, join(workRoot, 'sources'), { recursive: true });
  }

  const targets = options.targets.map((rel) => join(workRoot, rel));
  const result = await updatePaths(targets, {
    pathBase:
      options.pathBase === undefined
        ? undefined
        : join(workRoot, options.pathBase),
    defaultIndentation: options.defaultIndentation,
    globalReplace: options.globalReplace ?? undefined,
    globalPlasterTemplate: options.globalPlasterTemplate ?? undefined,
    escapeNgInterpolation: options.escapeNgInterpolation,
  });

  expect(result.errors).toStrictEqual([]);
  assertGeneratedOutputMatchesExpected(workRoot, expectedRoot);
}

describe('updater fixture cases', () => {
  beforeAll(() => {
    clearGeneratedOutput();
  });

  it('matches all fixture cases', async () => {
    for (const caseName of caseNames()) {
      await assertFixtureCase(caseName);
    }
  });
});

describe('generated output assertions', () => {
  it('fails when the generated tree contains an unexpected output file', () => {
    const workRoot = join(GENERATED_ROOT, 'sanity-extra-output');
    const expectedRoot = join(GENERATED_ROOT, 'sanity-extra-output-expected');

    rmSync(workRoot, { recursive: true, force: true });
    rmSync(expectedRoot, { recursive: true, force: true });

    try {
      writeTestFile(workRoot, 'doc.md', 'ok\n');
      writeTestFile(workRoot, 'extra.md', 'unexpected\n');
      writeTestFile(workRoot, 'sources/keep.txt', 'ignored\n');
      writeTestFile(expectedRoot, 'doc.md', 'ok\n');

      expect(() => assertGeneratedOutputMatchesExpected(workRoot, expectedRoot))
        .toThrowErrorMatchingInlineSnapshot(`
        [AssertionError: expected [ 'doc.md', 'extra.md' ] to strictly equal [ 'doc.md' ]]
      `);
    } finally {
      rmSync(workRoot, { recursive: true, force: true });
      rmSync(expectedRoot, { recursive: true, force: true });
    }
  });
});

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
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

  const expectedFiles = listFiles(expectedRoot);
  expect(expectedFiles.length).toBeGreaterThan(0);
  for (const rel of expectedFiles) {
    const want = readFileSync(join(expectedRoot, rel), 'utf8');
    const got = readFileSync(join(workRoot, rel), 'utf8');
    expect(got).toBe(want);
  }
}

describe('updater fixture cases', () => {
  beforeAll(() => {
    clearGeneratedOutput();
  });

  it.each(caseNames())('%s', async (caseName) => {
    await assertFixtureCase(caseName);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import {
  formatExcerptYamlReadError,
  tryReadExcerptYamlSidecar,
} from '../src/helpers/excerptYaml.ts';
import {
  injectMarkdown,
  PROC_INSTR_RE,
  type MarkdownInjectContext,
} from '../src/index.ts';

const DEFAULT_WORKTREE = resolve('tmp/site-www-phase6');

const CODE_BLOCK_START =
  /^\s*(?:\/\/\/?)?\s*(?<token>`{3,}|~{3,}|{%-?\s*prettify(\s+.*)?-?%})/;
const CODE_BLOCK_END =
  /^\s*(?:\/\/\/?)?\s*(?<token>`{3,}|~{3,}|{%-?\s*endprettify\s*-?%})/;

const defaultSourceTransforms: Array<(text: string) => string> = [
  (text) => text.replaceAll('//!<br>', ''),
  (text) => text.replaceAll(/ellipsis(<\w+>)?(\(\))?;?/g, '...'),
  (text) => text.replaceAll(/\/\*(\s*\.\.\.\s*)\*\//g, '$1'),
  // Mirrors the upstream workaround that trims trailing blank lines after
  // formatter-introduced block-close whitespace.
  (text) => text.replaceAll(/[\r\n]+$/g, ''),
];

interface RunResult {
  filesProcessed: number;
  filesNeedingUpdate: number;
  errors: string[];
  warnings: string[];
}

interface CliOptions {
  docsRoot: string;
  examplesRoot: string;
  write: boolean;
  targets: string[];
  worktree: string;
}

function applyDefaultSourceTransforms(text: string): string {
  return defaultSourceTransforms.reduce(
    (working, transform) => transform(working),
    text,
  );
}

function fenceKind(token: string): 'backtick' | 'tilde' | 'prettify' {
  if (token.startsWith('`')) return 'backtick';
  if (token.startsWith('~')) return 'tilde';
  return 'prettify';
}

function isMatchingFence(openingToken: string, closingToken: string): boolean {
  const openKind = fenceKind(openingToken);
  if (fenceKind(closingToken) !== openKind) return false;
  if (openKind === 'prettify') return true;
  return closingToken.length >= openingToken.length;
}

function consumeFenceBlock(queue: string[]): {
  closed: boolean;
  lines: string[];
} {
  if (queue.length === 0) return { closed: false, lines: [] };
  const opening = queue.shift()!;
  const openingToken = CODE_BLOCK_START.exec(opening)?.groups?.token;
  if (openingToken === undefined) return { closed: false, lines: [opening] };

  const inner: string[] = [];
  while (queue.length > 0) {
    const line = queue[0]!;
    const closingToken = CODE_BLOCK_END.exec(line)?.groups?.token;
    if (
      closingToken !== undefined &&
      isMatchingFence(openingToken, closingToken)
    ) {
      queue.shift();
      return { closed: true, lines: [opening, ...inner, line] };
    }
    inner.push(queue.shift()!);
  }

  return { closed: false, lines: [opening, ...inner] };
}

function applyDefaultTransformsToExcerptBlocks(markdown: string): string {
  const queue = markdown.split('\n');
  const out: string[] = [];

  while (queue.length > 0) {
    const line = queue.shift()!;
    out.push(line);
    if (!PROC_INSTR_RE.test(line)) continue;

    while (queue.length > 0 && /^\s*$/.test(queue[0]!)) {
      out.push(queue.shift()!);
    }

    const block = consumeFenceBlock(queue);
    if (block.lines.length === 0) continue;
    if (!block.closed) {
      out.push(...block.lines);
      continue;
    }

    const [opening, ...mid] = block.lines;
    const closing = mid.pop()!;
    const transformedInner = applyDefaultSourceTransforms(mid.join('\n')).split(
      '\n',
    );
    out.push(opening, ...transformedInner, closing);
  }

  return out.join('\n');
}

function normalizeForCompare(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

function trailingNewlineCount(text: string): number {
  let count = 0;
  for (let i = text.length - 1; i >= 0 && text[i] === '\n'; i--) {
    count++;
  }
  return count;
}

function normalizeForWrite(text: string, original: string): string {
  const trimmed = normalizeForCompare(text).replace(/\n+$/g, '');
  return `${trimmed}${'\n'.repeat(trailingNewlineCount(original))}`;
}

function excerptYamlErrorKey(resolvedPath: string, region = ''): string {
  return `${resolvedPath}\0${region}`;
}

function createReadAccessors(
  srcRoot: string,
): Pick<MarkdownInjectContext, 'readFile' | 'readError'> {
  let lastReadError: { key: string; message: string } | null = null;

  return {
    readFile: (resolvedPath: string, region = ''): string | null => {
      const key = excerptYamlErrorKey(resolvedPath, region);
      if (lastReadError?.key === key) {
        lastReadError = null;
      }

      try {
        const sidecar = tryReadExcerptYamlSidecar(
          srcRoot,
          resolvedPath,
          region,
        );
        if (sidecar.status === 'found') {
          return applyDefaultSourceTransforms(sidecar.excerpt);
        }
        if (sidecar.status === 'file-not-found') {
          return applyDefaultSourceTransforms(
            readFileSync(resolve(srcRoot, resolvedPath), 'utf8'),
          );
        }

        lastReadError = {
          key,
          message: formatExcerptYamlReadError(
            resolvedPath,
            region,
            sidecar.status,
          ),
        };
        return null;
      } catch {
        return null;
      }
    },
    readError: (resolvedPath: string, region = ''): string | null =>
      lastReadError?.key === excerptYamlErrorKey(resolvedPath, region)
        ? lastReadError.message
        : null,
  };
}

async function collectMarkdownFiles(root: string): Promise<string[]> {
  const info = await stat(root);
  if (!info.isDirectory()) return [];

  const result: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await collectMarkdownFiles(full)));
      continue;
    }
    if (entry.isFile() && full.endsWith('.md')) {
      result.push(full);
    }
  }
  return result;
}

function parseArgs(argv: string[]): CliOptions {
  let worktree = DEFAULT_WORKTREE;
  const passthrough: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--root') {
      const next = argv[++i];
      if (next === undefined) {
        throw new Error('missing value for --root');
      }
      worktree = resolve(next);
      continue;
    }
    passthrough.push(arg);
  }

  const write = passthrough.includes('--write');
  const targets = passthrough.filter((arg) => arg !== '--write');
  return {
    docsRoot: join(worktree, 'src', 'content'),
    examplesRoot: join(worktree, 'examples'),
    write,
    targets,
    worktree,
  };
}

function resolveTargets(targets: string[], docsRoot: string): string[] {
  return targets.map((target) =>
    resolve(target.startsWith(docsRoot) ? target : join(docsRoot, target)),
  );
}

async function run(options: CliOptions): Promise<RunResult> {
  if (!existsSync(options.worktree)) {
    throw new Error(`missing worktree: ${options.worktree}`);
  }

  const files =
    options.targets.length === 0
      ? (await collectMarkdownFiles(options.docsRoot)).sort()
      : resolveTargets(options.targets, options.docsRoot).sort();

  const result: RunResult = {
    filesProcessed: 0,
    filesNeedingUpdate: 0,
    errors: [],
    warnings: [],
  };

  for (const filePath of files) {
    const readAccessors = createReadAccessors(options.examplesRoot);
    const ctx: MarkdownInjectContext = {
      ...readAccessors,
      instructionStats: { set: 0, fragment: 0 },
      onWarning: (msg) =>
        result.warnings.push(`${relative(options.worktree, filePath)}: ${msg}`),
      onError: (msg) =>
        result.errors.push(`${relative(options.worktree, filePath)}: ${msg}`),
    };

    result.filesProcessed++;
    const original = await readFile(filePath, 'utf8');
    const updated = applyDefaultTransformsToExcerptBlocks(
      injectMarkdown(original, ctx),
    );
    if (normalizeForCompare(updated) !== normalizeForCompare(original)) {
      result.filesNeedingUpdate++;
      console.log(`needs update: ${relative(options.worktree, filePath)}`);
      if (options.write) {
        await writeFile(filePath, normalizeForWrite(updated, original), 'utf8');
      }
    }
  }

  return result;
}

const result = await run(parseArgs(process.argv.slice(2)));
console.log(
  [
    `${result.filesProcessed} file(s) processed`,
    `${result.filesNeedingUpdate} need update`,
    `${result.errors.length} error(s)`,
    `${result.warnings.length} warning(s)`,
  ].join(', '),
);

if (result.errors.length > 0) {
  for (const err of result.errors) console.error(`error: ${err}`);
}
if (result.warnings.length > 0) {
  for (const warning of result.warnings) console.error(`warning: ${warning}`);
}

if (result.errors.length > 0 || result.filesNeedingUpdate > 0) {
  process.exitCode = 1;
}

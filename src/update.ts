/**
 * Directory walking and file updating. Finds markdown files, runs
 * {@link injectMarkdown}, and writes back if content changed.
 *
 * Dart source: `dart-lang/site-shared/pkgs/excerpter/lib/src/update.dart`
 */

import { readFileSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import {
  formatExcerptYamlReadError,
  tryReadExcerptYamlSidecar,
} from './helpers/excerptYaml.js';
import { injectMarkdown, type MarkdownInjectContext } from './inject.js';
import type { InstructionStats } from './instructionStats.js';

const MD_EXT = /\.md$/;
const DOT_SEGMENT = /(^|[/\\])\./;

export interface UpdateOptions {
  /**
   * Directory used as the root when reading excerpt sources from disk (default
   * `""`, i.e. cwd). Resolved once for `readFile`; not forwarded to
   * `injectMarkdown` as `MarkdownInjectContext.pathBase`, so relative values are
   * not joined twice with paths from processing instructions.
   */
  pathBase?: string;
  /** Regex patterns; paths matching any are skipped (tested against the relative path). */
  exclude?: RegExp[];
  /** When `true`, report what would change but do not write (default `false`). */
  dryRun?: boolean;
  /** Escape Angular `{{`/`}}` in injected code (default `true`). */
  escapeNgInterpolation?: boolean;
  /** Global replace expression applied after per-instruction + file-level transforms. */
  globalReplace?: string;
  /** Default plaster template when the PI / file-level set does not override it. */
  globalPlasterTemplate?: string;
  log?: (msg: string) => void;
}

export type { InstructionStats } from './instructionStats.js';

export interface UpdateResult {
  filesProcessed: number;
  filesUpdated: number;
  errors: string[];
  warnings: string[];
  /** Totals across all processed markdown files. */
  instructionStats: InstructionStats;
}

function shouldExclude(relPath: string, patterns: RegExp[]): boolean {
  if (DOT_SEGMENT.test(relPath)) return true;
  return patterns.some((re) => re.test(relPath));
}

function excerptYamlErrorKey(resolvedPath: string, region = ''): string {
  return `${resolvedPath}\0${region}`;
}

/**
 * Builds a synchronous `readFile` for {@link MarkdownInjectContext}: resolves
 * paths relative to `srcRoot`. If `<path>.excerpt.yaml` contains the requested
 * region key, it reads excerpt text from that file; otherwise it falls back to
 * the plain source file.
 */
function createDiskReadAccessors(
  srcRoot: string,
): Pick<MarkdownInjectContext, 'readFile' | 'readError'> {
  const lastReadErrors = new Map<string, string>();

  return {
    readFile: (resolvedPath: string, region = ''): string | null => {
      const key = excerptYamlErrorKey(resolvedPath, region);
      lastReadErrors.delete(key);

      try {
        const sidecar = tryReadExcerptYamlSidecar(
          srcRoot,
          resolvedPath,
          region,
        );
        if (sidecar.status === 'found') return sidecar.excerpt;
        if (sidecar.status === 'file-not-found') {
          return readFileSync(resolve(srcRoot, resolvedPath), 'utf8');
        }

        lastReadErrors.set(
          key,
          formatExcerptYamlReadError(resolvedPath, region, sidecar.status),
        );
        return null;
      } catch {
        return null;
      }
    },
    readError: (resolvedPath: string, region = ''): string | null =>
      lastReadErrors.get(excerptYamlErrorKey(resolvedPath, region)) ?? null,
  };
}

async function collectMarkdownFiles(
  root: string,
  baseForRel: string,
  exclude: RegExp[],
): Promise<string[]> {
  const absRoot = resolve(root);
  const info = await stat(absRoot);
  if (!info.isDirectory()) {
    const rel = relative(baseForRel, absRoot);
    if (shouldExclude(rel, exclude)) return [];
    if (MD_EXT.test(absRoot)) return [absRoot];
    return [];
  }
  const result: string[] = [];
  const entries = await readdir(absRoot, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(absRoot, entry.name);
    const rel = relative(baseForRel, full);
    if (shouldExclude(rel, exclude)) continue;
    if (entry.isDirectory()) {
      result.push(...(await collectMarkdownFiles(full, baseForRel, exclude)));
    } else if (entry.isFile() && MD_EXT.test(entry.name)) {
      result.push(full);
    }
  }
  return result;
}

/**
 * Processes one or more paths (files or directories): finds `.md` files, runs
 * {@link injectMarkdown} on each, and writes back when content changed.
 * Collected files are deduped by absolute path (overlapping or repeated roots
 * do not run inject twice on the same file).
 */
export async function updatePaths(
  paths: string[],
  options?: UpdateOptions,
): Promise<UpdateResult> {
  const opts = options ?? {};
  const exclude = opts.exclude ?? [];
  const dryRun = opts.dryRun ?? false;
  const log = opts.log ?? (() => {});
  const srcRoot = resolve(opts.pathBase ?? '');
  const instructionStats: InstructionStats = { set: 0, fragment: 0 };
  const result: UpdateResult = {
    filesProcessed: 0,
    filesUpdated: 0,
    errors: [],
    warnings: [],
    instructionStats,
  };

  const allFiles: string[] = [];
  for (const p of paths) {
    const abs = resolve(p);
    try {
      allFiles.push(
        ...(await collectMarkdownFiles(abs, dirname(abs), exclude)),
      );
    } catch (err) {
      const msg = `error: ${abs}: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      log(msg);
    }
  }
  allFiles.sort();
  const uniqueFiles = [...new Set(allFiles)];

  for (const filePath of uniqueFiles) {
    const readAccessors = createDiskReadAccessors(srcRoot);
    const ctx: MarkdownInjectContext = {
      ...readAccessors,
      escapeNgInterpolation: opts.escapeNgInterpolation,
      globalReplace: opts.globalReplace,
      globalPlasterTemplate: opts.globalPlasterTemplate,
      instructionStats,
      onWarning: (msg) => {
        const w = `warning: ${filePath}: ${msg}`;
        result.warnings.push(w);
        log(w);
      },
      onError: (msg) => {
        const e = `error: ${filePath}: ${msg}`;
        result.errors.push(e);
        log(e);
      },
    };

    result.filesProcessed++;
    try {
      const original = await readFile(filePath, 'utf8');
      const updated = injectMarkdown(original, ctx);
      if (updated !== original) {
        result.filesUpdated++;
        if (!dryRun) {
          await writeFile(filePath, updated, 'utf8');
        }
        log(`${dryRun ? 'needs update' : 'updated'}: ${filePath}`);
      }
    } catch (err) {
      const msg = `error: ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      log(msg);
    }
  }

  return result;
}

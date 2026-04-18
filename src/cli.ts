/**
 * CLI entry point. Parses arguments via `commander` and invokes {@link updatePaths}.
 *
 * Installed as the `code-excerpter` binary via `package.json` `bin`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { compileExcludePatterns } from './excludePatterns.js';
import { updatePaths } from './update.js';

function readPkgVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, '..', 'package.json');
  try {
    const raw = readFileSync(pkgPath, 'utf8');
    const data = JSON.parse(raw) as { version?: string };
    if (typeof data.version === 'string' && data.version.length > 0) {
      return data.version;
    }
  } catch {
    /* ignore */
  }
  return '0.0.0-unknown';
}

const program = new Command();

program
  .name('code-excerpter')
  .description(
    'Update fenced code blocks in markdown files with extracted code excerpts.',
  )
  .version(readPkgVersion(), '--version')
  .argument('<path...>', 'files or directories to process')
  .option('-p, --path-base <dir>', 'base path for source file resolution', '')
  .option(
    '--exclude <pattern>',
    'exclude paths matching regex (repeatable)',
    (val: string, prev: string[]) => [...prev, val],
    [] as string[],
  )
  .option('--dry-run', 'report changes without writing files', false)
  .option(
    '--fail-on-update',
    'exit non-zero when files need updating (CI mode)',
    false,
  )
  .option(
    '--no-escape-ng-interpolation',
    'disable Angular {{/}} escaping in injected code',
  )
  .option(
    '--replace <expr>',
    'global replace expression applied to entire excerpt text',
  )
  .option('--plaster <template>', 'global plaster template')
  .action(
    async (
      paths: string[],
      opts: {
        pathBase: string;
        exclude: string[];
        dryRun: boolean;
        failOnUpdate: boolean;
        escapeNgInterpolation: boolean;
        replace?: string;
        plaster?: string;
      },
    ) => {
      const compiled = compileExcludePatterns(opts.exclude);
      if (!compiled.ok) {
        console.error(compiled.error);
        console.error(
          '0 file(s) processed, 0 updated, 0 error(s), 0 warning(s); 0 set directive(s), 0 fragment directive(s)',
        );
        process.exitCode = 1;
        return;
      }
      const result = await updatePaths(paths, {
        pathBase: opts.pathBase || undefined,
        exclude: compiled.patterns,
        dryRun: opts.dryRun,
        escapeNgInterpolation: opts.escapeNgInterpolation,
        globalReplace: opts.replace,
        globalPlasterTemplate: opts.plaster,
        log: (msg) => console.error(msg),
      });

      const { set, fragment } = result.instructionStats;
      const summary = [
        `${result.filesProcessed} file(s) processed`,
        `${result.filesUpdated} updated`,
        `${result.errors.length} error(s)`,
        `${result.warnings.length} warning(s)`,
      ].join(', ');
      console.error(
        `${summary}; ${set} set directive(s), ${fragment} fragment directive(s)`,
      );

      if (result.errors.length > 0) {
        process.exitCode = 1;
      } else if (opts.failOnUpdate && result.filesUpdated > 0) {
        process.exitCode = 1;
      }
    },
  );

program.parse();

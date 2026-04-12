/**
 * CLI entry point. Parses arguments via `commander` and invokes {@link updatePaths}.
 *
 * Installed as the `code-excerpter` binary via `package.json` `bin`.
 */

import { Command } from "commander";
import { updatePaths } from "./update.js";

const program = new Command();

program
  .name("code-excerpter")
  .description(
    "Update fenced code blocks in markdown files with extracted code excerpts.",
  )
  .argument("<path...>", "files or directories to process")
  .option("-p, --path-base <dir>", "base path for source file resolution", "")
  .option(
    "--exclude <pattern>",
    "exclude paths matching regex (repeatable)",
    (val: string, prev: string[]) => [...prev, val],
    [] as string[],
  )
  .option("--dry-run", "report changes without writing files", false)
  .option(
    "--fail-on-update",
    "exit non-zero when files need updating (CI mode)",
    false,
  )
  .option(
    "--no-escape-ng-interpolation",
    "disable Angular {{/}} escaping in injected code",
  )
  .option("--replace <expr>", "global replace expression")
  .option("--plaster <template>", "global plaster template")
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
      const exclude = opts.exclude.map((s) => new RegExp(s));
      const result = await updatePaths(paths, {
        pathBase: opts.pathBase || undefined,
        exclude,
        dryRun: opts.dryRun,
        escapeNgInterpolation: opts.escapeNgInterpolation,
        globalReplace: opts.replace,
        globalPlasterTemplate: opts.plaster,
        log: (msg) => console.error(msg),
      });

      const summary = [
        `${result.filesProcessed} file(s) processed`,
        `${result.filesUpdated} updated`,
        `${result.errors.length} error(s)`,
        `${result.warnings.length} warning(s)`,
      ].join(", ");
      console.error(summary);

      if (result.errors.length > 0) {
        process.exitCode = 1;
      } else if (opts.failOnUpdate && result.filesUpdated > 0) {
        process.exitCode = 1;
      }
    },
  );

program.parse();

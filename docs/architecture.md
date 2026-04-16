# Architecture

This document describes the module-by-module architecture of `code-excerpter`,
its relationship to the original Dart repositories, and key porting decisions.

---

## Relationship to the Dart Repositories

Each part of this port maps to upstream Dart work in one of these repositories:

- [`chalin/code_excerpter`][]: source for `directive.ts` and `extract.ts`
  (`Directive` class, `Excerpter` class, and the extraction test suite).
- [`chalin/code_excerpt_updater`][]: source for `inject.ts`, `update.ts`, and
  `cli.ts` (`<?code-excerpt?>` syntax and updater logic; its README is the
  canonical spec).
- [`dart-lang/site-shared`][] (`pkgs/excerpter`): reference implementation that
  combines both of the above; its code is the primary guide for this port.

---

## Module Map

### `src/directive.ts` (Phase 1a)

**Dart source:** `chalin/code_excerpter/lib/src/directive.dart`

Parses `#docregion` and `#enddocregion` directives from individual source lines.
Key porting notes:

- Dart's `Pattern` type maps to `string | RegExp` in TypeScript.
- The comment-stripping regex covers HTML (`-->`), CSS (`*/`), and standard
  line-comment suffixes. The same regex logic is carried forward unchanged.
- Returns a structured object with:
  - `kind`: `'docregion' | 'enddocregion'`
  - `names`: `string[]` (parsed region names; `['']` for the default region)
  - `issues`: `Issue[]` — a list of warnings and errors (not thrown exceptions)
- Returns `null` for lines that are not directives.

### `src/extract.ts` (Phase 1b)

**Dart source:** `chalin/code_excerpter/lib/src/excerpter.dart`

Extracts named code regions from source file content (a `string[]` of lines).

- Processes lines sequentially, tracking open/close state per region name.
- The default (unnamed) region is represented as the empty string `''`.
- Handles overlapping and nested regions, plaster lines, and blank line
  collapsing at region boundaries.
- Returns a `Map<string, string[]>` from region name to extracted lines.

### `src/transform.ts` (Phase 2)

**Dart source:** `chalin/code_excerpt_updater/lib/src/code_transformer/`

Implements the transform pipeline applied to extracted lines before injection.
All transforms are pure functions: `(lines: string[]) => string[]`.

Supported transforms:

| Transform   | Description                                                       |
| ----------- | ----------------------------------------------------------------- |
| `skip`      | Skip the first N lines                                            |
| `take`      | Keep only the first N lines                                       |
| `from`      | Start from the first line matching a pattern                      |
| `to`        | Truncate after the first line matching a pattern (that line kept) |
| `remove`    | Remove all lines matching a pattern                               |
| `retain`    | Keep only lines matching a pattern                                |
| `replace`   | Replace pattern matches with a substitution string                |
| `indent-by` | Prepend N spaces to every line                                    |

Key porting note: `BackReferenceReplaceTransform` in Dart already targets JS
regex back-reference semantics (`$1`, `$2`), so this is a straightforward port.

### `src/inject.ts` (Phase 3)

**Dart source:** `chalin/code_excerpt_updater/lib/src/code_excerpt_updater.dart`

Parses `<?code-excerpt?>` processing instructions in markdown files and
orchestrates the extraction + transform pipeline for each code block.

- **Input assumption:** processing is line-oriented with regex-based fence
  matching, not a full Markdown parse. Callers should supply well-formed excerpt
  blocks; see [Markdown input assumptions](spec.md#markdown-input-assumptions).
- Identifies `<?code-excerpt "path/file.ext (region)" arg="val" ...?>` lines.
- Supports set instructions (`<?code-excerpt path-base="..."?>`).
- Handles comment-prefixed instructions (`//` or `///` before
  `<?code-excerpt?>`).
- Blank lines between an instruction and the opening fence are copied to the
  output then skipped so the fence is recognized (common in authored markdown).
  Fenced blocks may use **backticks** (` ``` `) or **tildes** (`~~~`).
- File-level set `replace` and optional programmatic `globalReplace` on the
  inject context compose on the joined excerpt string after per-instruction
  transforms (Dart `Updater` `fileAndCmdLineCodeTransformer` order).
- Per-instruction transform order follows named-argument order in the PI; see
  [`docs/spec.md`](spec.md#processing-order-of-arguments).
- `readFile(path, region?)` mirrors Dart `ExcerptGetter` when the callback
  resolves `.txt` fragments and `.excerpt.yaml` regions; optional
  `escapeNgInterpolation` / `globalPlasterTemplate` match updater defaults.
- Golden parity: `test/updater-goldens.test.ts` drives `injectMarkdown` against
  vendored `test/fixtures/code-excerpt-updater/test_data/` from
  [`chalin/code_excerpt_updater`][] (see that directory’s `README.md`).
- See [`docs/spec.md`](spec.md) for the full instruction syntax.

### `src/instructionStats.ts`

Shared **`InstructionStats`** type (`set` / `fragment` parsed-directive counts).
Imported by `inject.ts` (optional context field) and `update.ts` (aggregated on
`UpdateResult`); re-exported from the package root in `index.ts`.

### `src/update.ts` (Phase 4)

**Dart source:** `dart-lang/site-shared/pkgs/excerpter/lib/src/update.dart`

Walks directory trees (or individual files), collects `.md` files, and runs
`injectMarkdown` on each. Writes updated content back when changed.

- `updatePaths(paths, options?)` — async entry point; returns `UpdateResult`
  with `filesProcessed`, `filesUpdated`, `errors[]`, `warnings[]`, and
  `instructionStats` (`set` / `fragment` counts of **parsed** strict-line
  directives for the run).
- Skips dot-prefixed segments and user-supplied `exclude` regex patterns.
- Source files for excerpts are read synchronously from disk under
  `options.pathBase` (resolved to an absolute root for `readFile` only).
  `injectMarkdown` still starts with an empty file-level `path-base`; set
  instructions in the markdown extend paths passed to `readFile` from that root.
- Supports `dryRun` (no writes). The CLI’s `--fail-on-update` exits non-zero
  when `filesUpdated > 0` (often combined with `--dry-run` so CI fails if
  markdown is out of date relative to sources).

### `src/index.ts`

Public API entry point. Exports the types and functions intended for
programmatic use (library consumers). The CLI is a separate entry point.

### `src/cli.ts` (Phase 4)

**Dart source:** `chalin/code_excerpt_updater` `UpdaterCLI` +
`dart-lang/site-shared` `bin/excerpter.dart`

CLI entry point using `commander`. Parses command-line arguments and invokes
`updatePaths` from `update.ts`. Installed as the `code-excerpter` binary via
`package.json` `bin`.

Key flags: `--path-base` / `-p`, `--exclude`, `--dry-run`, `--fail-on-update`,
`--no-escape-ng-interpolation`, `--replace`, `--plaster`. Run
`code-excerpter --help` for the full list.

---

## Data Flow

```text
Input source files (*.dart, *.ts, *.html, etc.)
  │
  ▼
src/directive.ts — parse #docregion / #enddocregion from each line
  │
  ▼
src/extract.ts — collect named regions as string[][]
  │
  ▼
src/transform.ts — apply transform pipeline (skip/take/from/to/remove/...)
  │
  ▼
src/inject.ts — match <?code-excerpt?> blocks in markdown, replace content
  │
  ▼
src/update.ts — walk filesystem, update files, write changes
```

---

## Key Design Decisions

1. **Structured `issues` list on `Directive`**: Warnings and non-fatal errors
   are accumulated in an `issues` array rather than thrown as exceptions, so
   callers can decide how to surface them (log, fail, ignore).

2. **Pure transforms**: All transforms in `transform.ts` are stateless pure
   functions, making them easy to test and compose without side effects.

3. **ESM-only**: Node.js minimum is pinned under `engines` in `package.json`;
   the package is ESM-only. No CommonJS compatibility shims.

4. **`node:` prefix**: All Node.js built-in imports use the `node:` prefix to
   make the import origin explicit and avoid any potential name conflicts.

[`chalin/code_excerpter`]: https://github.com/chalin/code_excerpter
[`chalin/code_excerpt_updater`]: https://github.com/chalin/code_excerpt_updater
[`dart-lang/site-shared`]:
  https://github.com/dart-lang/site-shared/tree/main/pkgs/excerpter

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

Parses `#docregion` and `#enddocregion` directives from individual source
lines. Key porting notes:

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

Supported transforms (in processing order):

| Transform   | Description                                             |
| ----------- | ------------------------------------------------------- |
| `skip`      | Skip the first N lines                                  |
| `take`      | Keep only the first N lines                             |
| `from`      | Start from the first line matching a pattern            |
| `to`        | Stop at (and exclude) the first line matching a pattern |
| `remove`    | Remove all lines matching a pattern                     |
| `retain`    | Keep only lines matching a pattern                      |
| `replace`   | Replace pattern matches with a substitution string      |
| `indent-by` | Prepend N spaces to every line                          |

Key porting note: `BackReferenceReplaceTransform` in Dart already targets JS
regex back-reference semantics (`$1`, `$2`), so this is a straightforward port.

### `src/inject.ts` (Phase 3)

**Dart source:** `chalin/code_excerpt_updater/lib/src/code_excerpt_updater.dart`

Parses `<?code-excerpt?>` processing instructions in markdown files and
orchestrates the extraction + transform pipeline for each code block.

- Identifies `<?code-excerpt "path/file.ext (region)" arg="val" ...?>` lines.
- Supports set instructions (`<?code-excerpt path-base="..."?>`).
- Handles comment-prefixed instructions (`//` or `///` before `<?code-excerpt?>`).
- See [`docs/spec.md`](spec.md) for the full instruction syntax.

### `src/update.ts` (Phase 4)

**Dart source:** `dart-lang/site-shared/pkgs/excerpter/bin/excerpter.dart`

Walks directory trees, finds markdown files matching configured extensions,
and runs the updater (from `inject.ts`) on each file. Writes updated content
back if changed.

### `src/index.ts`

Public API entry point. Exports the types and functions intended for
programmatic use (library consumers). The CLI is a separate entry point.

### `src/cli.ts` (Phase 4)

CLI entry point using `commander`. Parses command-line arguments and invokes
`update.ts`. Installed as the `code-excerpter` binary via `package.json` `bin`.

---

## Data Flow

```
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

3. **ESM-only**: The project targets Node.js 20+ ESM exclusively. No CommonJS
   compatibility shims.

4. **`node:` prefix**: All Node.js built-in imports use the `node:` prefix to
   make the import origin explicit and avoid any potential name conflicts.

[`chalin/code_excerpter`]: https://github.com/chalin/code_excerpter
[`chalin/code_excerpt_updater`]: https://github.com/chalin/code_excerpt_updater
[`dart-lang/site-shared`]: https://github.com/dart-lang/site-shared/tree/main/pkgs/excerpter

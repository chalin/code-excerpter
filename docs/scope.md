# Scope

This document defines the feature scope for `code-excerpter` v1.

---

## In Scope

### Core updater

- Read source files and extract code regions delimited by `#docregion` /
  `#enddocregion` directives.
- Parse `<?code-excerpt?>` processing instructions in markdown files.
- Replace fenced code blocks in markdown with extracted (and transformed)
  content.
- Walk directory trees and update all matching markdown files.

### CLI

- Accept a root directory (or list of files) as input.
- Support `--path-base` / `-p` to set the base path for source file resolution.
- Exit with a non-zero status on errors.

### Excerpt extraction

- Named regions (e.g., `#docregion my-region`).
- Default (unnamed) region — the entire file minus directive lines.
- Comma-separated region names on a single directive line.
- Overlapping and nested regions.
- Plaster handling (language-specific filler comment at region join points).

### Code transforms and settings

Transform operations, setting arguments, and scope-sensitive `replace` semantics
are in scope. See [`docs/spec.md`](spec.md#pi-arguments) for the canonical
Scope/Kind table and fragment-order rules.

### Path-base set instructions

`<?code-excerpt path-base="..."?>` to set a base path prefix for subsequent
excerpt instructions in the same file.

### YAML excerpt reading

Support reading excerpts from `.yaml` / `.yml` source files (same directive
syntax).

### Supported source file extensions

```text
*.css  *.dart  *.html  *.js  *.json  *.scss  *.ts  *.yaml  *.yml
```

---

## Deferred (post-v1)

| Feature                | Reason                                               |
| ---------------------- | ---------------------------------------------------- |
| `diff-with` / `diff-u` | Complex output format, low priority for initial port |

Angular interpolation escaping (`{{` / `}}` in injected lines) is implemented in
`inject.ts` to match the Dart updater default (`escapeNgInterpolation`).

---

## Dropped

| Feature              | Reason                                 |
| -------------------- | -------------------------------------- |
| `.jade` file support | Jade/Pug is obsolete; no current users |

---

## What to Carry Forward from Each Source Repo

The v1 scope assumes we reuse upstream Dart material as follows:

- [`chalin/code_excerpter`][]: test cases for the `Excerpter` and `Directive`
  classes (edge cases, plaster, overlapping regions).
- [`chalin/code_excerpt_updater`][]: the `<?code-excerpt?>` syntax specification
  (that repo’s README is the canonical spec) and updater logic.
- [`dart-lang/site-shared`][]: reference implementation and primary guide for
  this TypeScript port.

[`chalin/code_excerpter`]: https://github.com/chalin/code_excerpter
[`chalin/code_excerpt_updater`]: https://github.com/chalin/code_excerpt_updater
[`dart-lang/site-shared`]:
  https://github.com/dart-lang/site-shared/tree/main/pkgs/excerpter

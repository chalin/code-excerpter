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

### Code transforms

Applied in order:

1. `skip` — skip the first N lines
2. `take` — keep only the first N lines
3. `from` — start from the first line matching a pattern
4. `to` — stop before the first line matching a pattern
5. `remove` — remove all lines matching a pattern
6. `retain` — keep only lines matching a pattern
7. `replace` — regex replace within lines
8. `indent-by` — prepend N spaces to every line

### Path-base set instructions

`<?code-excerpt path-base="..."?>` to set a base path prefix for subsequent
excerpt instructions in the same file.

### YAML excerpt reading

Support reading excerpts from `.yaml` / `.yml` source files (same directive
syntax).

### Supported source file extensions

```
*.css  *.dart  *.html  *.js  *.json  *.scss  *.ts  *.yaml  *.yml
```

---

## Deferred (post-v1)

| Feature | Reason |
|---|---|
| `diff-with` / `diff-u` | Complex output format, low priority for initial port |
| Angular interpolation escaping | Specific to Angular docs, not general-purpose |

---

## Dropped

| Feature | Reason |
|---|---|
| `.jade` file support | Jade/Pug is obsolete; no current users |

---

## What to Carry Forward from Each Source Repo

| Source | What we carry forward |
|---|---|
| [`chalin/code_excerpter`](https://github.com/chalin/code_excerpter) | Test cases for the `Excerpter` and `Directive` classes (edge cases, plaster, overlapping regions) |
| [`chalin/code_excerpt_updater`](https://github.com/chalin/code_excerpt_updater) | The `<?code-excerpt?>` syntax specification (README is the canonical spec); updater logic |
| [`dart-lang/site-shared`](https://github.com/dart-lang/site-shared/tree/main/pkgs/excerpter) | Reference implementation — primary guide for this TypeScript port |

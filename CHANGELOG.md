# Changelog

All notable user-facing changes to this project are documented in this file.

The format is based on [Keep a Changelog][], and this project adheres to
[Semantic Versioning][].

Developer-focused changes recorded in separate "For developers" subsections.

## v0.2.0-dev - unreleased

### Added

- [Markdown input assumptions](docs/spec.md#markdown-input-assumptions).
- Plaster templates for common fenced-code language identifiers, including
  `javascript`, `typescript`, `csharp`, `cs`, and more.
- Reusable `test:site-www` integration harness for exercising the updater
  against a local `site-www` clone.
- **Tilde (`~~~`) code fences** in markdown: recognized as opening/closing
  fences and paired by fence **kind** (backtick vs tilde vs Liquid prettify),
  consistent with backtick and prettify blocks.
- CLI **`--version`**, reporting `version` from `package.json`.
- [Excerpt processing](docs/spec.md#excerpt-processing): documented pipeline
  from source read through structural prefixes and escaping.

### Changed

- README: improved installation instructions and Overview wording.
- [`replace` expressions](docs/spec.md#replace-expressions) now features full
  JavaScript semantics
- Spec now states clearly that excerpt **transform operations** run in the order
  they appear in the fragment instruction.
  [Details](docs/spec.md#processing-order-of-transform-arguments).
- Fragment PI arg processing now preserves repeated transform operations in
  appearance order instead of coalescing them by key.
- Plaster handling now uses YAML-style default-template semantics by default,
  treats explicit `plaster` values as full templates, and documents
  `plaster="unset"` as unsupported.
- Built-in `.excerpt.yaml` sidecar reading now treats a present sidecar as
  authoritative: missing sidecar regions report an error instead of falling back
  to plain-source extraction.
- PI parsing now tolerates whitespace before `?>`, warns on malformed
  `<? code-excerpt ...?>` openers, and accepts backtick / tilde fence runs
  longer than 3.
- Discontiguous-region plaster lines now inherit the reopening `#docregion`
  directive indentation, matching `site-shared` and `site-www`.
- `injectMarkdown` trims trailing whitespace on each excerpt line before
  applying structural line prefixes (`indent-by`, list indentation), so
  `replace` output cannot consume markdown indentation
  ([details](docs/spec.md#excerpt-processing)).
- CLI `--replace` help text: global replace applies to the entire excerpt text.

### For developers

Added:

- Focused PI arg-processing tests for direct parser/classifier coverage.
- **Husky** hooks ([docs/tooling.md](docs/tooling.md#git-hooks-husky)).
- `npm run fix:dict` — normalize `.cspell/words.txt`.

Changed:

- Development `package.json` version set to **0.2.0-dev** after the **0.1.0**
  npm release.
- **`prepare`:** `build` + Husky (git installs still get `dist/`).
- Cspell extras: `.cspell/words.txt` instead of inline `words:`.
- **`npm run fix`:** delegates to `fix:all`.
- `test:site-www` runs `npm run build` then `scripts/test-site-www.sh`
  ([tooling](docs/tooling.md)).
- Library issue reporting now uses the shared structured
  `onIssue({ kind, message })` / `ReportedIssue` model across directive,
  extract, transform, inject, and update APIs.

## [v0.1.0][] - 2026-04-13

### Feature summary

- Initial release of the TypeScript port of the Dart excerpter tooling.
- CLI `code-excerpter` with `--path-base` / `-p` for excerpt source resolution,
  directory and file inputs, and non-zero exit on errors.
- Library exports `updatePaths` and `injectMarkdown` for programmatic use.
- Extraction of `#docregion` / `#enddocregion` regions (named, default,
  comma-separated, overlapping, nested) with plaster handling.
- `<?code-excerpt?>` processing instructions in markdown, including path-base
  set instructions and supported transforms (`skip`, `take`, `from`, `to`,
  `remove`, `retain`, `replace`, `indent-by`).
- Source extensions: `.css`, `.dart`, `.html`, `.js`, `.json`, `.scss`, `.ts`,
  `.yaml`, `.yml`.
- YAML excerpt sources using the same directive syntax.

### Origins

Behavior and tests are based on the following Dart excerpter tools
(approximately as of April 2026):

- [dart-lang/site-shared][]: reference implementation in [pkgs/excerpter][] on
  `main`, originally derived from the tool pair listed below.
- [chalin/code_excerpter][]: library sources on `master`
- [chalin/code_excerpt_updater][]: updater **v1.1.1**; golden fixtures under
  `test_data/` are vendored from that repo’s `main` branch.

[Keep a Changelog]: https://keepachangelog.com/en/1.1.0/
[Semantic Versioning]: https://semver.org/spec/v2.0.0.html
[chalin/code_excerpter]: https://github.com/chalin/code_excerpter
[chalin/code_excerpt_updater]: https://github.com/chalin/code_excerpt_updater
[dart-lang/site-shared]: https://github.com/dart-lang/site-shared
[pkgs/excerpter]:
  https://github.com/dart-lang/site-shared/tree/main/pkgs/excerpter
[v0.1.0]: https://github.com/chalin/code-excerpter/releases/tag/v0.1.0

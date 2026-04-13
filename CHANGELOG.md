# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog][], and this project adheres to
[Semantic Versioning][].

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

# code-excerpter

A line-based tool for extracting and injecting code excerpts into documentation.

## Overview

`code-excerpter` is a TypeScript port of the Dart excerpter tooling used by
[dart-lang/site-www][]. It parses `#docregion`/`#enddocregion` directives in
source files, extracts named code regions, and updates markdown files containing
`<?code-excerpt?>` processing instructions.

Lineage and upstream Dart repositories are summarized in
[docs/architecture.md][].

The `<?code-excerpt?>` instruction syntax is documented in [docs/spec.md][].

## Installation

Install directly from the GitHub repository using npm:

```sh
npm install github:chalin/code-excerpter
```

Once published to npm, installation will be:

```sh
npm install -g code-excerpter
```

## Usage

Run the `code-excerpter` binary on directories and/or markdown files. Excerpt
sources are resolved relative to `--path-base` / `-p` (defaults to the current
working directory).

```sh
npx code-excerpter --help
npx code-excerpter -p path/to/src path/to/docs
```

Library API: import `updatePaths` and `injectMarkdown` from `code-excerpter`
(see [docs/architecture.md][]). Scripts and quality gates: [docs/tooling.md][].

## Development

Clone the repository and install dependencies:

```sh
git clone https://github.com/chalin/code-excerpter.git
cd code-excerpter
npm install
```

For more details, see [docs/tooling.md][]. Conventions (code, docs, and AI
guidance): [docs/conventions.md][]. Contributor orientation:
[CONTRIBUTING.md][].

## License

Apache 2.0 — see [LICENSE][].

[dart-lang/site-www]: https://github.com/dart-lang/site-www
[docs/architecture.md]:
  docs/architecture.md#relationship-to-the-dart-repositories
[docs/spec.md]: docs/spec.md
[docs/tooling.md]: docs/tooling.md#scripts
[docs/conventions.md]: docs/conventions.md
[CONTRIBUTING.md]: CONTRIBUTING.md
[LICENSE]: LICENSE

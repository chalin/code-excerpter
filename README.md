# code-excerpter

A line-based tool for extracting and injecting code excerpts into documentation.

## Overview

`code-excerpter` parses `#docregion`/`#enddocregion` directives in source files,
extracts named code regions, and updates markdown files containing
`<?code-excerpt?>` processing instructions.

The `<?code-excerpt?>` instruction syntax is documented in [docs/spec.md][].

`code-excerpter` is a TypeScript port of the Dart excerpter tooling. For
details, see [docs/architecture.md][].

## Installation

Install as a global CLI or a project dependency in the usual way, for example:

```sh
npm install --global code-excerpter
npm install --save-dev code-excerpter
npm install --save-dev github:chalin/code-excerpter
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

[docs/architecture.md]:
  docs/architecture.md#relationship-to-the-dart-repositories
[docs/spec.md]: docs/spec.md
[docs/tooling.md]: docs/tooling.md#scripts
[docs/conventions.md]: docs/conventions.md
[CONTRIBUTING.md]: CONTRIBUTING.md
[LICENSE]: LICENSE

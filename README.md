# code-excerpter

A line-based tool for extracting and injecting code excerpts into documentation.

## Overview

`code-excerpter` parses `#docregion`/`#enddocregion` directives in source files,
extracts named code regions, and updates markdown files containing
`<?code-excerpt?>` processing instructions.

The `<?code-excerpt?>` instruction syntax is documented in [docs/spec.md][].

`code-excerpter` is a TypeScript port of the Dart excerpter tooling. For
details, see [docs/architecture.md][].

The package is published on npm as `code-excerpter` ([npm package][]).

## Installation

From the [npm registry][npm package], for example:

```sh
npm install --global code-excerpter   # global CLI
npm install --save-dev code-excerpter # project dependency
```

To install a specific commit from GitHub instead of the registry:

```sh
npm install --save-dev github:chalin/code-excerpter
```

## Usage

Run the `code-excerpter` binary on directories and/or markdown files. Excerpt
sources are resolved relative to `--path-base` / `-p` (defaults to the current
working directory). For example, if you did a project-local install:

```sh
npx code-excerpter --help
npx code-excerpter -p path/to/src path/to/docs
```

## Development

Clone the repository and install dependencies:

```sh
git clone https://github.com/chalin/code-excerpter.git
cd code-excerpter
npm install && npm test
```

For more details, see:

- [docs/tooling.md][]
- Repo conventions (code, docs, and AI guidance): [docs/conventions.md][]
- [CONTRIBUTING.md][]

## License

Apache 2.0 — see [LICENSE][].

[npm package]: https://www.npmjs.com/package/code-excerpter
[docs/architecture.md]:
  docs/architecture.md#relationship-to-the-dart-repositories
[docs/spec.md]: docs/spec.md
[docs/tooling.md]: docs/tooling.md#scripts
[docs/conventions.md]: docs/conventions.md
[CONTRIBUTING.md]: CONTRIBUTING.md
[LICENSE]: LICENSE

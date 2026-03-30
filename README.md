# code-excerpter

A line-based tool for extracting and injecting code excerpts into documentation.

## Overview

`code-excerpter` is a TypeScript port of the Dart excerpter tooling used by
[dart-lang/site-www](https://github.com/dart-lang/site-www). It parses
`#docregion`/`#enddocregion` directives in source files, extracts named code
regions, and updates markdown files containing `<?code-excerpt?>` processing
instructions.

The tool draws from three original Dart repositories:

- **[chalin/code_excerpter](https://github.com/chalin/code_excerpter)** — the
  original Dart extraction library with comprehensive tests
- **[chalin/code_excerpt_updater](https://github.com/chalin/code_excerpt_updater)** —
  the original Dart updater CLI with full `<?code-excerpt?>` syntax
- **[dart-lang/site-shared (`pkgs/excerpter`)](https://github.com/dart-lang/site-shared/tree/main/pkgs/excerpter)** —
  a simplified Dart rewrite combining both tools, currently used by
  `dart-lang/site-www`

The `<?code-excerpt?>` instruction syntax is documented in
[docs/spec.md](docs/spec.md).

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

> **Note:** The CLI is not yet implemented. This section will be updated once
> Phase 4 is complete. See [docs/plan.md](docs/plan.md) for progress.

```sh
npx code-excerpter --help
```

## Development

Clone the repository and install dependencies:

```sh
git clone https://github.com/chalin/code-excerpter.git
cd code-excerpter
npm install
```

### Build

```sh
npm run build
```

### Test

```sh
npm test
```

### Lint

```sh
npm run lint
```

To auto-fix lint issues:

```sh
npm run lint:fix
```

## License

Apache 2.0 — see [LICENSE](LICENSE).


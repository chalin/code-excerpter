# AGENTS.md — AI Agent Instructions for `code-excerpter`

This file contains instructions for AI coding agents (GitHub Copilot, OpenAI
Codex, Claude, etc.) working on this repository. It is agent-agnostic.

See the [`docs/`](docs/) directory for deeper context on architecture, scope,
and the porting plan.

---

## Project Overview

`code-excerpter` is a TypeScript port of the Dart excerpter tooling used by
[dart-lang/site-www](https://github.com/dart-lang/site-www). It is a
line-based tool for extracting and injecting code excerpts into documentation.

**One-line description:** A line-based tool for extracting and injecting code
excerpts into documentation.

### Lineage

The tool has its origins in three Dart repositories:

| Repo | Role |
|---|---|
| [`chalin/code_excerpter`](https://github.com/chalin/code_excerpter) | Original Dart extraction library — comprehensive tests, `Excerpter` + `Directive` classes |
| [`chalin/code_excerpt_updater`](https://github.com/chalin/code_excerpt_updater) | Original Dart updater CLI — full `<?code-excerpt?>` syntax, README is the spec |
| [`dart-lang/site-shared` (`pkgs/excerpter`)](https://github.com/dart-lang/site-shared/tree/main/pkgs/excerpter) | Simplified Dart rewrite combining both, currently used in production |

---

## Architecture Overview

The module plan follows a layered pipeline:

| Module | Phase | Description |
|---|---|---|
| `src/directive.ts` | 1a | Parse `#docregion`/`#enddocregion` directives from source lines |
| `src/extract.ts` | 1b | Extract named code regions from source file content |
| `src/transform.ts` | 2 | Transform pipeline: skip, take, from, to, remove, retain, replace, indent |
| `src/inject.ts` | 3 | Parse `<?code-excerpt?>` instructions in markdown, orchestrate extraction + transforms |
| `src/update.ts` | 4 | Walk directory trees, find markdown files, run updater on each |
| `src/index.ts` | — | Public API exports |
| `src/cli.ts` | 4 | CLI entry point (commander) |

### Data Flow

```
source files
  → directive parsing  (src/directive.ts)
  → region extraction  (src/extract.ts)
  → transform pipeline (src/transform.ts)
  → markdown injection (src/inject.ts)
  → file update        (src/update.ts)
```

See [`docs/architecture.md`](docs/architecture.md) for the full module-by-module
analysis including Dart-to-TypeScript mapping notes.

---

## Coding Conventions

- **Module system**: ESM throughout. Use `import`/`export`, never `require()`.
- **TypeScript**: Strict mode enabled (`"strict": true` in `tsconfig.json`).
- **Built-in imports**: Always use the `node:` prefix (e.g., `node:fs/promises`,
  `node:path`, `node:url`).
- **Async I/O**: Prefer `node:fs/promises` for all file operations.
- **Naming**: Use camelCase for variables/functions, PascalCase for classes and
  types/interfaces.
- **Formatting**: 2-space indentation, 100-character line width (enforced by
  Biome).
- **No default exports**: Use named exports everywhere.

---

## How to Build, Test, and Lint

```sh
# Install dependencies
npm install

# Build (outputs to dist/)
npm run build

# Run tests
npm test

# Watch mode for tests
npm run test:watch

# Lint and format check
npm run lint

# Lint and auto-fix
npm run lint:fix
```

---

## Key Design Notes

### `Directive` class (`src/directive.ts`)

- Ported from `chalin/code_excerpter`
- Uses comment-syntax-aware regex: HTML (`-->`), CSS (`*/`), and plain
  line-comment stripping
- Returns a structured object with a `issues` list (warnings vs. hard errors)
- Handles comma-separated region names, duplicate detection, and deprecated
  unquoted default region names

### Transform pipeline (`src/transform.ts`)

- All transforms are pure functions: `(lines: string[]) => string[]`
- Processing order matters — see [`docs/spec.md`](docs/spec.md) for the
  defined order
- `BackReferenceReplaceTransform` already targets JS regex semantics (uses
  `$1`, `$2`, etc.)

### CLI (`src/cli.ts`)

- Uses `commander` for argument parsing
- Entry point in `package.json` `bin` field: `code-excerpter`
- The `prepare` script runs `tsup` so `npm install github:chalin/code-excerpter`
  triggers a build automatically

---

## References

- [`docs/plan.md`](docs/plan.md) — Phased porting plan with progress checkboxes
- [`docs/architecture.md`](docs/architecture.md) — Module mapping, Dart→TS porting notes
- [`docs/tooling.md`](docs/tooling.md) — Tooling decisions with rationale
- [`docs/scope.md`](docs/scope.md) — Feature scoping for v1
- [`docs/spec.md`](docs/spec.md) — `<?code-excerpt?>` instruction syntax specification

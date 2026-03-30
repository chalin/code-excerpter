# Tooling

This document records the agreed tooling choices for `code-excerpter` and the
rationale for each decision.

---

## Summary Table

| Category | Tool | Version |
|---|---|---|
| Runtime | Node.js | >=20 (ESM) |
| Build | tsup | ^8.0.0 |
| Dev runner | tsx | ^4.0.0 |
| Tests | vitest | ^3.0.0 |
| Lint/format | @biomejs/biome | ^1.9.0 |
| CLI args | commander | ^13.0.0 |
| Type checking | typescript | ^5.7.0 |

---

## Rationale

### Node.js 20+ (ESM)

Node.js 20 is the current LTS release and has full native ESM support. By
targeting ESM exclusively (`"type": "module"` in `package.json`), we avoid
dual-module complexity and stay aligned with the direction of the ecosystem.

### tsup (build)

`tsup` is a zero-config bundler built on esbuild that handles library and CLI
builds, generates `.d.ts` declaration files, and produces clean ESM output.
It is significantly faster than `tsc` for production builds and requires
minimal configuration.

The `prepare` script (`"prepare": "tsup"`) ensures that a build is triggered
automatically when the package is installed directly from the git repository
via `npm install github:chalin/code-excerpter`.

**Alternative considered:** `tsc` alone — ruled out because it does not bundle
or handle the shebang injection for the CLI entry point as cleanly.

### tsx (dev runner)

`tsx` allows running TypeScript files directly without a prior build step,
using esbuild under the hood. It is used for the `dev` script
(`"dev": "tsx src/cli.ts"`) to enable fast iteration during development.

### vitest (tests)

`vitest` is fast, TypeScript-native, and has a Jest-compatible API. It
requires minimal configuration (auto-detects TypeScript via the project's
`tsconfig.json`) and integrates well with ESM.

**Alternative considered:** Jest — ruled out because it requires heavier
configuration for ESM + TypeScript projects.

### @biomejs/biome (lint/format)

`biome` is an all-in-one, fast linter and formatter. It replaces the
ESLint + Prettier combination with a single tool and zero additional config
files. The default rules are sensible and the formatter is compatible with
Prettier's output style.

**Alternative considered:** ESLint + Prettier — ruled out to reduce tooling
complexity.

### commander (CLI args)

`commander` is the most widely used Node.js CLI argument parsing library.
It is simple, stable, and right-sized for this project. No complex plugin
system needed.

**Alternative considered:** `yargs`, `meow` — both are fine choices, but
`commander` is the most common and has excellent TypeScript types.

---

## `package.json` Scripts

| Script | Command | Purpose |
|---|---|---|
| `build` | `tsup` | Production build → `dist/` |
| `dev` | `tsx src/cli.ts` | Run CLI directly from source (no build) |
| `test` | `vitest run` | Run tests once (CI mode) |
| `test:watch` | `vitest` | Run tests in watch mode |
| `lint` | `biome check .` | Lint and format check |
| `lint:fix` | `biome check . --write` | Lint and auto-fix |
| `prepare` | `tsup` | Build on `npm install` from git repo |

---

## Dependencies

### Production

| Package | Purpose |
|---|---|
| `commander` | CLI argument parsing |

### Development

| Package | Purpose |
|---|---|
| `tsup` | Production build tool |
| `tsx` | Dev-mode TypeScript runner |
| `vitest` | Test framework |
| `@biomejs/biome` | Linter and formatter |
| `typescript` | Type checker and language server |

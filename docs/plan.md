# Porting Plan

This document tracks the phased porting of the Dart excerpter tooling to
TypeScript.

Product-wide deferrals are in **Deferred** in [`docs/scope.md`](scope.md). Each
section may list limitations that apply to that phase.

---

## Phase 1a — `directive.ts`

Parse `#docregion`/`#enddocregion` directives from source lines. Pure string
logic, no I/O. Port the `Directive` class from [chalin/code_excerpter][] with
comment-syntax-aware regex (HTML `-->`, CSS `*/`).

- [x] Implement `src/directive.ts`
- [x] Write `test/directive.test.ts`
- [x] Update docs as needed

## Phase 1b — `extract.ts`

Extract named code regions from source file content. Port the `Excerpter` class
from [chalin/code_excerpter][].

- [x] Implement `src/extract.ts`
- [x] Write `test/extract.test.ts`
- [x] Port comprehensive test cases from
      [chalin/code_excerpter/test/excerpter_test.dart][] (edge cases, plaster,
      overlapping regions)
- [x] Update docs as needed

Limitations:

- `#docplaster` resolves to directive kind `plaster` in `directive.ts`, but
  `extract.ts` does not handle that kind yet (throws on those lines).

## Phase 2 — `transform.ts`

Transform pipeline: skip, take, from, to, remove, retain, replace, indent. All
pure logic, no I/O.

Current transform-order semantics are defined in [`docs/spec.md`](spec.md):
fragment transform operations run in PI encounter order, and repeated operations
are preserved.

- [x] Implement `src/transform.ts`
- [x] Write `test/transform.test.ts`
- [x] Update docs as needed

## Phase 3 — `inject.ts`

Parse `<?code-excerpt?>` instructions in markdown, orchestrate extraction +
transforms per code block.

- [x] Implement `src/inject.ts`
- [x] Write `test/inject.test.ts`
- [x] Update docs as needed

## Phase 4 — `update.ts` + `cli.ts`

Directory walking, file updating, CLI entry point.

- [x] Implement `src/update.ts`
- [x] Implement `src/cli.ts`
- [x] Write `test/update.test.ts`
- [x] Update docs as needed
- [x] Add built-in `.excerpt.yaml` sidecar support in the disk updater path,
      including authoritative-sidecar semantics and explicit sidecar error
      reporting.
- [x] Add normalized repo-owned updater fixtures under `test/fixtures/updater/`
      plus the `test/updater-fixtures.test.ts` filesystem harness.

## Phase 5a - follow-ups

A. [ ] **Follow-up** (site-shared updater goldens; complements Phase 3’s
[code_excerpt_updater test_data][] inject-only goldens):

1. [ ] Vendor [dart-lang/site-shared pkgs/excerpter test_data][] into this
       repository for fixtures.
2. [ ] Add Vitest goldens aligned with [updater_test.dart][] (copy `src/` → run
       updater → compare to `expected/`).

B. [ ] Optional follow-up items:

1. [x] **Overlapping `paths`**: `updatePaths` dedupes collected absolute paths
       before processing (same `.md` once per run).
2. [x] **Invalid `--exclude` patterns**: CLI compiles patterns with a friendly
       `error:` line on stderr and exit code 1 (see `src/excludePatterns.ts`).
3. [x] **`--no-escape-ng-interpolation`**: the CLI relies on Commander’s
       handling of negated boolean flags; behavior must stay aligned with
       `injectMarkdown` (`escapeNgInterpolation !== false` means escape).

C. [ ] Test gaps:

1. [x] CLI integration tests in `test/cli.integration.test.ts` (`--help`,
       invalid `--exclude`, `--fail-on-update` with `--dry-run`).
2. [x] `updatePaths`: assert `log` is called for expected lines; assert
       `warnings` in `UpdateResult` when `onWarning` fires.
3. [x] `updatePaths`: duplicate / overlapping roots (dedupe; see
       `test/update.test.ts`).

D. [ ] **Revisit — `<?code-excerpt` in prose (e.g. markdown tables):** Today
`injectMarkdown` treats any line **containing** the substring `<?code-excerpt`
as a candidate PI; if the strict full-line regex does not match and the
line-start `PROC_INSTR_BODY` regex also does not match (e.g. the PI text appears
**mid-line** in documentation), the tool reports **invalid processing
instruction**. That is awkward for docs that quote the syntax literally.
**Current workaround:** escape the opening angle bracket in prose (e.g.
`&lt;?code-excerpt …?>`) so the raw line does not contain `<?code-excerpt`.
**Possible later change:** only run PI parsing / errors when there is a real
line-start PI attempt (`PROC_INSTR_BODY` matches), so mid-line mentions are left
alone; add a regression test and optionally document `&lt;` in
[`docs/spec.md`](spec.md) for rare line-start edge cases (aligned with XML PI
rules).

## Phase 5b - extra behavior

### Refreshing code excerpts in non-md files

- Currently, `updatePaths` / CLI only processes `.md` files.
- Upstream [chalin/code_excerpt_updater CLI][] also processed `.dart` and
  `.jade` (`_validExt`).
- Newer [dart-lang/site-shared excerpter][]: [excerpter `update.dart`][] uses
  configurable `validTargetExtensions`; [excerpter `bin/excerpter.dart`][]
  passes `{'.md'}` only. Fixture shape:
  `test/fixtures/code-excerpt-updater/test_data/src/basic_with_region.dart`.
- Consider bringing in this new behavior into `code-excerpter`.
- If/once this is added, update [docs/spec.md](spec.md#pi-line-prefixes) to
  reflect the new behavior, in particular the list bullet prefix, add:
  > - Multiline comment continuation prefix: `*`

[chalin/code_excerpt_updater CLI]:
  https://github.com/chalin/code_excerpt_updater/blob/main/lib/code_excerpt_updater_cli.dart
[dart-lang/site-shared excerpter]:
  https://github.com/dart-lang/site-shared/tree/main/pkgs/excerpter
[excerpter `update.dart`]:
  https://github.com/dart-lang/site-shared/blob/main/pkgs/excerpter/lib/src/update.dart
[excerpter `bin/excerpter.dart`]:
  https://github.com/dart-lang/site-shared/blob/main/pkgs/excerpter/bin/excerpter.dart

## Phase 6 - Integration Testing

Run the code-excerpter against a repo that uses one of the other excerpter tool
versions, such as:

- [x] [open-telemetry/opentelemetry.io][] (uses `code-excerpter` v0.1.0 from
      npm)
- [x] [dart-lang/site-www][]

## Appendix - possible later `inject.ts` refactoring

If the current `inject.ts` shape becomes a maintenance problem, consider a later
split along responsibility boundaries:

- target-file PI/block scanning and rewrite orchestration
- PI arg parsing and classification
- source excerpt resolution (`readFile` + region selection)
- fragment rendering (plaster, TOps, scoped replaces, final formatting)

Keep this separate from the current arg-order transition unless it materially
reduces risk.

[open-telemetry/opentelemetry.io]:
  https://github.com/open-telemetry/opentelemetry.io
[dart-lang/site-www]: https://github.com/dart-lang/site-www
[chalin/code_excerpter]: https://github.com/chalin/code_excerpter
[chalin/code_excerpter/test/excerpter_test.dart]:
  https://github.com/chalin/code_excerpter/blob/master/test/excerpter_test.dart
[dart-lang/site-shared pkgs/excerpter test_data]:
  https://github.com/dart-lang/site-shared/tree/main/pkgs/excerpter/test_data
[updater_test.dart]:
  https://github.com/dart-lang/site-shared/blob/main/pkgs/excerpter/test/updater_test.dart
[code_excerpt_updater test_data]:
  https://github.com/chalin/code_excerpt_updater/tree/main/test_data

<!-- cSpell:ignore opentelemetry -->

# Porting Plan

This document tracks the phased porting of the Dart excerpter tooling to
TypeScript.

Product-wide deferrals are in **Deferred** in [`docs/scope.md`](scope.md). Each
section may list limitations that apply to that phase.

---

## Phase 1a — `directive.ts`

Parse `#docregion`/`#enddocregion` directives from source lines. Pure string
logic, no I/O. Port the `Directive` class from [`chalin/code_excerpter`][] with
comment-syntax-aware regex (HTML `-->`, CSS `*/`).

- [x] Implement `src/directive.ts`
- [x] Write `test/directive.test.ts`
- [x] Update docs as needed

## Phase 1b — `extract.ts`

Extract named code regions from source file content. Port the `Excerpter` class
from [`chalin/code_excerpter`][].

- [x] Implement `src/extract.ts`
- [x] Write `test/extract.test.ts`
- [x] Port comprehensive test cases from
      [`chalin/code_excerpter/test/excerpter_test.dart`][] (edge cases, plaster,
      overlapping regions)
- [x] Update docs as needed

Limitations:

- `#docplaster` resolves to directive kind `plaster` in `directive.ts`, but
  `extract.ts` does not handle that kind yet (throws on those lines).

## Phase 2 — `transform.ts`

Transform pipeline: skip, take, from, to, remove, retain, replace, indent. All
pure logic, no I/O.

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
3. [ ] **`--no-escape-ng-interpolation`**: the CLI relies on Commander’s
       handling of negated boolean flags; behavior must stay aligned with
       `injectMarkdown` (`escapeNgInterpolation !== false` means escape).

C. [ ] Test gaps:

1. [x] CLI integration tests in `test/cli.integration.test.ts` (`--help`,
       invalid `--exclude`, `--fail-on-update` with `--dry-run`).
2. [ ] `updatePaths`: assert `log` is called for expected lines; assert
       `warnings` in `UpdateResult` when `onWarning` fires.
3. [x] `updatePaths`: duplicate / overlapping roots (dedupe; see
       `test/update.test.ts`).

## Phase 5 — Integration Testing

Run against [`dart-lang/site-www`](https://github.com/dart-lang/site-www) and
diff output against the Dart tool.

- [ ] Set up integration test harness
- [ ] Run against `dart-lang/site-www`
- [ ] Compare output with the Dart excerpter
- [ ] Document any discrepancies

[`chalin/code_excerpter`]: https://github.com/chalin/code_excerpter
[`chalin/code_excerpter/test/excerpter_test.dart`]:
  https://github.com/chalin/code_excerpter/blob/master/test/excerpter_test.dart
[dart-lang/site-shared pkgs/excerpter test_data]:
  https://github.com/dart-lang/site-shared/tree/main/pkgs/excerpter/test_data
[updater_test.dart]:
  https://github.com/dart-lang/site-shared/blob/main/pkgs/excerpter/test/updater_test.dart
[code_excerpt_updater test_data]:
  https://github.com/chalin/code_excerpt_updater/tree/main/test_data

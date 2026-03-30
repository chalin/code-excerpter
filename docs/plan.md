# Porting Plan

This document tracks the phased porting of the Dart excerpter tooling to TypeScript.

---

## Phase 1a — `directive.ts`

Parse `#docregion`/`#enddocregion` directives from source lines. Pure string
logic, no I/O. Port the `Directive` class from
[`chalin/code_excerpter`](https://github.com/chalin/code_excerpter) with
comment-syntax-aware regex (HTML `-->`, CSS `*/`).

- [ ] Implement `src/directive.ts`
- [ ] Write `test/directive.test.ts`
- [ ] Update docs as needed

## Phase 1b — `extract.ts`

Extract named code regions from source file content. Port the `Excerpter`
class from [`chalin/code_excerpter`](https://github.com/chalin/code_excerpter).

- [ ] Implement `src/extract.ts`
- [ ] Write `test/extract.test.ts`
- [ ] Port comprehensive test cases from
  [`chalin/code_excerpter/test/excerpter_test.dart`](https://github.com/chalin/code_excerpter/blob/master/test/excerpter_test.dart)
  (edge cases, plaster, overlapping regions)
- [ ] Update docs as needed

## Phase 2 — `transform.ts`

Transform pipeline: skip, take, from, to, remove, retain, replace, indent.
All pure logic, no I/O.

- [ ] Implement `src/transform.ts`
- [ ] Write `test/transform.test.ts`
- [ ] Update docs as needed

## Phase 3 — `inject.ts`

Parse `<?code-excerpt?>` instructions in markdown, orchestrate extraction +
transforms per code block.

- [ ] Implement `src/inject.ts`
- [ ] Write `test/inject.test.ts`
- [ ] Update docs as needed

## Phase 4 — `update.ts` + `cli.ts`

Directory walking, file updating, CLI entry point.

- [ ] Implement `src/update.ts`
- [ ] Implement `src/cli.ts`
- [ ] Write `test/update.test.ts`
- [ ] Update docs as needed

## Phase 5 — Integration Testing

Run against [`dart-lang/site-www`](https://github.com/dart-lang/site-www) and
diff output against the Dart tool.

- [ ] Set up integration test harness
- [ ] Run against `dart-lang/site-www`
- [ ] Compare output with the Dart excerpter
- [ ] Document any discrepancies

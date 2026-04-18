# Tests

Vitest drives unit, integration, and golden tests. Run `npm test` (see
[`package.json`](../package.json) → `scripts`).

## Fragment PI argument coverage

Fragment processing-instruction arguments are defined in
[`docs/spec.md`](../docs/spec.md) (Recognized Arguments table). Coverage is
**split by design**:

Role of each test file:

- **`inject-args.test.ts`** — Focused PI arg parsing/classification tests:
  encounter-order preservation, singleton settings, and scope-sensitive
  `replace`.
- **`inject.test.ts`** — Direct `injectMarkdown` calls: PIs, fences, errors,
  set/fragment stats, many edge paths.
- **`transform.test.ts`** — `applyExcerptTransforms` / `parseIndentBy`: per-step
  behavior for line transform operations plus the current batch helper behavior.
  The spec now defines argument Scope/Kind and fragment TOp ordering; these
  tests will move with the transition. See
  [spec § PI Arguments](../docs/spec.md#pi-arguments).
- **`updater-goldens.test.ts`** — Full `injectMarkdown` + `readFile` over
  vendored [`code_excerpt_updater`][] `test_data` fixtures (Dart golden parity).
- **`updater-fixtures.test.ts`** — Full `updatePaths` over normalized repo-owned
  filesystem fixtures under `test/fixtures/updater/` (`input/`, `sources/`,
  `expected/`, `options.yaml`).

Together, every fragment argument below is exercised somewhere.

### Fragment argument coverage

| Argument                     | `inject`[^1] | Args[^2] | Tr[^3] | Examples                                                             |
| ---------------------------- | ------------ | -------- | ------ | -------------------------------------------------------------------- |
| Positional path              | Yes          | —        | —      | Many fixtures                                                        |
| `region`                     | Yes          | Yes      | —      | `basic_with_region.dart`, `test/fixtures/updater/basic-with-region/` |
| `skip`                       | Yes          | Yes      | Yes    | `no_change/skip-and-take.md`                                         |
| `take`                       | —            | —        | Yes    | `no_change/skip-and-take.md`                                         |
| `from`                       | —            | —        | Yes    | `no_change/basic_with_args.md`                                       |
| `to`                         | —            | —        | Yes    | `no_change/basic_with_args.md`                                       |
| `remove`                     | —            | —        | Yes    | `remove.md`, `test/fixtures/updater/remove/`                         |
| `retain`                     | —            | Yes      | Yes    | `retain.md`, `test/fixtures/updater/retain/`                         |
| `replace` (on fragment line) | Partial[^4]  | Yes      | Yes    | `test/fixtures/updater/arg-order/`                                   |
| `indent-by`                  | —            | Yes      | Yes    | `no_comment_prefix.md`, `fragment-indentation.md`                    |
| `plaster`                    | Yes[^5]      | Yes      | —      | `excerpt_yaml/plaster.md`, `test/fixtures/updater/plaster-defaults/` |

[^1]: `inject.test.ts`

[^2]: `inject-args.test.ts`

[^3]: `transform.test.ts`

[^4]: Set-level `replace` only

[^5]: Default plaster-template behavior and local plaster-setting cases

`inject.test.ts` does not re-test every transform keyword; goldens and
`transform.test.ts` cover those paths end-to-end or in isolation.

### `replace` pipeline coverage

Same [`replace` syntax](../docs/spec.md#replace-expressions) as in the spec
(`/regexp/replacement/g`, optional `;`-separated steps). Most **fragment**
`replace=` examples live in **goldens**; `inject.test.ts` mainly uses **set**
`replace` (file-level) plus one **set** pipeline with two steps.

Scenario coverage:

- **One `/re/repl/g` step**
  - `inject.test.ts`: yes (set `replace` on PI; not fragment-only)
  - `transform.test.ts`: yes
  - Goldens: yes (`replace.md`, `arg-order.md`, …)
- **Multiple `;`-separated steps**
  - `inject.test.ts`: yes (set `replace="/a/x/g;/b/y/g"`)
  - `transform.test.ts`: yes (`parseReplacePipeline`)
  - Goldens: yes (`replace.md`)
- **ECMA `GetSubstitution` in replacement (`$1`, `$0`, `$10`, …)**
  - `inject.test.ts`: —
  - `transform.test.ts`: yes (`replace with capture groups`, `$0`, `$10`)
  - Goldens: yes (`replace.md`, e.g. `$1`, `$&`)
- **Whole match in replacement (`$&`)**
  - `inject.test.ts`: —
  - `transform.test.ts`: —
  - Goldens: yes (`replace.md`)

### Related behavior (outside the fragment table)

| Topic                                   | Where                                      |
| --------------------------------------- | ------------------------------------------ |
| Set `path-base` / `replace` / `plaster` | `inject.test.ts`, goldens                  |
| `globalReplace` (CLI-style)             | `inject.test.ts`, golden `replace.md`      |
| Angular interpolation escaping          | updater fixtures, goldens, CLI integration |
| Unsupported `diff-with`                 | `inject.test.ts` (error path)              |
| Liquid `{% prettify %}` fences          | `inject.test.ts`, golden `prettify.md`     |

## Updater test layers

- **`update.test.ts`** — Focused tmp-tree tests for `updatePaths` behavior and
  error/reporting edges.
- **`updater-fixtures.test.ts`** — Deterministic normalized filesystem fixtures
  owned by this repo.
- **`updater-goldens.test.ts`** — Vendored Dart-oriented parity coverage.

[`code_excerpt_updater`]: https://github.com/chalin/code_excerpt_updater

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
- **`updater-fixtures.test.ts`** — Full `updatePaths` over normalized repo-owned
  filesystem fixtures under `test/fixtures/updater/` (`input/`, `sources/`,
  `expected/`, `options.yaml`).

Together, every fragment argument below is exercised somewhere.

### Fragment argument coverage

| Argument                     | `inject`[^1] | Args[^2] | Tr[^3] | Examples                                                             |
| ---------------------------- | ------------ | -------- | ------ | -------------------------------------------------------------------- |
| Positional path              | Yes          | —        | —      | Many fixtures                                                        |
| `region`                     | Yes          | Yes      | —      | `basic_with_region.dart`, `test/fixtures/updater/basic-with-region/` |
| `skip`                       | Yes          | Yes      | Yes    | `transform.test.ts` line-sequence cases                              |
| `take`                       | —            | —        | Yes    | `transform.test.ts` line-sequence cases                              |
| `from`                       | —            | —        | Yes    | `transform.test.ts` line-sequence cases                              |
| `to`                         | —            | —        | Yes    | `transform.test.ts` line-sequence cases                              |
| `remove`                     | —            | —        | Yes    | `remove.md`, `test/fixtures/updater/remove/`                         |
| `retain`                     | —            | Yes      | Yes    | `retain.md`, `test/fixtures/updater/retain/`                         |
| `replace` (on fragment line) | Partial[^4]  | Yes      | Yes    | `test/fixtures/updater/arg-order/`                                   |
| `indent-by`                  | —            | Yes      | Yes    | `inject.test.ts`, `test/fixtures/updater/fragment-indentation/`      |
| `plaster`                    | Yes[^5]      | Yes      | —      | `inject.test.ts`, `test/fixtures/updater/plaster-defaults/`          |

[^1]: `inject.test.ts`

[^2]: `inject-args.test.ts`

[^3]: `transform.test.ts`

[^4]: Set-level `replace` only

[^5]: Default plaster-template behavior and local plaster-setting cases

`inject.test.ts` does not re-test every transform keyword; updater fixtures and
`transform.test.ts` cover those paths end-to-end or in isolation.

### `replace` pipeline coverage

Same [`replace` syntax](../docs/spec.md#replace-expressions) as in the spec
(`/regexp/replacement/g`, optional `;`-separated steps). Most **fragment**
`replace=` examples live in normalized updater fixtures; `inject.test.ts` mainly
uses **set** `replace` (file-level) plus one **set** pipeline with two steps.

Scenario coverage:

- **One `/re/repl/g` step**
  - `inject.test.ts`: yes (set `replace` on PI; not fragment-only)
  - `transform.test.ts`: yes
  - Updater fixtures: yes (`replace/`, `arg-order/`)
- **Multiple `;`-separated steps**
  - `inject.test.ts`: yes (set `replace="/a/x/g;/b/y/g"`)
  - `transform.test.ts`: yes (`parseReplacePipeline`)
  - Updater fixtures: yes (`replace/`)
- **ECMA `GetSubstitution` in replacement (`$1`, `$0`, `$10`, …)**
  - `inject.test.ts`: —
  - `transform.test.ts`: yes (`replace with capture groups`, `$0`, `$10`)
  - Updater fixtures: yes (`replace/`, e.g. `$1`, `$&`)
- **Whole match in replacement (`$&`)**
  - `inject.test.ts`: —
  - `transform.test.ts`: —
  - Updater fixtures: yes (`replace/`)

### Related behavior (outside the fragment table)

| Topic                                   | Where                                         |
| --------------------------------------- | --------------------------------------------- |
| Set `path-base` / `replace` / `plaster` | `inject.test.ts`, updater fixtures            |
| `globalReplace` (CLI-style)             | `inject.test.ts`, updater fixture `replace/`  |
| Angular interpolation escaping          | updater fixtures, CLI integration             |
| Unsupported `diff-with`                 | `inject.test.ts` (error path)                 |
| Liquid `{% prettify %}` fences          | `inject.test.ts`, updater fixture `prettify/` |

## Updater test layers

- **`update.test.ts`** — Focused tmp-tree tests for `updatePaths` behavior and
  error/reporting edges.
- **`updater-fixtures.test.ts`** — Deterministic normalized filesystem fixtures
  owned by this repo.

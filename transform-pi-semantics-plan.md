# Transition Fragment PI Semantics: Archived Transition Record

<!-- markdownlint-disable ol-prefix -->

## Current status

- Steps 0 through 5 landed and are now the repo's current behavior.
- The intended fragment PI semantic transition is complete for the repo-owned
  spec, code, and tests.
- Remaining skipped legacy parity cases in `test/updater-goldens.test.ts` are
  no longer tracked as part of this transition; treat them as separate fixture /
  parity cleanup under [`docs/plan.md`](docs/plan.md).
- The `inject.ts` refactor note below is now optional later cleanup, not a
  required completion step for this transition.

## Summary

- Adopt the new fragment-PI model:
  - **Transform operations (TOs)**: `from`, `remove`, `replace`, `retain`,
    `skip`, `take`, `to`; applied strictly in encounter order; repeats allowed.
  - **Fragment settings (FSs)**: `indent-by`, `plaster`; not part of the TO
    chain.
  - `plaster` values are full plaster templates, not just plaster strings.
  - Duplicate FSs are an error; the fragment is left untouched.
  - Invalid FS values are an error; the fragment is left untouched.
- Make the transition explicitly **spec-first**, then do a staged bottom-up TDD
  migration.

## Transition Steps

0. [x] **Update the spec first**
   - Revise [`docs/spec.md`](docs/spec.md) to define the new semantics before
     code or tests move.
   - Remove the old repeated-transform coalescing rule.
   - Define TOs vs FSs clearly.
   - State the duplicate/invalid FS error behavior and "leave fragment
     untouched" outcome.
   - Update any nearby docs/comments that would otherwise contradict the new
     spec.

1. [x] **Set affected tests to skip**
   - Mark all tests that currently encode the old transform/coalescing semantics
     as skipped before implementation starts.
   - This includes the relevant cases in:
     - [`test/transform.test.ts`](test/transform.test.ts)
     - [`test/inject.test.ts`](test/inject.test.ts)
     - [`test/updater-goldens.test.ts`](test/updater-goldens.test.ts)
   - Skip only semantics-affected cases where practical; if that is noisy or
     fragile, skip the broader ordering-related groups temporarily.

2. [x] **Refactor the transform layer**
   - Change [`src/transform.ts`](src/transform.ts) to support execution from an
     ordered TO list rather than `keyOrder + map`.
   - Keep `indent-by` out of TO execution.
   - Add/replace unit tests in `test/transform.test.ts` to drive:
     - repeated TO preservation
     - strict encounter order
     - no coalescing

3. [x] **Refactor PI parsing and injection**
   - Change [`src/inject.ts`](src/inject.ts) so fragment PIs parse into:
     - an ordered TO list
     - a separate FS structure
   - Detect duplicate FSs during parse/validation.
   - Validate single FS values before applying the fragment.
   - Preserve current outer phases:
     - excerpt extraction
     - plaster via FS
     - ordered TO chain
     - file/global replace
     - final indentation via FS
   - Add/update `test/inject.test.ts` for:
     - repeated TOs
     - TO ordering
     - duplicate `indent-by`
     - duplicate `plaster`
     - invalid FSs leaving the fragment untouched

4. [x] **Rework arg-processing semantics, code, and tests**

This was previously step 3b, originally focused on **Refactor arg-processing
tests**. But I realized that arg-processing semantics were wrongly specified and
implemented. That is, v0.1.0 had an arg-processing order based on arg kind. I
can't recall if any of the original tools had any such semantics. The proper
semantics, as documented in the Dart tool spec, is arg-order.

The early TS spec was wrongly inferred from the upstream Dart tool spec in
[chalin/code_excerpt_updater](https://github.com/chalin/code_excerpt_updater).
Maybe this was because one of the repo README's had a note about `retain` args
being processed before `replace`, but even that conflicted with its own goldens.
Anyhow, this step is to recover the proper in-appearance order processing of PI
args.

Next are some of the original steps for 3b:

- Extract focused tests for PI argument parsing/classification so repeated TOs,
  singleton settings, and scope-sensitive `replace` behavior are not covered
  only through full `injectMarkdown` flows.
- Keep `inject.test.ts` for integration-style PI/block behavior and error
  outcomes, but move parser-shape assertions into a narrower test surface.
- Exported `parseNamedArgs` / `parseFragmentArgs` from `inject.ts` only to
  support those direct arg-processing tests; this is not yet a broader
  `inject.ts` refactor.
- Use the extracted tests to document:
  - exact encounter-order preservation for repeated TOs
  - singleton-setting rejection for `region`, `indent-by`, and `plaster`
  - `replace` behaving as `S/TOp` depending on scope

So, this step now also includes correcting:

- The spec, code, and tests to use the proper arg-order semantics.
- Ensuring that all docs, code, and tests are self- and mutually consistent.

> Note the spec may be in an inconsistent state wrt plaster processing. We're
> accepting this as temporary, and will fix it in the next step.

5. [x] **Revisit plaster spec and processing**

Plaster spec, code, and tests cleanup.

- Consider dropping `ParsedNamedArgEntry.hasValue` if `value === undefined`
  remains sufficient to distinguish bare args from `key=""`.

6. [ ] **Optional later `inject.ts` refactor**

- No longer required to complete the fragment PI semantic transition.
- If `inject.ts` becomes a maintenance problem later, track that work under
  [`docs/plan.md`](docs/plan.md) instead of this archived transition plan.

7. [ ] **Optional legacy parity cleanup**

- Remaining updater-golden parity cleanup is now separate from the semantic
  transition itself.
- Track any future work on `arg-order.md` or related legacy fixtures under
  [`docs/plan.md`](docs/plan.md).

8. [x] **Higher layers re-enabled for current shipped behavior**

- `updatePaths`, CLI, and the current regression harness reflect the new
  repo-owned semantics.
- Remaining skipped legacy parity cases are intentional and out of scope for
  this archived transition record.

## Public Interface / Behavior Changes

- Fragment transform semantics change from "first occurrence position, last
  value wins" to "every TO occurrence is preserved and applied in encounter
  order."
- `indent-by` and `plaster` are no longer treated as transform-order
  participants.
- Duplicate or invalid FSs become hard fragment errors that preserve the
  existing fenced block content.

## Test Scenarios

- `replace` then `retain` differs from `retain` then `replace`.
- Repeated same-key TOs run multiple times in sequence.
- Mixed repeated TOs preserve exact encounter order.
- Duplicate `indent-by` errors and leaves block unchanged.
- Duplicate `plaster` errors and leaves block unchanged.
- Invalid `indent-by` errors and leaves block unchanged.
- Invalid `plaster` value errors and leaves block unchanged.
- File-level/global replace still runs after fragment TOs.

## Assumptions

- Only `indent-by` and `plaster` are FSs.
- "Leave fragment untouched" means preserve the existing fenced block body for
  that PI after reporting the error.
- This is an intentional divergence from Dart parity, and docs/tests should say
  so where relevant.

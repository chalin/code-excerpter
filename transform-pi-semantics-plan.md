# Transition Fragment PI Semantics: Spec First, Then Bottom-Up TDD

## Summary

- Adopt the new fragment-PI model:
  - **Transform operations (TOs)**: `from`, `remove`, `replace`, `retain`,
    `skip`, `take`, `to`; applied strictly in encounter order; repeats allowed.
  - **Fragment settings (FSs)**: `indent-by`, `plaster`; not part of the TO
    chain.
  - Duplicate FSs are an error; the fragment is left untouched.
  - Invalid FS values are an error; the fragment is left untouched.
- Make the transition explicitly **spec-first**, then do a staged bottom-up TDD
  migration.

## Transition Steps

0. **Update the spec first**
   - Revise [`docs/spec.md`](docs/spec.md) to define the new semantics before
     code or tests move.
   - Remove the old repeated-transform coalescing rule.
   - Define TOs vs FSs clearly.
   - State the duplicate/invalid FS error behavior and "leave fragment
     untouched" outcome.
   - Update any nearby docs/comments that would otherwise contradict the new
     spec.

1. **Set affected tests to skip**
   - Mark all tests that currently encode the old transform/coalescing semantics
     as skipped before implementation starts.
   - This includes the relevant cases in:
     - [`test/transform.test.ts`](test/transform.test.ts)
     - [`test/inject.test.ts`](test/inject.test.ts)
     - [`test/updater-goldens.test.ts`](test/updater-goldens.test.ts)
   - Skip only semantics-affected cases where practical; if that is noisy or
     fragile, skip the broader ordering-related groups temporarily.

2. **Refactor the transform layer**
   - Change [`src/transform.ts`](src/transform.ts) to support execution from an
     ordered TO list rather than `keyOrder + map`.
   - Keep `indent-by` out of TO execution.
   - Add/replace unit tests in `test/transform.test.ts` to drive:
     - repeated TO preservation
     - strict encounter order
     - no coalescing

3. **Refactor PI parsing and injection**
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

4. **Rework golden expectations**
   - Update or replace the old parity-oriented expectations in
     `test/updater-goldens.test.ts`.
   - Treat `arg-order.md` as TS-owned semantics, not Dart-parity semantics.
   - Add one golden covering duplicate FS error behavior if unit/inject tests
     are not sufficient.

5. **Re-enable higher layers and finish**
   - Re-enable skipped tests incrementally from bottom to top.
   - Run/update [`test/update.test.ts`](test/update.test.ts) and
     [`test/cli.integration.test.ts`](test/cli.integration.test.ts) only for any
     observable error/reporting changes caused by the new fragment behavior.
   - Remove stale comments/docs that still describe Dart-style coalescing.

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

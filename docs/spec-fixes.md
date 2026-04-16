# Spec parity backlog

Optional checklist of **remaining** gaps between
[`chalin/code_excerpt_updater`](https://github.com/chalin/code_excerpt_updater)
README behavior/notes and [`docs/spec.md`](spec.md). Transform ordering and
fragment-setting semantics are documented in
[§ Transform operations and fragment settings](spec.md#transform-operations-and-fragment-settings).

- [ ] Document negative `skip` / `take` in the Recognized Arguments table (see
      README and `applySkip` / `applyTake` in `src/transform.ts`).
- [ ] Document region-name normalization (non-word runs → `-`) for `(region)`
      and `region=`.
- [ ] Document leading-`/` string escape (`\/…`) for `remove` / `retain` /
      `from` / `to` string patterns.
- [ ] Document `$defaultPlaster` in the plaster section.

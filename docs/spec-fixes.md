# Spec parity backlog

Optional checklist of **remaining** gaps between
[`chalin/code_excerpt_updater`](https://github.com/chalin/code_excerpt_updater)
README behavior/notes and [`docs/spec.md`](spec.md). Transform **argument
order** is documented in
[§ Processing order of transform arguments](spec.md#processing-order-of-transform-arguments).

- [ ] Document negative `skip` / `take` in the Recognized Arguments table (see
      README and `applySkip` / `applyTake` in `src/transform.ts`).
- [ ] Document region-name normalization (non-word runs → `-`) for `(region)`
      and `region=`.
- [ ] Document leading-`/` string escape (`\/…`) for `remove` / `retain` /
      `from` / `to` string patterns.
- [ ] Document `$defaultPlaster` in the plaster section.

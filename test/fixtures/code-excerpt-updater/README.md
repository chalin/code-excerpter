# `code_excerpt_updater` golden fixtures

This directory vendors `test_data/` from
[`chalin/code_excerpt_updater`](https://github.com/chalin/code_excerpt_updater)
(MIT license) so Vitest can assert byte-for-byte parity with the Dart updater’s
expected outputs under `test_data/expected/`.

Repo-owned divergence goldens live under `test_data/expected-local/`. The test
harness prefers those files over vendored `test_data/expected/` for the same
relative path.

## Generated output (`generated/`)

The **`generated/`** directory is **committed** (with `.gitkeep` and a local
`.gitignore` that ignores `*` except those placeholders) so a fresh clone
already contains it; **files produced by tests** stay untracked.

Each `npm run test:base` run (or `vitest run test/updater-goldens.test.ts`)
clears prior output, then writes inject results under **`generated/`** using the
**same paths** as under `test_data/src/` (for example `generated/arg-order.md`,
`generated/no_change/basic_with_args.md`). Compare locally against goldens,
for example:

```bash
diff -u test/fixtures/code-excerpt-updater/test_data/expected/arg-order.md \
        test/fixtures/code-excerpt-updater/generated/arg-order.md
```

Update by copying from a fresh checkout of that repository’s `test_data/`
tree when upstream goldens change.

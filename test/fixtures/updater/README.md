# Updater Fixture Cases

This directory contains normalized fixture cases for updater tests.

Rules:

- Use only supported PI syntax: `id="value"`.
- Do not use bare or valueless PI args.
- Do not use single-quoted PI arg values.
- Keep fixture prose and expectations aligned with current tool semantics.
- Keep each case self-contained under one directory.

Each case lives under `<case-name>/` and contains:

- `input/`: target files copied into a temporary generated worktree before the
  test
- `sources/`: excerpt source files copied into the generated worktree
- `expected/`: files that should exist after the updater runs
- `options.json`: per-case updater options

Generated working copies are written under `test/generated/updater/`.

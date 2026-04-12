# Conventions

Project conventions for code, documentation, and tests.

## Code

- Keep code (including tests) very [DRY][].

### TypeScript / Node.js

- **Module system**: ESM throughout. Use `import`/`export`, never `require()`.
- **TypeScript**: Strict mode enabled (`"strict": true` in `tsconfig.json`).
- **Built-in imports**: Always use the `node:` prefix (e.g., `node:fs/promises`,
  `node:path`, `node:url`).
- **Async I/O**: Prefer `node:fs/promises` for all file operations.
- **Naming**: Use camelCase for variables/functions, PascalCase for classes and
  types/interfaces.
- **Formatting**: 2-space indentation, 100-character line width. **Prettier**
  enforces layout; **ESLint** covers lint rules (see
  [docs/tooling.md](tooling.md)).
- **No default exports**: Use named exports everywhere in `src/` and `test/`.
  Bundler or test **config files** may use `export default` when the tool API
  requires it (for example `tsup.config.ts`, `vitest.config.ts`).

### Tests (Vitest)

When a test fails, the output should make it obvious **what** was checked and
show a **clear diff** between actual and expected, without long hand-written
messages. (Same goals as described for Node’s `assert` in the OpenTelemetry
site’s [testing notes][otel-testing]; the ideas map directly to Vitest.)

1. Prefer **strict, diff-friendly matchers** (for example `expect(x).toBe(y)`,
   `toEqual` / `toStrictEqual` for objects) instead of checks that only collapse
   to “expected true, got false.”
2. Use a **short message** on `expect` when it names the field or case under
   test (for example issue kind, region name), not a paragraph of prose.
3. When intent is “matches this pattern,” prefer **`toMatch`** (or an
   equivalent) over a chain of vague `ok` / `includes` logic.
4. **DRY test code:** put repeated assertions or small test-only helpers in a
   module **colocated with the tests** that use them (for example under `test/`)
   and import them—do not copy-paste the same check across files unless it truly
   belongs inline once.

## Documentation

This includes project README, AGENTS, and other docs, as well as code comments
and `.github/copilot-instructions.md`.

- Keep docs [DRY][], **terse**, and **lean**: short prose, no unnecessary
  detail, and no sections that only restate a canonical file—link to it instead
  (for example `package.json` for scripts and dependency pins).
- Use simple, multilingual prose. Avoid idiomatic English.

### AI guidance

- Keep **[AGENTS.md](../AGENTS.md)** minimal: add depth in the appropriate
  `docs/*.md` file and link from AGENTS; do not duplicate long architecture or
  lineage write-ups, data-flow diagrams, or `package.json` script listings here.

[DRY]: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
[otel-testing]:
  https://github.com/open-telemetry/opentelemetry.io/blob/c48fe2d260c56d6f60916db3b804e67372b3df8d/content/en/site/testing/_index.md

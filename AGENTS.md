# AGENTS.md — AI Agent Instructions for `code-excerpter`

Instructions for AI coding agents (GitHub Copilot, OpenAI Codex, Claude, and
similar) working on this repository. Agent-agnostic. When adding guidance,
extend `docs/` and link from here; keep this file a short index (see
[docs/conventions.md](docs/conventions.md#ai-guidance)).

**Project:** `code-excerpter` is a TypeScript port of the Dart excerpter tooling
used for site documentation. Start with [README.md](README.md) for the public
overview, installation, and clone workflow.

**Documentation:**

- [docs/architecture.md](docs/architecture.md) — Module map, data flow, Dart
  repository lineage, Dart→TypeScript porting notes
- [docs/spec.md](docs/spec.md) — `<?code-excerpt?>` instruction syntax and
  transform order
- [docs/plan.md](docs/plan.md) — Phased porting plan with progress checkboxes
- [docs/scope.md](docs/scope.md) — Feature scoping for v1
- [docs/tooling.md](docs/tooling.md) — Tooling stack, rationale, and how scripts
  fit together (canonical script list: `package.json` → `scripts`)
- [docs/conventions.md](docs/conventions.md) — Code style, Vitest testing style,
  documentation DRY rules, commit and PR expectations, and how to extend AGENTS
  vs `docs/`

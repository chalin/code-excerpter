# Specification: `<?code-excerpt?>` processing instruction syntax and more

This document specifies:

- `<?code-excerpt?>` processing instruction syntax and semantics
- [Markdown input assumptions](#markdown-input-assumptions)
- [Instruction and fence prefixes](#instruction-and-fence-prefixes)
- [Source file directives](#source-file-directives): `#docregion` /
  `#enddocregion`
- [Plaster handling](#plaster-handling)

---

## `<?code-excerpt?>` processing instruction (PI)

The `code-excerpter` processes markdown files looking for XML **processing
instructions** (PIs) of the form `<?code-excerpt?>`. PIs identify the source
file, region, and transforms to apply to the code excerpt, allowing for
`code-excerpter` to refresh code blocks when their originating source code
changes.

## Markdown input assumptions

The `code-excerpter` tool is a simple line-oriented scanner, not a full Markdown
parser. It scans lines for processing instructions and fenced blocks with
regex-based rules. Inputs are assumed to be well-formed Markdown with processing
instructions.

After a fragment instruction, the next non-empty line should be an opening
fence, and a matching close fence of the same kind should appear before the next
excerpt block. Malformed nesting, unbalanced fences, or excerpts embedded in
contexts where those lines are not real fences (for example inside indented code
blocks) are not modeled. Some cases surface as errors; others may parse
incorrectly without a Markdown-aware error. Behavior can diverge from a
spec-compliant Markdown implementation.

## Instruction Forms

### Code fragment instruction

Specifies a source file (and optionally a named region) to inject:

```text
<?code-excerpt "path/to/file.ext (region-name)" arg1="val1" arg2="val2"?>
```

- The first positional argument is a quoted path + optional region string.
- The path is relative to the configured `path-base`.
- The region name (in parentheses) is optional; if it is omitted and no
  `region=` argument is given, the **default region** (empty name) is used.
  Source files:
  - **without** `#docregion` / `#enddocregion` yield the entire file (minus
    directives).
  - **with** `#docregion` / `#enddocregion` directives resolve the
    [Default region](#default-region).
- Additional named arguments follow as `key="value"` pairs.

**Example:**

````markdown
<?code-excerpt "lib/main.dart (setup)"?>

```dart
// extracted content here
```
````

Supported fences are:

- Markdown code-block fences using either syntax:
  - backtick fences (` ``` ` ... ` ``` `) or
  - tilde fences (`~~~` … `~~~`)
- Hugo/Liquid `{% prettify … %}` ... `{% endprettify %}` pairs.

### Set instruction

Sets a persistent value for the current file. Typical keys are `path-base`,
file-level `replace`, and file-level `plaster`:

```text
<?code-excerpt path-base="examples/ng/doc"?>
```

A set instruction has no path argument and no following code block. Each set
line must contain **at most one** named argument (or one bare flag such as
`plaster` with no `=`). Set values apply to all subsequent fragment instructions
in the same file until another set instruction for that key replaces them.

## PI Arguments

Fragment instructions may use the following named arguments (plus the positional
path string). Set instructions accept **only** `path-base`, `replace`,
`plaster`, or no-op compatibility keys `class` / `title`—see
[Set instruction](#set-instruction); any other set key triggers a warning.

| Argument        | Scope | Kind  | Argument values              | Description                                                     |
| --------------- | ----- | ----- | ---------------------------- | --------------------------------------------------------------- |
| _(path string)_ | F     | -     | _string_                     | Positional: `"path/file.ext (region)"`                          |
| `path-base`     | S     | S     | _string_                     | Sets the base directory for source file paths                   |
| `region`        | F     | S     | _string_                     | Named region to extract (alternative to inline `(region)`)      |
| `from`          | F     | TOp   | _string_ \| `/regex/`        | Start extraction from the first line matching this pattern      |
| `to`            | F     | TOp   | _string_ \| `/regex/`        | End after the first line matching this pattern (that line kept) |
| `skip`          | F     | TOp   | _integer_                    | Skip the first N lines of the extracted region                  |
| `take`          | F     | TOp   | _integer_                    | Take only the first N lines of the extracted region             |
| `remove`        | F     | TOp   | _string_ \| `/regex/`        | Remove all lines matching this pattern                          |
| `retain`        | F     | TOp   | _string_ \| `/regex/`        | Keep only lines matching this pattern                           |
| `replace`       | GSF   | S/TOp | `/pattern/replacement/g;`... | Regex replacement expressions (details below)                   |
| `indent-by`     | GSF   | S     | _integer_                    | Indent every fragment line by the given number of spaces        |
| `plaster`       | GSF   | S     | _string_                     | Sets the plaster (details below)                                |

Legend:

- Scope is either:
  - Global (G), currently via CLI options
  - File-scoped set instruction (S) or fragment instruction (F)
- Kind indicates the kind of argument:
  - Transform operation (TOp) of a fragment instruction
  - Setting (S) of a fragment or set instruction: can appear at most once.
    Repeated arguments are reported as errors.

> TODO: `indent-by` global and file-level settings support is not implemented
> yet.

### Global settings

Global CLI settings are scoped to all files:

- `indent-by` sets a global indent by value.
- `path-base` sets a global base directory for source file paths.
- `plaster` sets a global plaster template.
- `replace` sets a global replacement expression.

### Set instructions

Set instruction settings have file-level scope, and apply to all subsequent
fragment instructions in the same file. Precedence:

- `indent-by`: overrides global settings
- `path-base`: appends to the global base directory
- `plaster`: overrides global settings
- `replace`: see [Replace order](#replace-order)

### Fragment instructions

Within a fragment instruction:

- TOps are applied strictly in the order they appear in the fragment PI.
- There can be more than one instance of a TOp; every occurrence is preserved
  and applied.

Fragment-setting semantics:

- `plaster` determines the plaster comment for the fragment. Applied before
  transformations.
- `indent-by` is applied after the excerpt content has been fully transformed.
  Overrides file-level and global settings.
- Repeating `indent-by` or `plaster` on the same fragment instruction is an
  error; the existing fragment block is left unchanged.
- An invalid setting value is also an error; the existing fragment block is left
  unchanged.

### Replace expressions

The `replace` can be followed by a list of one or more semicolon-separated
substitution expressions. Each expression is of the form:

```text
/pattern/replacement/g
```

For example:

```text
/hello/bonjour/g;/world/mundo/g
```

Each **replacement** string uses the same rules as [String.replace()][] with a
string replacer.

- `$$` → literal `$`; `$&` → full match; `` $` `` → text before the match; `$'`
  → text after the match.
- `$1`–`$99` → numbered captures when valid (two-digit indices use ECMA’s
  two-then-one-digit rule, e.g. one group and `$10` → group `1` plus literal
  `0`). If the index is missing or out of range, the `$…` sequence is kept
  literally (e.g. no parens → `$1` stays `$1`).
- `$` followed only by `0` digits (e.g. `$0`, `$00`) → those characters
  literally, not a “group 0” (use `$&` for the full match).

For the full algorithm, see [ECMA-262 `GetSubstitution`][].

### Replace order

- Fragment-scoped `replace` expressions are applied first, in the order they
  appear in the fragment PI.
- The last set-instruction `replace` expression is applied next.
- Finally the global `replace` expression is applied.

[ECMA-262 `GetSubstitution`]: https://tc39.es/ecma262/#sec-getsubstitution
[String.replace()]:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace

### Limitations

- XML processing instructions cannot contain `>` (including inside quoted
  attribute values). For a regexp that must match `>`, use an escape such as
  `\x3E` instead of a literal `>`.

## Instruction and fence prefixes

### PI line prefixes

In addition to indentation, a `<?code-excerpt?>` line may include an optional
margin token prefix:

- Markdown list bullet: `-` or `*`
- Line comment prefix: `//` or `///`

### Fence line prefixes

- Line comment prefix: `//` or `///`

## Optional trailing whitespace for instruction lines

Any whitespace following the closing `?>` is ignored. Any non-whitespace after
the closing `?>` is reported via a warning and the document is left unchanged
for that line.

---

## Source file directives

Source files mark extractable regions using the following `#docregion` /
`#enddocregion` directives in comments.

### Syntax

For example, in C-like languages:

```text
// #docregion greetings
void main() {
  print('Hello, world!');
}
// #enddocregion greetings
```

Multiple region names can be listed on a single directive line, separated by
commas:

```text
// #docregion setup, imports
```

The directive comment syntax depends on the source file language, for example:

| File type                  | Directive form        |
| -------------------------- | --------------------- |
| C, C++, Dart, JS, TS, SCSS | `// #docregion`       |
| CSS                        | `/* #docregion */`    |
| HTML                       | `<!-- #docregion -->` |
| YAML                       | `# #docregion`        |

### Default region

A `#docregion` without a region name (or with an empty name) opens the default
region.

If the file uses `#docregion` / `#enddocregion` but never opens that unnamed
default explicitly, the tool may still attach default-region content from its
full-file capture (Dart excerpt updater parity).

When a file has **no** `#docregion` / `#enddocregion` lines, region extraction
does not use a region map; a fragment PI that requests the default region then
receives the full file with directive-looking lines removed (same idea as the
fragment bullet above).

### Overlapping regions

Multiple regions can overlap:

```dart
// #docregion all
// #docregion setup
final x = 1;
// #enddocregion setup
final y = 2;
// #enddocregion all
```

Extracting region `all` yields both lines; extracting `setup` yields only the
first.

---

## Plaster Handling

When a region is composed of non-contiguous segments (e.g., a region opened and
closed multiple times), a _plaster_ comment is inserted between the segments to
indicate that content has been omitted.

The default plaster consists of three dots (`···`) inside a language-specific
comment, for example:

| Language     | Plaster comment |
| ------------ | --------------- |
| Dart, JS, TS | `// ···`        |
| HTML         | `<!-- ··· -->`  |
| CSS, SCSS    | `/* ··· */`     |
| YAML         | `# ···`         |

Those language-shaped defaults apply when excerpt injection runs in **YAML
excerpt mode** (`MarkdownInjectContext.excerptsYaml`); otherwise the extractor
still inserts the raw `···` marker between segments and it is passed through
unchanged (unless overridden or removed via `plaster`).

The plaster can be overridden per-instruction with the `plaster` argument, or
disabled entirely with `plaster="none"`.

## Acknowledgments

This specification was originally adapted from the
[`chalin/code_excerpt_updater`][] README, which is the canonical reference.

[`chalin/code_excerpt_updater`]: https://github.com/chalin/code_excerpt_updater

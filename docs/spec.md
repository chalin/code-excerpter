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

## Recognized Arguments

Fragment instructions may use the following named arguments (plus the positional
path string). Set instructions accept **only** `path-base`, `replace`,
`plaster`, or no-op compatibility keys `class` / `title`—see
[Set instruction](#set-instruction); any other set key triggers a warning.

| Argument name   | Argument values              | Description                                                           |
| --------------- | ---------------------------- | --------------------------------------------------------------------- |
| _(path string)_ | _string_                     | Positional: `"path/file.ext (region)"`                                |
| `path-base`     | _string_                     | Sets the base directory for source file paths (set instruction)       |
| `region`        | _string_                     | Named region to extract (alternative to inline `(region)`)            |
| `from`          | _string_ \| `/regex/`        | Start extraction from the first line matching this pattern            |
| `to`            | _string_ \| `/regex/`        | End after the first line matching this pattern (that line kept)       |
| `skip`          | _integer_                    | Skip the first N lines of the extracted region                        |
| `take`          | _integer_                    | Take only the first N lines of the extracted region                   |
| `remove`        | _string_ \| `/regex/`        | Remove all lines matching this pattern                                |
| `retain`        | _string_ \| `/regex/`        | Keep only lines matching this pattern                                 |
| `replace`       | `/pattern/replacement/g;`... | Regex replace within extracted lines (supports multiple replacements) |
| `indent-by`     | _integer_                    | Prepend N spaces to every output line                                 |
| `plaster`       | _string_                     | Override the plaster comment (use `"none"` to disable)                |

On a fragment instruction, `replace` and `plaster` participate in the transform
or plaster pass for that excerpt only. As the **sole** argument on a
[set instruction](#set-instruction), they set file-level defaults (`replace`
runs on the joined excerpt after fragment transforms; `plaster` sets the
template for later fragments, and bare `plaster` clears the file default).

### Replace expressions

The `replace` can be followed by a list of one or more semicolon-separated (`;`)
Perl-like substitution expressions, but with JavaScript semantics. Each
expression is of the form:

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

[ECMA-262 `GetSubstitution`]: https://tc39.es/ecma262/#sec-getsubstitution
[String.replace()]:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace

### Limitations

- XML processing instructions cannot contain `>` (including inside quoted
  attribute values). For a regexp that must match `>`, use an escape such as
  `\x3E` instead of a literal `>`.

## Processing Order of Arguments

When multiple transform arguments are present, `code-excerpter` applies them in
**the order they appear** in the processing instruction.

The usual relative order is:

1. `skip`
2. `take`
3. `from`
4. `to`
5. `remove`
6. `retain`
7. `replace`

`indent-by` is handled separately after the transform chain.

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

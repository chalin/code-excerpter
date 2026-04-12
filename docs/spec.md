# Specification: `<?code-excerpt?>` Instruction Syntax

This document specifies the `<?code-excerpt?>` processing instruction syntax
used to inject code excerpts into markdown documentation files. It is adapted
from the
[`chalin/code_excerpt_updater`](https://github.com/chalin/code_excerpt_updater)
README, which is the canonical reference.

---

## Overview

`code-excerpter` processes markdown files looking for XML processing
instructions of the form `<?code-excerpt?>`. When found, the tool extracts the
referenced code from the source file, applies any transforms, and replaces the
fenced code block that immediately follows the instruction.

---

## Instruction Forms

### Code fragment instruction

Specifies a source file (and optionally a named region) to inject:

```text
<?code-excerpt "path/to/file.ext (region-name)" arg1="val1" arg2="val2"?>
```

- The first positional argument is a quoted path + optional region string.
- The path is relative to the configured `path-base`.
- The region name (in parentheses) is optional; if omitted, the default region
  is used (the entire file, minus directive lines).
- Additional named arguments follow as `key="value"` pairs.

**Example:**

````markdown
<?code-excerpt "lib/main.dart (setup)"?>

```dart
// extracted content here
```
````

### Set instruction

Sets a persistent value for the current file, such as `path-base`:

```text
<?code-excerpt path-base="examples/ng/doc"?>
```

A set instruction has no path argument and no following code block. It affects
all subsequent code fragment instructions in the same file.

---

## Recognized Arguments

| Argument        | Type                         | Description                                                     |
| --------------- | ---------------------------- | --------------------------------------------------------------- |
| _(path string)_ | string                       | Positional: `"path/file.ext (region)"`                          |
| `path-base`     | string                       | Sets the base directory for source file paths (set instruction) |
| `region`        | string                       | Named region to extract (alternative to inline `(region)`)      |
| `from`          | string/regex                 | Start extraction from the first line matching this pattern      |
| `to`            | string/regex                 | End after the first line matching this pattern (that line kept) |
| `skip`          | integer                      | Skip the first N lines of the extracted region                  |
| `take`          | integer                      | Take only the first N lines of the extracted region             |
| `remove`        | string/regex                 | Remove all lines matching this pattern                          |
| `retain`        | string/regex                 | Keep only lines matching this pattern                           |
| `replace`       | `"pattern" -> "replacement"` | Regex replace within extracted lines                            |
| `indent-by`     | integer                      | Prepend N spaces to every output line                           |
| `plaster`       | string                       | Override the plaster comment (use `"none"` to disable)          |

### Limitations

- XML processing instructions cannot contain unescaped `>` characters. Use
  `&gt;` if a `>` is needed in a pattern value.

---

## Processing Order of Arguments

When multiple transform arguments are present, they are applied in this order:

1. `skip`
2. `take`
3. `from`
4. `to`
5. `remove`
6. `retain`
7. `replace`
8. `indent-by`

---

## Comment-Prefixed Instructions

`<?code-excerpt?>` instructions may be preceded by a comment prefix when the
markdown file requires it (e.g., inside an HTML comment block):

<!-- prettier-ignore -->
```markdown
// <?code-excerpt "lib/main.dart"?>
/// <?code-excerpt "lib/main.dart"?>
```

The tool strips leading `//` or `///` prefixes before parsing the instruction.

---

## Source File Directives: `#docregion` / `#enddocregion`

Source files mark extractable regions using special directive comments.

### Syntax

```text
// #docregion region-name
// #enddocregion region-name
```

Multiple region names can be listed on a single directive line, separated by
commas:

```text
// #docregion setup, imports
```

The directive comment prefix depends on the file type:

| File type          | Directive form        |
| ------------------ | --------------------- |
| Dart, JS, TS, SCSS | `// #docregion`       |
| HTML               | `<!-- #docregion -->` |
| CSS                | `/* #docregion */`    |
| YAML               | `# #docregion`        |

### Default region

A `#docregion` without a region name (or with an empty name) opens the default
region. The entire file (minus directive lines) is also available as the default
region even without explicit directives.

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

The default plaster text is language-specific:

| Language     | Plaster comment |
| ------------ | --------------- |
| Dart, JS, TS | `// ···`        |
| HTML         | `<!-- ··· -->`  |
| CSS, SCSS    | `/* ··· */`     |
| YAML         | `# ···`         |

The plaster can be overridden per-instruction with the `plaster` argument, or
disabled entirely with `plaster="none"`.

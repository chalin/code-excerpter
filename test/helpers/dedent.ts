/** Tagged template helpers for de-indenting strings.
 *
 * Naming is as follows:
 */

/**
 * Tagged template helper: interpolates strings and values, then strips the
 * leading newline, removes the common indentation of all non-blank lines, and
 * removes trailing blank lines.
 */

function interpolate(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string[] {
  let raw = strings[0] ?? '';
  for (let i = 0; i < values.length; i++) {
    raw += String(values[i]) + (strings[i + 1] ?? '');
  }
  const noLeading = raw.startsWith('\n') ? raw.slice(1) : raw;
  return noLeading.split('\n');
}

/**
 * Tagged template helper: strips the leading newline, removes the common
 * indentation of all non-blank lines, and removes trailing blank lines.
 * Allows multi-line test content to be indented naturally in source, mirroring
 * the Dart triple-quoted string style.
 */
export function dedentMax(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  const lines = interpolate(strings, ...values);
  while (lines.length > 0 && /^\s*$/.test(lines[lines.length - 1]!))
    lines.pop();
  let minIndent = Number.POSITIVE_INFINITY;
  for (const l of lines) {
    if (l.trim() !== '') {
      const indent = l.length - l.trimStart().length;
      if (indent < minIndent) minIndent = indent;
    }
  }
  if (minIndent === 0 || minIndent === Number.POSITIVE_INFINITY)
    return lines.join('\n');
  return lines.map((l) => l.slice(minIndent)).join('\n');
}

/**
 * Tagged template helper: strips the leading newline, then uses the trailing
 * whitespace-only line's indentation as the amount to trim from each content
 * line. This preserves intentional extra indentation beyond the closing
 * template line's margin.
 */
export function dedent0(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  const lines = interpolate(strings, ...values);
  if (lines.length === 0) return '';

  let trimIndent = '';
  const lastLine = lines[lines.length - 1] ?? '';
  if (/^\s*$/.test(lastLine)) {
    trimIndent = lastLine;
    lines.pop();
  }

  while (lines.length > 0 && /^\s*$/.test(lines[lines.length - 1]!)) {
    lines.pop();
  }
  if (lines.length === 0) return '';
  if (trimIndent === '') return lines.join('\n');

  return lines
    .map((line) => {
      if (line.trim() === '') return '';
      return line.startsWith(trimIndent) ? line.slice(trimIndent.length) : line;
    })
    .join('\n');
}

/**
 * Tagged template helper: behaves like {@link dedent0}, then removes two more
 * leading spaces from each non-blank line when present.
 */
export function dedent2(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  return dedent0(strings, ...values)
    .split('\n')
    .map((line) => {
      if (line.trim() === '') return '';
      return line.startsWith('  ') ? line.slice(2) : line;
    })
    .join('\n');
}

export default dedent2;

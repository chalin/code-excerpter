/**
 * Tagged template helper: strips the leading newline, removes the common
 * indentation of all non-blank lines, and removes trailing blank lines.
 * Allows multi-line test content to be indented naturally in source, mirroring
 * the Dart triple-quoted string style.
 */
export function dedent(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  let raw = strings[0] ?? "";
  for (let i = 0; i < values.length; i++)
    raw += String(values[i]) + (strings[i + 1] ?? "");
  const noLeading = raw.startsWith("\n") ? raw.slice(1) : raw;
  const lines = noLeading.split("\n");
  while (lines.length > 0 && /^\s*$/.test(lines[lines.length - 1])) lines.pop();
  let minIndent = Number.POSITIVE_INFINITY;
  for (const l of lines) {
    if (l.trim() !== "") {
      const indent = l.length - l.trimStart().length;
      if (indent < minIndent) minIndent = indent;
    }
  }
  if (minIndent === 0 || minIndent === Number.POSITIVE_INFINITY)
    return lines.join("\n");
  return lines.map((l) => l.slice(minIndent)).join("\n");
}

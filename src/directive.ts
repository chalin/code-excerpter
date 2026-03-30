/**
 * Directives usually appear inside a line comment.
 *
 * Ignore any close-comment syntax:
 * - CSS and Java-like languages: `* /`
 * - HTML: `-->`
 */
const directiveRegEx = /^(\s*)(\S.*?)?#((?:end)?docregion)\b\s*(.*?)(?:\s*(?:-->|\*\/))?\s*$/;

const argSeparator = /\s*,\s*/;

const lexemeIndex = 3;

export type DirectiveKind = "startRegion" | "endRegion" | "plaster";

function tryParseKind(lexeme: string | undefined): DirectiveKind | null {
  switch (lexeme) {
    case "docregion":
      return "startRegion";
    case "enddocregion":
      return "endRegion";
    case "docplaster":
      return "plaster";
    default:
      return null;
  }
}

export interface Directive {
  kind: DirectiveKind;
  /** The full original line. */
  line: string;
  /** Leading whitespace. */
  indentation: string;
  /** Indentation + any text before the `#` lexeme. */
  prefix: string;
  /** `'docregion'`, `'enddocregion'`, or `'docplaster'`. */
  lexeme: string;
  /** The raw argument string after the lexeme. */
  rawArgs: string;
  /** Parsed, deduplicated argument list. */
  args: string[];
  /** Warnings/errors accumulated during parsing. */
  issues: string[];
}

/** Returns a `Directive` parsed from `line`, or `null` if the line is not a directive. */
export function tryParseDirective(line: string): Directive | null {
  const match = directiveRegEx.exec(line);
  if (match === null) return null;

  const lexeme = match[lexemeIndex];
  const kind = tryParseKind(lexeme);
  if (kind === null) return null;

  const rawArgs = match[4] ?? "";
  const issues: string[] = [];

  const argsMaybeWithDups: string[] = rawArgs === "" ? [] : rawArgs.split(argSeparator);

  const argCounts = new Map<string, number>();

  for (let arg of argsMaybeWithDups) {
    if (arg === "") {
      issues.push("unquoted default region name is deprecated");
    } else if (arg === "''") {
      arg = "";
    }

    const count = (argCounts.get(arg) ?? 0) + 1;
    if (count === 2) {
      issues.push(`repeated argument "${arg}"`);
    }
    argCounts.set(arg, count);
  }

  const args = [...argCounts.keys()];

  return {
    kind,
    line: match[0],
    indentation: match[1],
    prefix: match[1] + (match[2] ?? ""),
    lexeme,
    rawArgs,
    args,
    issues,
  };
}

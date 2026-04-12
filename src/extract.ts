import { type Directive, tryParseDirective } from "./directive.js";

export const DEFAULT_PLASTER = "···";

const fullFileKey = "\0";
const defaultRegionKey = "";
const blankLineRe = /^\s*$/;
const leadingWhitespaceRe = /^[ \t]*/;

/**
 * Returns a new array with trailing blank lines removed.
 */
export function dropTrailingBlankLines(lines: string[]): string[] {
  const result = [...lines];
  while (result.length > 0 && blankLineRe.test(result[result.length - 1])) {
    result.pop();
  }
  return result;
}

/**
 * Returns a new array with leading blank lines removed (Dart-style excerpt
 * normalization before injection).
 */
export function dropLeadingBlankLines(lines: string[]): string[] {
  let i = 0;
  while (i < lines.length && blankLineRe.test(lines[i]!)) {
    i++;
  }
  return lines.slice(i);
}

/**
 * Returns lines shifted left by the minimum indentation of all non-blank lines.
 * Blank lines are not shifted and are ignored when computing the minimum indent.
 */
export function maxUnindent(lines: string[]): string[] {
  const nonBlankLines = lines.filter((s) => !blankLineRe.test(s));
  if (nonBlankLines.length === 0) return lines;

  const indents = nonBlankLines.map(
    (s) => leadingWhitespaceRe.exec(s)?.[0].length ?? 0,
  );
  const minLen = Math.min(...indents);

  if (minLen === 0) return lines;

  return lines.map((line) =>
    line.length < minLen ? line : line.substring(minLen),
  );
}

function dropTrailingPlaster(lines: string[]): string[] {
  if (
    lines.length === 0 ||
    !lines[lines.length - 1].includes(DEFAULT_PLASTER)
  ) {
    return lines;
  }
  return lines.slice(0, -1);
}

/**
 * Extracts named code regions from `content`.
 *
 * @param uri - Source URI used in warning messages (e.g. a file path).
 * @param content - The full source file content.
 * @param onWarning - Optional callback for warning messages.
 * @returns A map from region name to extracted lines.
 */
export function extractExcerpts(
  uri: string,
  content: string,
  onWarning?: (msg: string) => void,
): Map<string, string[]> {
  const lines = content.split("\n");
  const excerpts = new Map<string, string[]>();
  const openExcerpts = new Set<string>();
  let lineIdx = 0;
  let containsDirectives = false;

  const warn = (msg: string): void => {
    onWarning?.(`${msg} at ${uri}:${lineIdx + 1}`);
  };

  const quoteName = (name: string): string =>
    name.startsWith("'") ? name : `"${name}"`;

  const excerptStart = (name: string): boolean => {
    if (!excerpts.has(name)) excerpts.set(name, []);
    const isNew = !openExcerpts.has(name);
    openExcerpts.add(name);
    return isNew;
  };

  const warnRegions = (regions: string[], msg: (r: string) => string): void => {
    if (regions.length === 0) return;
    const joinedRegions = regions.join(", ");
    let s: string;
    if (joinedRegions === "") {
      s = "";
    } else if (regions.length > 1) {
      s = `s (${joinedRegions})`;
    } else {
      s = ` ${joinedRegions}`;
    }
    warn(msg(`region${s}`));
  };

  const startRegion = (directive: Directive): void => {
    const regionAlreadyStarted: string[] = [];
    const regionNames = [...directive.args];
    if (regionNames.length === 0) regionNames.push(defaultRegionKey);

    for (const name of regionNames) {
      const isNew = excerptStart(name);
      if (!isNew) {
        regionAlreadyStarted.push(quoteName(name));
      }
    }

    warnRegions(regionAlreadyStarted, (r) => `repeated start for ${r}`);
  };

  const endRegion = (directive: Directive): void => {
    const regionsWithoutStart: string[] = [];
    const regionNames = [...directive.args];
    if (regionNames.length === 0) regionNames.push(defaultRegionKey);

    for (const name of regionNames) {
      if (openExcerpts.delete(name)) {
        const excerpt = excerpts.get(name);
        // `excerptStart` always creates the entry before adding to openExcerpts,
        // so `excerpt` should never be undefined here. Guard kept for parity with
        // the Dart source.
        if (excerpt === undefined) return;

        if (excerpt.length === 0) {
          // Pass `name` unquoted intentionally: the message format is
          // "empty region" (default) or "empty region a" (named), not
          // "empty region \"a\"". This matches the Dart excerpter exactly.
          warnRegions([name], (r) => `empty ${r}`);
        }
        excerpt.push(directive.indentation + DEFAULT_PLASTER);
      } else {
        regionsWithoutStart.push(quoteName(name));
      }
    }

    warnRegions(regionsWithoutStart, (r) => `${r} end without a prior start`);
  };

  const processLine = (line: string): void => {
    const directive = tryParseDirective(line);

    if (directive === null) {
      for (const name of openExcerpts) {
        excerpts.get(name)?.push(line);
      }
      return;
    }

    for (const issue of directive.issues) {
      warn(issue);
    }

    switch (directive.kind) {
      case "startRegion":
        containsDirectives = true;
        startRegion(directive);
        break;
      case "endRegion":
        containsDirectives = true;
        endRegion(directive);
        break;
      default:
        throw new Error(`Unimplemented directive: ${line}`);
    }
  };

  // Collect the full file in case we need it.
  excerptStart(fullFileKey);

  for (lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    processLine(lines[lineIdx]);
  }

  // Post-processing: drop trailing blanks, drop trailing plaster, normalize indentation.
  for (const [name, excerpt] of excerpts) {
    let processed = dropTrailingBlankLines(excerpt);
    processed = dropTrailingPlaster(processed);
    if (name !== fullFileKey) {
      processed = maxUnindent(processed);
    }
    excerpts.set(name, processed);
  }

  // Final adjustment relative to fullFileKey:
  if (!containsDirectives) {
    // No directives? Return empty map.
    excerpts.clear();
  } else if (excerpts.has(defaultRegionKey)) {
    // Explicit default region exists — drop fullFileKey.
    excerpts.delete(fullFileKey);
  } else {
    // Use fullFileKey content as the default region.
    const fullFileExcerpt = excerpts.get(fullFileKey);
    excerpts.delete(fullFileKey);
    if (fullFileExcerpt !== undefined) {
      excerpts.set(defaultRegionKey, fullFileExcerpt);
    }
  }

  return excerpts;
}

/**
 * Returns excerpt lines for `region` after {@link extractExcerpts}, or `null` if the
 * region is missing. When the file has no directives and `region` is the default (`""`),
 * returns the full file minus directive-looking lines, then trailing blank drop + max unindent
 * (matches how tests build the implicit default region).
 */
export function getExcerptRegionLines(
  uri: string,
  content: string,
  region: string,
  onWarning?: (msg: string) => void,
): string[] | null {
  const excerpts = extractExcerpts(uri, content, onWarning);
  if (excerpts.has(region)) {
    return excerpts.get(region)!;
  }
  if (excerpts.size === 0) {
    const raw = content
      .split("\n")
      .filter((line) => tryParseDirective(line) === null);
    return maxUnindent(dropTrailingBlankLines(raw));
  }
  return null;
}

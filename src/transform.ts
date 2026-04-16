/**
 * Excerpt transform pipeline (ported from `chalin/code_excerpt_updater` `code_transformer`).
 *
 * {@link applyExcerptTransforms} applies transforms in the default spec order
 * (skip → take → from → to → remove → retain → replace → indent-by).
 * {@link applyExcerptTransformsInOrder} applies them in PI attribute order instead,
 * matching how the Dart updater iterates its `LinkedHashMap` of named args.
 * See `docs/spec.md` for details.
 */

const escapedSlashRe = /\\\//g;
const zeroChar = '\u0000';
const endRe = /^g;?\s*$/;
const matchDollarNumRe = /(\$+)(&|\d*)/g;
const slashLetterRe = /\\([\\nt])/g;
const slashHexRe = /\\x(..)/g;

export type LinePredicate = (line: string) => boolean;

/** Options for {@link applyExcerptTransforms}, mirroring `<?code-excerpt?>` transform arguments. */
export interface ExcerptTransformOptions {
  skip?: string;
  take?: string;
  from?: string;
  to?: string;
  remove?: string;
  retain?: string;
  replace?: string;
  indentBy?: string;
}

function parseIntArg(s: string | undefined): number | null {
  if (s === undefined) return null;
  if (!/^[-+]?\d+$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

/** Keys that participate in the Dart-style per-argument transform chain. */
const ORDERED_TRANSFORM_KEYS = new Set([
  'skip',
  'take',
  'from',
  'to',
  'remove',
  'retain',
  'replace',
]);

/**
 * Applies transform arguments in **PI attribute order** (Dart `Map.forEach`
 * insertion order on named args), not a fixed global ordering.
 */
export function applyExcerptTransformsInOrder(
  lines: string[],
  keyOrder: string[],
  map: Map<string, string>,
  onError?: (msg: string) => void,
): string[] {
  let cur = [...lines];
  for (const key of keyOrder) {
    if (!ORDERED_TRANSFORM_KEYS.has(key)) continue;
    const val = map.get(key);
    if (val === undefined) continue;
    const opts: ExcerptTransformOptions = {};
    (opts as Record<string, string | undefined>)[key] = val;
    cur = applyExcerptTransforms(cur, opts, onError);
  }
  return cur;
}

/** Parses `indent-by` attribute values (Dart `Updater._getIndentBy`). */
export function parseIndentBy(
  s: string | undefined,
  onError?: (msg: string) => void,
): number {
  if (s === undefined) return 0;
  // Match Dart `int.tryParse`: the entire value must be an integer (no `2abc` → 2).
  if (!/^[-+]?\d+$/.test(s)) {
    onError?.(`indent-by: error parsing integer value: ${JSON.stringify(s)}`);
    return 0;
  }
  const n = Number.parseInt(s, 10);
  if (n < 0 || n > 100) {
    onError?.(`indent-by: integer out of range: ${n}`);
    return 0;
  }
  return n;
}

/**
 * Builds a line predicate from a `from` / `to` / `remove` / `retain` argument:
 * `/.../` is a regex test via {@link RegExp.prototype.test}; otherwise {@link String.prototype.includes}.
 */
export function patternToLinePredicate(
  arg: string,
  onError?: (msg: string) => void,
): LinePredicate | null {
  if (arg.startsWith('/') && arg.endsWith('/') && arg.length >= 2) {
    const inner = arg.slice(1, -1);
    try {
      const re = new RegExp(inner);
      return (line: string) => re.test(line);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onError?.(`invalid regexp in pattern ${JSON.stringify(arg)}: ${msg}`);
      return null;
    }
  }
  const stringToMatch = arg.startsWith('\\/') ? arg.slice(1) : arg;
  return (line: string) => line.includes(stringToMatch);
}

function indexWhere(lines: string[], pred: LinePredicate): number {
  for (let i = 0; i < lines.length; i++) {
    if (pred(lines[i])) return i;
  }
  return -1;
}

/** Drops the first `n` lines (`n >= 0`), or drops the last `-n` lines (`n < 0`). */
export function applySkip(lines: string[], n: number): string[] {
  if (n >= 0) return lines.slice(n);
  return lines.slice(0, Math.max(0, lines.length + n));
}

/** Keeps the first `n` lines (`n >= 0`), or keeps the last `1 - n` lines (`n < 0`). */
export function applyTake(lines: string[], n: number): string[] {
  if (n >= 0) return lines.slice(0, n);
  const k = lines.length + n - 1;
  if (k < 0) return [];
  return lines.slice(k);
}

/** Keeps from the first matching line through the end (inclusive). No match → empty. */
export function applyFrom(lines: string[], pred: LinePredicate): string[] {
  const i = indexWhere(lines, pred);
  return i < 0 ? [] : lines.slice(i);
}

/** Keeps through the first matching line (inclusive). No match → unchanged. */
export function applyTo(lines: string[], pred: LinePredicate): string[] {
  const i = indexWhere(lines, pred);
  if (i < 0) return lines;
  return lines.slice(0, i + 1);
}

export function applyRemove(lines: string[], pred: LinePredicate): string[] {
  return lines.filter((line) => !pred(line));
}

export function applyRetain(lines: string[], pred: LinePredicate): string[] {
  return lines.filter(pred);
}

function slashCharToChar(ch: string): string {
  switch (ch) {
    case 'n':
      return '\n';
    case 't':
      return '\t';
    case '\\':
      return zeroChar;
    default:
      return `\\${ch}`;
  }
}

function hexToChar(hexDigits: string): string {
  const code = Number.parseInt(hexDigits, 16);
  return Number.isNaN(code) ? `\\x${hexDigits}` : String.fromCodePoint(code);
}

/** Decodes `\n`, `\t`, `\\`, and `\xHH` in a replacement fragment (Dart `encodeSlashChar`). */
export function encodeSlashChar(s: string): string {
  return s
    .replaceAll(slashLetterRe, (_, ch: string) => slashCharToChar(ch))
    .replaceAll(slashHexRe, (_, hex: string) => hexToChar(hex))
    .replaceAll(zeroChar, '\\');
}

function applyReplaceOne(
  code: string,
  reSource: string,
  replacementRaw: string,
): string {
  const replacement = encodeSlashChar(replacementRaw);
  const re = new RegExp(reSource, 'g');

  if (!matchDollarNumRe.test(replacement)) {
    matchDollarNumRe.lastIndex = 0;
    return code.replaceAll(re, replacement);
  }
  matchDollarNumRe.lastIndex = 0;

  return code.replaceAll(re, (match, ...args: unknown[]) => {
    const captureArgs = args.slice(0, -2) as string[];
    const groupCount = captureArgs.length;

    matchDollarNumRe.lastIndex = 0;
    return replacement.replaceAll(
      matchDollarNumRe,
      (_m0, dollars: string, ref: string) => {
        const numDollarChar = dollars.length;
        const dollarOut = '$'.repeat(numDollarChar >> 1);

        if (numDollarChar % 2 === 0 || ref === '') {
          return `${dollarOut}${ref}`;
        }
        if (ref === '&') return `${dollarOut}${match}`;

        const argNum = Number.parseInt(ref, 10);
        const resolved = Number.isNaN(argNum) ? groupCount + 1 : argNum;
        if (resolved > groupCount) return `${dollarOut}$${ref}`;
        const g = captureArgs[resolved - 1];
        return `${dollarOut}${g ?? ''}`;
      },
    );
  });
}

/**
 * Parses a `replace` attribute like `/a/b/g;/c/d/g` and returns a function that applies
 * all segments, or `null` if invalid (errors reported via `onError`).
 */
export function parseReplacePipeline(
  replaceExp: string,
  onError?: (msg: string) => void,
): ((code: string) => string) | null {
  const report = (detail: string): null => {
    onError?.(
      `invalid replace attribute (${JSON.stringify(replaceExp)}); ${detail}; ` +
        'supported syntax is 1 or more semi-colon-separated: /regexp/replacement/g',
    );
    return null;
  };

  const parts = replaceExp
    .replaceAll(escapedSlashRe, zeroChar)
    .split('/')
    .map((s) => s.replaceAll(zeroChar, '/'));

  const len = parts.length;
  if (len < 4 || len % 3 !== 1) {
    return report(`argument has missing parts (${len})`);
  }
  if (parts[0] !== '') {
    return report(
      `argument should start with "/", not ${JSON.stringify(parts[0])}`,
    );
  }

  const fns: ((code: string) => string)[] = [];
  for (let i = 1; i < parts.length; i += 3) {
    const reSource = parts[i];
    const replacement = parts[i + 1];
    const end = parts[i + 2];
    if (!endRe.test(end)) {
      return report(
        `expected argument end syntax of "g" or "g;" but found ${JSON.stringify(end)}`,
      );
    }
    try {
      // Validate pattern early (applyReplaceOne also constructs RegExp)
      new RegExp(reSource, 'g');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return report(`bad regexp ${JSON.stringify(reSource)}: ${msg}`);
    }
    fns.push((code: string) => applyReplaceOne(code, reSource, replacement));
  }

  return (code: string) => fns.reduce((acc, fn) => fn(acc), code);
}

/**
 * Applies transform options to excerpt lines in spec order. Does not mutate `lines`.
 *
 * @param onError - Parse/validation problems (indent-by, replace, bad `/regexp/` patterns).
 */
export function applyExcerptTransforms(
  lines: string[],
  options: ExcerptTransformOptions,
  onError?: (msg: string) => void,
): string[] {
  let out = [...lines];

  const skipN = parseIntArg(options.skip);
  if (skipN !== null) out = applySkip(out, skipN);

  const takeN = parseIntArg(options.take);
  if (takeN !== null) out = applyTake(out, takeN);

  if (options.from !== undefined) {
    const pred = patternToLinePredicate(options.from, onError);
    if (pred !== null) out = applyFrom(out, pred);
  }

  if (options.to !== undefined) {
    const pred = patternToLinePredicate(options.to, onError);
    if (pred !== null) out = applyTo(out, pred);
  }

  if (options.remove !== undefined) {
    const pred = patternToLinePredicate(options.remove, onError);
    if (pred !== null) out = applyRemove(out, pred);
  }

  if (options.retain !== undefined) {
    const pred = patternToLinePredicate(options.retain, onError);
    if (pred !== null) out = applyRetain(out, pred);
  }

  if (options.replace !== undefined && options.replace !== '') {
    const pipeline = parseReplacePipeline(options.replace, onError);
    if (pipeline !== null) {
      const joined = out.join('\n');
      out = pipeline(joined).split('\n');
    }
  }

  const indent = parseIndentBy(options.indentBy, onError);
  if (indent > 0) {
    const prefix = ' '.repeat(indent);
    out = out.map((line) => prefix + line);
  }

  return out;
}

/**
 * Excerpt transforms (ported from `chalin/code_excerpt_updater` `code_transformer`).
 *
 * {@link applyExcerptTransformsInOrder} is the current markdown-injection
 * helper: it applies one line-transform key at a time in PI attribute order.
 * This is transitional; the spec now distinguishes ordered transform
 * operations from fragment settings such as `indent-by` and `plaster`.
 *
 * {@link applyExcerptTransforms} applies every supplied option in a single call
 * using a **fixed** pipeline order (skip → take → from → to → remove → retain →
 * replace → indent-by), mainly for unit tests and direct library callers—not
 * for simulating a full `<?code-excerpt?>` line. See `docs/spec.md` §
 * “Transform operations and fragment settings”.
 */

import { reportError, reportWarning, type IssueReporter } from './issues.js';

const escapedSlashRe = /\\\//g;
const zeroChar = '\u0000';
const endRe = /^g;?\s*$/;
const slashLetterRe = /\\([\\nt])/g;
const slashHexRe = /\\x(..)/g;
/** `arg` is slash-wrapped `/inner/` iff this matches; group 1 is `inner` (may be empty). */
const slashWrappedArgRe = /^\/(.*)\/$/;

export type LinePredicate = (line: string) => boolean;
export type ExcerptTransformOpName =
  | 'from'
  | 'to'
  | 'skip'
  | 'take'
  | 'remove'
  | 'retain'
  | 'replace';

export interface ExcerptTransformOp {
  name: ExcerptTransformOpName;
  value: string;
}

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

/** Current ordered line-transform keys used by the transitional PI helper. */
const ORDERED_TRANSFORM_KEYS = new Set([
  'skip',
  'take',
  'from',
  'to',
  'remove',
  'retain',
  'replace',
]);

function applyOneTransformOp(
  lines: string[],
  op: ExcerptTransformOp,
  onIssue?: IssueReporter,
): string[] {
  switch (op.name) {
    case 'skip': {
      const n = parseIntArg(op.value);
      return n === null ? lines : applySkip(lines, n);
    }
    case 'take': {
      const n = parseIntArg(op.value);
      return n === null ? lines : applyTake(lines, n);
    }
    case 'from': {
      const pred = patternToLinePredicate(op.value, onIssue);
      return pred === null ? lines : applyFrom(lines, pred);
    }
    case 'to': {
      const pred = patternToLinePredicate(op.value, onIssue);
      return pred === null ? lines : applyTo(lines, pred);
    }
    case 'remove': {
      const pred = patternToLinePredicate(op.value, onIssue);
      return pred === null ? lines : applyRemove(lines, pred);
    }
    case 'retain': {
      const pred = patternToLinePredicate(op.value, onIssue);
      return pred === null ? lines : applyRetain(lines, pred);
    }
    case 'replace': {
      return applyReplaceTransform(lines, op.value, onIssue);
    }
  }
}

function applyReplaceTransform(
  lines: string[],
  replace: string,
  onIssue?: IssueReporter,
): string[] {
  if (replace === '' || lines.length === 0) return lines;
  const pipeline = parseReplacePipeline(replace, onIssue);
  if (pipeline === null) return lines;
  return pipeline(lines.join('\n')).split('\n');
}

/**
 * Applies ordered transform operations exactly as listed. Repeated operations
 * are preserved and run multiple times.
 */
export function applyOrderedExcerptTransformOps(
  lines: string[],
  ops: ExcerptTransformOp[],
  onIssue?: IssueReporter,
): string[] {
  let cur = [...lines];
  for (const op of ops) {
    cur = applyOneTransformOp(cur, op, onIssue);
  }
  return cur;
}

/**
 * Applies the current ordered line-transform keys in PI attribute order, not a
 * fixed global ordering.
 */
export function applyExcerptTransformsInOrder(
  lines: string[],
  keyOrder: string[],
  map: Map<string, string>,
  onIssue?: IssueReporter,
): string[] {
  const ops: ExcerptTransformOp[] = [];
  for (const key of keyOrder) {
    if (!ORDERED_TRANSFORM_KEYS.has(key)) continue;
    const val = map.get(key);
    if (val === undefined) continue;
    ops.push({ name: key as ExcerptTransformOpName, value: val });
  }
  return applyOrderedExcerptTransformOps(lines, ops, onIssue);
}

/** Parses `indent-by` attribute values (Dart `Updater._getIndentBy`). */
export function parseIndentBy(
  s: string | undefined,
  onIssue?: IssueReporter,
): number {
  if (s === undefined) return 0;
  // Match Dart `int.tryParse`: the entire value must be an integer (no `2abc` → 2).
  if (!/^[-+]?\d+$/.test(s)) {
    reportError(
      onIssue,
      `indent-by: error parsing integer value: ${JSON.stringify(s)}`,
    );
    return 0;
  }
  const n = Number.parseInt(s, 10);
  if (n < 0 || n > 100) {
    reportError(onIssue, `indent-by: integer out of range: ${n}`);
    return 0;
  }
  return n;
}

/**
 * Builds a line predicate from a `from` / `to` / `remove` / `retain` argument
 * string. When `arg` is:
 *
 * - `/pattern/`: returns a predicate that uses `new RegExp(...).test`; invalid
 *   patterns report via `onIssue` and yield `null`.
 * - Otherwise: returns a predicate that uses {@link String.prototype.includes}.
 *    A leading `\/` becomes `/` so the search string can start with `/` without
 *    using the slash-wrapped form.
 */
export function patternToLinePredicate(
  arg: string,
  onIssue?: IssueReporter,
): LinePredicate | null {
  const wrapped = slashWrappedArgRe.exec(arg);
  if (wrapped !== null) {
    const patternSource = wrapped[1] ?? '';
    if (arg === '//') {
      reportWarning(
        onIssue,
        '"//" is the empty regexp and matches everything; use "" or "\\//"',
      );
    }
    try {
      const re = new RegExp(patternSource);
      return (line: string) => re.test(line);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      reportError(
        onIssue,
        `invalid regexp in pattern ${JSON.stringify(arg)}: ${msg}`,
      );
      return null;
    }
  }
  const literal = arg.startsWith('\\/') ? arg.slice(1) : arg;
  return (line: string) => line.includes(literal);
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

/**
 * Applies one `/pattern/replacement/g` segment. Replacement string semantics match
 * {@link String.prototype.replace} / ECMA-262 `GetSubstitution` (Dart port had
 * custom logic because Dart differs).
 */
function applyReplaceOne(
  code: string,
  reSource: string,
  replacementRaw: string,
): string {
  const replacement = encodeSlashChar(replacementRaw);
  const re = new RegExp(reSource, 'g');
  return code.replaceAll(re, replacement);
}

/**
 * Parses a `replace` attribute like `/a/b/g;/c/d/g` and returns a function that applies
 * all segments, or `null` if invalid (errors reported via `onIssue`).
 */
export function parseReplacePipeline(
  replaceExp: string,
  onIssue?: IssueReporter,
): ((code: string) => string) | null {
  const report = (detail: string): null => {
    reportError(
      onIssue,
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
 * Applies transform options to excerpt lines in **fixed pipeline order** when
 * several fields are set at once. Does not mutate `lines`. For markdown PIs,
 * use {@link applyExcerptTransformsInOrder} instead.
 *
 * @param onIssue - Parse/validation problems (indent-by, replace, bad `/regexp/` patterns).
 */
export function applyExcerptTransforms(
  lines: string[],
  options: ExcerptTransformOptions,
  onIssue?: IssueReporter,
): string[] {
  let out = [...lines];

  const skipN = parseIntArg(options.skip);
  if (skipN !== null) out = applySkip(out, skipN);

  const takeN = parseIntArg(options.take);
  if (takeN !== null) out = applyTake(out, takeN);

  if (options.from !== undefined) {
    const pred = patternToLinePredicate(options.from, onIssue);
    if (pred !== null) out = applyFrom(out, pred);
  }

  if (options.to !== undefined) {
    const pred = patternToLinePredicate(options.to, onIssue);
    if (pred !== null) out = applyTo(out, pred);
  }

  if (options.remove !== undefined) {
    const pred = patternToLinePredicate(options.remove, onIssue);
    if (pred !== null) out = applyRemove(out, pred);
  }

  if (options.retain !== undefined) {
    const pred = patternToLinePredicate(options.retain, onIssue);
    if (pred !== null) out = applyRetain(out, pred);
  }

  if (options.replace !== undefined && options.replace !== '') {
    out = applyReplaceTransform(out, options.replace, onIssue);
  }

  const indent = parseIndentBy(options.indentBy, onIssue);
  if (indent > 0) {
    const prefix = ' '.repeat(indent);
    out = out.map((line) => prefix + line);
  }

  return out;
}

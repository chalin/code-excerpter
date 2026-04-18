import {
  DEFAULT_PLASTER,
  dropLeadingBlankLines,
  dropTrailingBlankLines,
  getExcerptRegionLines,
  maxUnindent,
} from './extract.js';
import type { InstructionStats } from './instructionStats.js';
import {
  applyOrderedExcerptTransformOps,
  type ExcerptTransformOp,
  parseReplacePipeline,
} from './transform.js';
import { re } from './helpers/re.js';

/**
 * Core `<?code-excerpt ...?>` match from the start of a line (no end-of-line rule).
 * Composed into {@link PROC_INSTR_RE}; also used alone so `injectMarkdown` can detect
 * a well-formed PI followed by **non-whitespace after `?>`** — that case does not match
 * {@link PROC_INSTR_RE}, triggers `onWarning`, and the line is skipped as an instruction.
 */
const PROC_INSTR_BODY =
  /^(?<linePrefix>\s*((?:\/\/\/?|-|\*)\s*)?)?<\?code-excerpt\s*(?:"(?<unnamed>[^"]+)")?(?<named>(?:\s+[-\w]+\s*=\s*"[^"]*"\s*)*)\s*\??>/;

const MALFORMED_PI_SPACE_AFTER_XML_OPEN = re`^(?:\s*((?:///?|-|\*)\s*)?)?<\?\s+code-excerpt\b`;

/**
 * Strict match: the **entire line** is only a `<?code-excerpt ...?>` plus optional trailing
 * whitespace (whole-line match with a `$` anchor). Export for tests and
 * tooling; lines with extra text after `?>` do not match — see `injectMarkdown`’s
 * `onWarning` path (`processing instruction ignored: extraneous text after closing "?>"`).
 */
export const PROC_INSTR_RE = new RegExp(
  `${PROC_INSTR_BODY.source}\\s*$`,
  PROC_INSTR_BODY.flags,
);

const NAMED_ARG_RE = /^([-\w]+)\s*=\s*"([^"]*)"\s*/;

const SET_KNOWN_KEYS = new Set([
  'path-base',
  'replace',
  'plaster',
  'class',
  'title',
]);

export interface ParsedNamedArgEntry {
  key: string;
  value: string;
}

export interface ParsedNamedArgs {
  entries: ParsedNamedArgEntry[];
}

/** Backtick fences, tilde fences, or Liquid `{% prettify ... %}` (not arbitrary `{% ... %}`). */
const CODE_BLOCK_START =
  /^\s*(?:\/\/\/?)?\s*(?<token>`{3,}|~{3,}|{%-?\s*prettify(\s+.*)?-?%})/;

/** Matches any code-block closing fence (backtick, tilde, or prettify). */
const CODE_BLOCK_END =
  /^\s*(?:\/\/\/?)?\s*(?<token>`{3,}|~{3,}|{%-?\s*endprettify\s*-?%})/;

type FenceKind = 'backtick' | 'tilde' | 'prettify';

/** Classify an open or close fence token by kind. */
function fenceKind(token: string): FenceKind {
  if (token.startsWith('`')) return 'backtick';
  if (token.startsWith('~')) return 'tilde';
  return 'prettify';
}

function isMatchingFence(
  openingToken: string,
  closingToken: string,
  openKind: FenceKind,
): boolean {
  if (fenceKind(closingToken) !== openKind) return false;
  if (openKind === 'prettify') return true;
  return closingToken.length >= openingToken.length;
}

const REGION_IN_PATH = /\s*\((.+)\)\s*$/;
const NON_WORD = /[^\w]+/g;

export interface MarkdownInjectContext {
  /**
   * Reads source text for a path relative to the current `path-base`. Returns
   * `null` if the file is missing or cannot be read.
   *
   * When `region` is non-empty, callers using fragment or YAML excerpt sources
   * may resolve `basename-region.ext` files (legacy mode) or the matching key
   * in `.excerpt.yaml` (YAML mode).
   *
   * Callers that only use `getExcerptRegionLines` on the returned file text may
   * ignore `region`.
   */
  readFile: (relativePath: string, region?: string) => string | null;
  /**
   * Optional detail for the last `readFile(...)` failure on the same
   * `relativePath` / `region`.
   */
  readError?: (relativePath: string, region?: string) => string | null;
  /** Initial `path-base` (directory prefix for excerpt sources). */
  pathBase?: string;
  /** Legacy option retained for compatibility; plaster handling is now YAML-style by default. */
  excerptsYaml?: boolean;
  /** Default extra spaces when `indent-by` is omitted on a fragment directive. */
  defaultIndentation?: number;
  /**
   * Global replace expression. Applied after per-instruction transforms and
   * file-level set `replace`, on the joined excerpt string.
   */
  globalReplace?: string;
  /** Default plaster template when neither the PI nor a file-level `plaster` set instruction overrides it. */
  globalPlasterTemplate?: string;
  /**
   * When `true` (default), escape Angular-style `{{` / `}}` in injected lines.
   */
  escapeNgInterpolation?: boolean;
  /**
   * When provided, incremented for each **strict-line** `<?code-excerpt …?>`
   * that is **parsed** (`set` for set-only, `fragment` for quoted path + fence);
   * processing may still report errors for that directive afterward.
   * Aggregated on `UpdateResult` by `updatePaths`.
   *
   * Reusing the same {@link InstructionStats} object across multiple
   * `injectMarkdown` calls **accumulates** counts; reset `set` and `fragment` to
   * `0` first if you want per-call totals.
   */
  instructionStats?: InstructionStats;
  onWarning?: (msg: string) => void;
  onError?: (msg: string) => void;
}

function joinPathBase(pathBase: string, relPath: string): string {
  const trimmed = relPath.trim().replace(/\\/g, '/');
  const base = pathBase.trim().replace(/\\/g, '/');
  if (!base) return trimmed.replace(/\/+/g, '/');
  const sep = base.endsWith('/') ? '' : '/';
  return `${base}${sep}${trimmed}`.replace(/\/+/g, '/');
}

function fileExtensionLower(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const base = normalized.includes('/')
    ? normalized.slice(normalized.lastIndexOf('/') + 1)
    : normalized;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

function normalizeListLinePrefix(prefix: string): string {
  for (const c of ['-', '*']) {
    if (prefix.includes(c)) {
      return prefix.replace(c, ' ');
    }
  }
  return prefix;
}

export function parseNamedArgs(
  named: string,
  onError?: (msg: string) => void,
): ParsedNamedArgs | null {
  const entries: ParsedNamedArgEntry[] = [];
  let rest = named.trim();
  while (rest.length > 0) {
    const m = NAMED_ARG_RE.exec(rest);
    if (m === null) {
      onError?.(`instruction argument parsing failure at/around: ${rest}`);
      return null;
    }
    const key = m[1]!;
    entries.push({
      key,
      value: m[2] ?? '',
    });
    rest = rest.slice(m[0].length);
  }
  return { entries };
}

type FragmentSettingName = 'region' | 'indent-by' | 'plaster';

export interface ParsedFragmentArgs {
  transformOps: ExcerptTransformOp[];
  regionValue: string | undefined;
  indentByRaw: string | undefined;
  plasterTemplate: string | undefined;
  hasUnsupportedDiff: boolean;
}

export function parseFragmentArgs(
  parsed: ParsedNamedArgs,
  onError?: (msg: string) => void,
): ParsedFragmentArgs | null {
  const transformOps: ExcerptTransformOp[] = [];
  let regionValue: string | undefined;
  let indentByRaw: string | undefined;
  let plasterTemplate: string | undefined;
  let hasUnsupportedDiff = false;
  const seenSettings = new Set<FragmentSettingName>();

  const rejectRepeatedSetting = (key: FragmentSettingName): null => {
    onError?.(`${key}: repeated setting argument on fragment instruction`);
    return null;
  };

  for (const entry of parsed.entries) {
    switch (entry.key) {
      case 'from':
      case 'to':
      case 'skip':
      case 'take':
      case 'remove':
      case 'retain':
      case 'replace':
        transformOps.push({
          name: entry.key,
          value: entry.value,
        });
        break;
      case 'region':
        if (seenSettings.has('region')) return rejectRepeatedSetting('region');
        seenSettings.add('region');
        regionValue = entry.value;
        break;
      case 'indent-by':
        if (seenSettings.has('indent-by')) {
          return rejectRepeatedSetting('indent-by');
        }
        seenSettings.add('indent-by');
        indentByRaw = entry.value;
        break;
      case 'plaster':
        if (seenSettings.has('plaster')) {
          return rejectRepeatedSetting('plaster');
        }
        seenSettings.add('plaster');
        plasterTemplate = entry.value;
        break;
      case 'diff-with':
      case 'diff-u':
        hasUnsupportedDiff = true;
        break;
      default:
        break;
    }
  }

  return {
    transformOps,
    regionValue,
    indentByRaw,
    plasterTemplate,
    hasUnsupportedDiff,
  };
}

function normalizeRegionName(region: string): string {
  return region.replace(NON_WORD, '-');
}

function parsePathAndRegion(unnamed: string): { path: string; region: string } {
  const m = REGION_IN_PATH.exec(unnamed);
  if (m === null) {
    return { path: unnamed.trim(), region: '' };
  }
  const idx = m.index ?? 0;
  return {
    path: unnamed.slice(0, idx).trim(),
    region: normalizeRegionName(m[1]),
  };
}

function codeLang(openingFenceLine: string, path: string): string {
  const fence = /(?:```|~~~|prettify\s+)(\w+)/.exec(openingFenceLine);
  if (fence !== null) return fence[1];
  return fileExtensionLower(path);
}

/** Escapes Angular-style `{{` / `}}` as `{!{` / `}!}` when enabled. */
function escapeNgLine(line: string, enabled: boolean): string {
  if (!enabled) return line;
  return line.replace(/\{\{|\}\}/g, (m) => (m === '{{' ? '{!{' : '}!}'));
}

/**
 * Comment delimiters around the plaster marker. Omit `end` for a line
 * comment (start, space, then marker).
 */
interface PlasterCommentDelims {
  start: string;
  end?: string;
}

/** Fence / file language id → comment delimiters for default plaster. */
const PLASTER_COMMENT_DELIMS_BY_LANG = new Map<string, PlasterCommentDelims>([
  ['cpp', { start: '//' }],
  ['cs', { start: '//' }],
  ['csharp', { start: '//' }],
  ['css', { start: '/*', end: '*/' }],
  ['dart', { start: '//' }],
  ['erlang', { start: '%' }],
  ['go', { start: '//' }],
  ['html', { start: '<!--', end: '-->' }],
  ['java', { start: '//' }],
  ['javascript', { start: '//' }],
  ['js', { start: '//' }],
  ['kt', { start: '//' }],
  ['kotlin', { start: '//' }],
  ['php', { start: '//' }],
  ['py', { start: '#' }],
  ['python', { start: '#' }],
  ['rb', { start: '#' }],
  ['rs', { start: '//' }],
  ['ruby', { start: '#' }],
  ['rust', { start: '//' }],
  ['scss', { start: '/*', end: '*/' }],
  ['swift', { start: '//' }],
  ['ts', { start: '//' }],
  ['typescript', { start: '//' }],
  ['yaml', { start: '#' }],
  ['yml', { start: '#' }],
]);

function formatPlasterWithDelims(
  text: string,
  d: PlasterCommentDelims,
): string {
  if (text === '') {
    return d.end ? `${d.start} ${d.end}` : d.start;
  }
  return d.end ? `${d.start} ${text} ${d.end}` : `${d.start} ${text}`;
}

function plasterTemplateForLang(text: string, lang: string): string | null {
  const d = PLASTER_COMMENT_DELIMS_BY_LANG.get(lang.toLowerCase());
  if (d === undefined) return null;
  return formatPlasterWithDelims(text, d);
}

/**
 * Plaster pass: `plaster="none"` removes plaster lines. Otherwise, explicit
 * values are treated as full plaster templates and `$defaultPlaster` expands to
 * the default plaster string. When no template is set, a language-specific
 * default template is used when available; languages without a known comment
 * syntax keep the raw plaster marker.
 */
function applyPlasterToLines(
  lines: string[],
  plasterTemplate: string | undefined,
  lang: string,
): string[] {
  if (plasterTemplate === 'none') {
    return lines.filter((line) => !line.includes(DEFAULT_PLASTER));
  }

  const explicitTemplate =
    plasterTemplate === undefined
      ? undefined
      : plasterTemplate.replaceAll('$defaultPlaster', DEFAULT_PLASTER);
  const effectiveTemplate =
    explicitTemplate ?? plasterTemplateForLang(DEFAULT_PLASTER, lang);
  if (effectiveTemplate === null || effectiveTemplate === DEFAULT_PLASTER) {
    return lines;
  }

  return lines.map((line) => {
    const leadingWhitespace = /^([ \t]*)/.exec(line)?.[1] ?? '';
    if (line.trim() !== DEFAULT_PLASTER) return line;
    return `${leadingWhitespace}${effectiveTemplate}`;
  });
}

function tryParseFragmentIndent(
  raw: string | undefined,
  defaultIndentation: number,
  onError?: (msg: string) => void,
): { ok: boolean; value: number } {
  if (raw === undefined) {
    return { ok: true, value: defaultIndentation };
  }
  if (!/^[-+]?\d+$/.test(raw)) {
    onError?.(`indent-by: error parsing integer value: ${JSON.stringify(raw)}`);
    return { ok: false, value: defaultIndentation };
  }
  const n = Number.parseInt(raw, 10);
  if (n < 0 || n > 100) {
    onError?.(`indent-by: integer out of range: ${n}`);
    return { ok: false, value: defaultIndentation };
  }
  return { ok: true, value: n };
}

/** Consumes a markdown code fence (opening through closing) from `queue`. */
function consumeFenceBlock(queue: string[]): {
  closed: boolean;
  lines: string[];
} {
  if (queue.length === 0) return { closed: false, lines: [] };
  const opening = queue.shift()!;
  const openMatch = CODE_BLOCK_START.exec(opening);
  const openingToken = openMatch?.groups?.token;
  if (openingToken === undefined) {
    return { closed: false, lines: [opening] };
  }
  const openKind = fenceKind(openingToken);
  const inner: string[] = [];
  while (queue.length > 0) {
    const line = queue[0]!;
    const em = CODE_BLOCK_END.exec(line);
    const closingToken = em?.groups?.token;
    if (
      closingToken !== undefined &&
      isMatchingFence(openingToken, closingToken, openKind)
    ) {
      queue.shift();
      return { closed: true, lines: [opening, ...inner, line] };
    }
    inner.push(queue.shift()!);
  }
  return { closed: false, lines: [opening, ...inner] };
}

/**
 * Updates markdown in memory: each `<?code-excerpt ...?>` followed by a fenced
 * code block (Markdown **```** or **~~~**, or Liquid `{% prettify %}`) is
 * replaced with freshly extracted (and transformed) lines.
 */
export function injectMarkdown(
  markdown: string,
  ctx: MarkdownInjectContext,
): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let pathBase = ctx.pathBase ?? '';
  const defaultIndentation = ctx.defaultIndentation ?? 0;
  let filePlasterTemplate: string | undefined;
  let fileReplacePipeline: ((code: string) => string) | null = null;

  const warn = (msg: string): void => {
    ctx.onWarning?.(msg);
  };
  const err = (msg: string): void => {
    ctx.onError?.(msg);
  };

  let appReplacePipeline: ((code: string) => string) | null = null;
  const gr = ctx.globalReplace;
  if (gr !== undefined && gr !== '') {
    const parsed = parseReplacePipeline(gr, err);
    if (parsed === null) {
      throw new Error(
        `invalid global replace expression: ${JSON.stringify(gr)}`,
      );
    }
    appReplacePipeline = parsed;
  }

  const handleSetInstruction = (pn: ParsedNamedArgs): void => {
    const nKeys = pn.entries.length;
    if (nKeys > 1) {
      err('set instruction should have at most one argument');
      return;
    }
    if (nKeys === 0) {
      warn('set instruction ignored: no argument provided');
      return;
    }
    const entry = pn.entries[0]!;
    if (entry.key === 'path-base') {
      pathBase = entry.value;
      return;
    }
    if (entry.key === 'replace') {
      const val = entry.value;
      if (val === '') {
        fileReplacePipeline = null;
      } else {
        const parsed = parseReplacePipeline(val, err);
        fileReplacePipeline = parsed;
      }
      return;
    }
    if (entry.key === 'plaster') {
      const val = entry.value;
      if (val === 'unset') {
        err('plaster: invalid setting value on set instruction');
        return;
      }
      filePlasterTemplate = val;
      return;
    }
    if (entry.key === 'class') {
      return;
    }
    if (entry.key === 'title') {
      return;
    }
    const unknown = pn.entries
      .map((e) => e.key)
      .filter((k) => !SET_KNOWN_KEYS.has(k));
    warn(
      `instruction ignored: unrecognized set instruction argument: ${unknown.join(', ')}`,
    );
  };

  const processFragmentBlock = (
    queue: string[],
    unnamed: string,
    namedStr: string,
    linePrefixRaw: string | undefined,
  ): string[] => {
    const namedArgs = parseNamedArgs(namedStr, err);
    if (namedArgs === null) {
      const fb = consumeFenceBlock(queue);
      if (fb.lines.length === 0) {
        err(`reached end of input, expect code block - "${unnamed}"`);
        return [];
      }
      return fb.lines;
    }
    const fragmentArgs = parseFragmentArgs(namedArgs, err);
    const parsed = parsePathAndRegion(unnamed);
    let region = parsed.region;
    const relPath = parsed.path;
    if (fragmentArgs?.regionValue !== undefined) {
      region = normalizeRegionName(fragmentArgs.regionValue);
    }

    const fb = consumeFenceBlock(queue);
    if (fb.lines.length === 0) {
      warn(
        `fragment ignored: reached end of input before code block - "${relPath}"`,
      );
      err(`reached end of input, expect code block - "${relPath}"`);
      return [];
    }

    const [opening, ...mid] = fb.lines;
    const openMatch = CODE_BLOCK_START.exec(opening);
    if (openMatch?.groups?.token === undefined) {
      warn(
        `fragment ignored: code block should immediately follow - "${relPath}"`,
      );
      err(
        `code block should immediately follow - "${relPath}"\n not: ${opening}`,
      );
      return [opening];
    }

    if (!fb.closed) {
      warn(
        `fragment ignored: unterminated markdown code block for "${relPath}"`,
      );
      err(`unterminated markdown code block for "${relPath}"`);
      return fb.lines;
    }

    const closing = mid.pop()!;
    const oldInner = mid;

    if (fragmentArgs === null) {
      return [opening, ...oldInner, closing];
    }

    if (fragmentArgs.hasUnsupportedDiff) {
      err('diff-with / diff-u are not supported in this port');
      return [opening, ...oldInner, closing];
    }

    const resolvedPath = joinPathBase(pathBase, relPath);
    const source = ctx.readFile(resolvedPath, region);
    if (source === null) {
      err(
        ctx.readError?.(resolvedPath, region) ??
          `cannot read source file "${resolvedPath}"`,
      );
      return [opening, ...oldInner, closing];
    }

    const excerptLines = getExcerptRegionLines(
      resolvedPath,
      source,
      region,
      warn,
    );
    if (excerptLines === null) {
      err(`unknown region "${region}" in "${resolvedPath}"`);
      return [opening, ...oldInner, closing];
    }

    let working = [...excerptLines];
    const lang = codeLang(opening, relPath);

    let plasterInput: string | undefined;
    if (fragmentArgs.plasterTemplate === 'unset') {
      err('plaster: invalid setting value on fragment instruction');
      return [opening, ...oldInner, closing];
    } else if (fragmentArgs.plasterTemplate !== undefined) {
      plasterInput = fragmentArgs.plasterTemplate;
    } else {
      plasterInput = filePlasterTemplate ?? ctx.globalPlasterTemplate;
    }
    working = applyPlasterToLines(working, plasterInput, lang);

    working = applyOrderedExcerptTransformOps(
      working,
      fragmentArgs.transformOps,
      err,
    );

    let joined = working.join('\n');
    if (fileReplacePipeline !== null) {
      joined = fileReplacePipeline(joined);
    }
    if (appReplacePipeline !== null) {
      joined = appReplacePipeline(joined);
    }
    working = dropLeadingBlankLines(dropTrailingBlankLines(joined.split('\n')));
    working = maxUnindent(working);

    const parsedIndent = tryParseFragmentIndent(
      fragmentArgs.indentByRaw,
      defaultIndentation,
      err,
    );
    if (!parsedIndent.ok) {
      return [opening, ...oldInner, closing];
    }
    const indentExtra = parsedIndent.value;
    const indentStr = ' '.repeat(indentExtra);

    let linePrefix = linePrefixRaw ?? '';
    linePrefix = normalizeListLinePrefix(linePrefix);

    const escapeNg = ctx.escapeNgInterpolation !== false;
    const innerOut = working.map((line) =>
      escapeNgLine(
        `${linePrefix}${indentStr}${line.replace(/\s+$/, '')}`,
        escapeNg,
      ),
    );

    return [opening, ...innerOut, closing];
  };

  while (lines.length > 0) {
    const line = lines.shift()!;
    out.push(line);
    if (!line.includes('<?code-excerpt')) {
      if (MALFORMED_PI_SPACE_AFTER_XML_OPEN.test(line)) {
        warn(
          'processing instruction ignored: XML processing instructions must start with "<?code-excerpt" (no space after "<?")',
        );
      }
      continue;
    }

    const match = PROC_INSTR_RE.exec(line);
    if (match === null || match.groups === undefined) {
      const loose = PROC_INSTR_BODY.exec(line);
      const restAfterPi =
        loose !== null ? line.slice(loose[0].length).trim() : '';
      if (loose !== null && restAfterPi !== '') {
        warn(
          'processing instruction ignored: extraneous text after closing "?>"',
        );
        continue;
      }
      err(`invalid processing instruction: ${line}`);
      continue;
    }
    if (!match[0].endsWith('?>')) {
      warn('processing instruction must be closed using "?>" syntax');
    }

    const { linePrefix, unnamed, named } = match.groups;
    const namedStr = named ?? '';

    const st = ctx.instructionStats;
    if (st) {
      if (unnamed === undefined) st.set++;
      else st.fragment++;
    }

    if (unnamed === undefined) {
      const namedArgs = parseNamedArgs(namedStr, err);
      if (namedArgs === null) continue;
      handleSetInstruction(namedArgs);
      continue;
    }

    while (lines.length > 0 && /^\s*$/.test(lines[0]!)) {
      out.push(lines.shift()!);
    }

    out.push(...processFragmentBlock(lines, unnamed, namedStr, linePrefix));
  }

  return out.join('\n');
}

import {
  DEFAULT_PLASTER,
  dropLeadingBlankLines,
  dropTrailingBlankLines,
  getExcerptRegionLines,
} from "./extract.js";
import type { InstructionStats } from "./instructionStats.js";
import {
  applyExcerptTransformsInOrder,
  parseIndentBy,
  parseReplacePipeline,
} from "./transform.js";

/**
 * Core `<?code-excerpt ...?>` match from the start of a line (no end-of-line rule).
 * Composed into {@link PROC_INSTR_RE}; also used alone so `injectMarkdown` can detect
 * a well-formed PI followed by **non-whitespace after `?>`** — that case does not match
 * {@link PROC_INSTR_RE}, triggers `onWarning`, and the line is skipped as an instruction.
 */
const PROC_INSTR_BODY =
  /^(?<linePrefix>\s*((?:\/\/\/?|-|\*)\s*)?)?<\?code-excerpt\s*(?:"(?<unnamed>[^"]+)")?(?<named>(?:\s+[-\w]+(?:\s*=\s*"[^"]*")?\s*)*)\??>/;

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

const NAMED_ARG_RE = /^([-\w]+)\s*(=\s*"([^"]*)"\s*|\b)\s*/;

const SET_KNOWN_KEYS = new Set([
  "path-base",
  "replace",
  "plaster",
  "class",
  "title",
]);

interface ParsedNamedArgs {
  map: Map<string, string>;
  /** Keys present as bare flags (`plaster` with no `=`). */
  flags: Set<string>;
  /** First-occurrence order of every named key (insertion order in the PI). */
  keyOrder: string[];
}

/** Backtick fences or Liquid `{% prettify ... %}` only (not arbitrary `{% ... %}` tags). */
const CODE_BLOCK_START = /^\s*(?:\/\/\/?)?\s*(```|{%-?\s*prettify(\s+.*)?-?%})/;
const CODE_BLOCK_END = /^\s*(?:\/\/\/?)?\s*(```)/;
const CODE_BLOCK_END_PRETTIFY =
  /^\s*(?:\/\/\/?)?\s*({%-?\s*endprettify\s*-?%})/;

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
  /** Initial `path-base` (directory prefix for excerpt sources). */
  pathBase?: string;
  /**
   * When `true`, applies language-specific plaster templates in YAML excerpt
   * mode (default `false`, legacy fragment-style behavior).
   */
  excerptsYaml?: boolean;
  /** Default extra spaces when `indent-by` is omitted on a fragment directive. */
  defaultIndentation?: number;
  /**
   * Global replace expression. Applied after per-instruction transforms and
   * file-level set `replace`, on the joined excerpt string.
   */
  globalReplace?: string;
  /**
   * Default plaster template when neither the PI nor a file-level `plaster` set
   * instruction overrides it.
   */
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
  const trimmed = relPath.trim().replace(/\\/g, "/");
  const base = pathBase.trim().replace(/\\/g, "/");
  if (!base) return trimmed.replace(/\/+/g, "/");
  const sep = base.endsWith("/") ? "" : "/";
  return `${base}${sep}${trimmed}`.replace(/\/+/g, "/");
}

function fileExtensionLower(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const base = normalized.includes("/")
    ? normalized.slice(normalized.lastIndexOf("/") + 1)
    : normalized;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

function normalizeListLinePrefix(prefix: string): string {
  for (const c of ["-", "*"]) {
    if (prefix.includes(c)) {
      return prefix.replace(c, " ");
    }
  }
  return prefix;
}

function parseNamedArgs(
  named: string,
  onError?: (msg: string) => void,
): ParsedNamedArgs {
  const map = new Map<string, string>();
  const flags = new Set<string>();
  const keyOrder: string[] = [];
  let rest = named.trim();
  while (rest.length > 0) {
    const m = NAMED_ARG_RE.exec(rest);
    if (m === null) {
      onError?.(`instruction argument parsing failure at/around: ${rest}`);
      break;
    }
    const key = m[1]!;
    const eqOrBare = m[2] ?? "";
    if (!keyOrder.includes(key)) keyOrder.push(key);
    if (eqOrBare.trimStart().startsWith("=")) {
      map.set(key, m[3] ?? "");
    } else {
      flags.add(key);
    }
    rest = rest.slice(m[0].length);
  }
  return { map, flags, keyOrder };
}

function normalizeRegionName(region: string): string {
  return region.replace(NON_WORD, "-");
}

function parsePathAndRegion(unnamed: string): { path: string; region: string } {
  const m = REGION_IN_PATH.exec(unnamed);
  if (m === null) {
    return { path: unnamed.trim(), region: "" };
  }
  const idx = m.index ?? 0;
  return {
    path: unnamed.slice(0, idx).trim(),
    region: normalizeRegionName(m[1]),
  };
}

function codeLang(openingFenceLine: string, path: string): string {
  const fence = /(?:```|prettify\s+)(\w+)/.exec(openingFenceLine);
  if (fence !== null) return fence[1];
  return fileExtensionLower(path);
}

/** Escapes Angular-style `{{` / `}}` as `{!{` / `}!}` when enabled. */
function escapeNgLine(line: string, enabled: boolean): string {
  if (!enabled) return line;
  return line.replace(/\{\{|\}\}/g, (m) => (m === "{{" ? "{!{" : "}!}"));
}

function plasterTemplateForLang(lang: string): string | null {
  switch (lang) {
    case "css":
    case "scss":
      return `/* ${DEFAULT_PLASTER} */`;
    case "html":
      return `<!-- ${DEFAULT_PLASTER} -->`;
    case "dart":
    case "js":
    case "ts":
      return `// ${DEFAULT_PLASTER}`;
    case "yaml":
    case "yml":
      return `# ${DEFAULT_PLASTER}`;
    default:
      return null;
  }
}

/**
 * Plaster pass: `plaster="none"` removes default-plaster lines; if `excerptsYaml`
 * is false, returns lines unchanged; otherwise substitutes language templates
 * around `DEFAULT_PLASTER`.
 */
function applyPlasterToLines(
  lines: string[],
  plasterTemplate: string | undefined,
  lang: string,
  excerptsYaml: boolean,
): string[] {
  if (plasterTemplate === "none") {
    return lines.filter((line) => !line.includes(DEFAULT_PLASTER));
  }
  if (!excerptsYaml) {
    return lines;
  }
  let tpl: string | null =
    plasterTemplate !== undefined && plasterTemplate !== ""
      ? plasterTemplate.replaceAll("$defaultPlaster", DEFAULT_PLASTER)
      : null;
  if (tpl === null || tpl === "") {
    const def = plasterTemplateForLang(lang);
    if (def === null) return lines;
    tpl = def;
  }
  const joined = lines.join("\n");
  return joined.split(DEFAULT_PLASTER).join(tpl).split("\n");
}

function parseIndentForBlock(
  raw: string | undefined,
  defaultIndentation: number,
  onError?: (msg: string) => void,
): number {
  if (raw === undefined) return defaultIndentation;
  return parseIndentBy(raw, onError);
}

/** Consumes a markdown code fence (opening through closing) from `queue`. */
function consumeFenceBlock(queue: string[]): {
  closed: boolean;
  lines: string[];
} {
  if (queue.length === 0) return { closed: false, lines: [] };
  const opening = queue.shift()!;
  const openMatch = CODE_BLOCK_START.exec(opening);
  if (openMatch === null || openMatch[1] === undefined) {
    return { closed: false, lines: [opening] };
  }
  const useBacktickEnd = openMatch[1].startsWith("`");
  const endRe = useBacktickEnd ? CODE_BLOCK_END : CODE_BLOCK_END_PRETTIFY;
  const inner: string[] = [];
  while (queue.length > 0) {
    const line = queue[0]!;
    const em = endRe.exec(line);
    if (em?.[1]) {
      queue.shift();
      return { closed: true, lines: [opening, ...inner, line] };
    }
    inner.push(queue.shift()!);
  }
  return { closed: false, lines: [opening, ...inner] };
}

/**
 * Updates markdown in memory: each `<?code-excerpt ...?>` followed by a fenced
 * (backtick) or Liquid `{% prettify %}` code block is replaced with freshly extracted
 * (and transformed) lines.
 */
export function injectMarkdown(
  markdown: string,
  ctx: MarkdownInjectContext,
): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let pathBase = ctx.pathBase ?? "";
  const excerptsYaml = ctx.excerptsYaml ?? false;
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
  if (gr !== undefined && gr !== "") {
    const parsed = parseReplacePipeline(gr, err);
    if (parsed === null) {
      throw new Error(
        `invalid global replace expression: ${JSON.stringify(gr)}`,
      );
    }
    appReplacePipeline = parsed;
  }

  const handleSetInstruction = (pn: ParsedNamedArgs): void => {
    const nKeys = pn.map.size + pn.flags.size;
    if (nKeys > 1) {
      err("set instruction should have at most one argument");
      return;
    }
    if (nKeys === 0) {
      return;
    }
    if (pn.map.has("path-base")) {
      pathBase = pn.map.get("path-base") ?? "";
      return;
    }
    if (pn.map.has("replace")) {
      const val = pn.map.get("replace") ?? "";
      if (val === "") {
        fileReplacePipeline = null;
      } else {
        const parsed = parseReplacePipeline(val, err);
        fileReplacePipeline = parsed;
      }
      return;
    }
    if (pn.map.has("plaster") || pn.flags.has("plaster")) {
      filePlasterTemplate = pn.flags.has("plaster")
        ? undefined
        : pn.map.get("plaster");
      return;
    }
    if (nKeys === 1 && pn.map.has("class")) {
      return;
    }
    if (nKeys === 1 && (pn.map.has("title") || pn.flags.has("title"))) {
      return;
    }
    const unknown = [...pn.map.keys(), ...pn.flags].filter(
      (k) => !SET_KNOWN_KEYS.has(k),
    );
    warn(
      `instruction ignored: unrecognized set instruction argument: ${unknown.join(", ")}`,
    );
  };

  const processFragmentBlock = (
    queue: string[],
    unnamed: string,
    namedStr: string,
    linePrefixRaw: string | undefined,
  ): string[] => {
    const namedArgs = parseNamedArgs(namedStr, err);
    const parsed = parsePathAndRegion(unnamed);
    let region = parsed.region;
    const relPath = parsed.path;
    if (namedArgs.map.has("region")) {
      region = normalizeRegionName(namedArgs.map.get("region")!);
    }

    const fb = consumeFenceBlock(queue);
    if (fb.lines.length === 0) {
      err(`reached end of input, expect code block - "${relPath}"`);
      return [];
    }

    const [opening, ...mid] = fb.lines;
    const openMatch = CODE_BLOCK_START.exec(opening);
    if (openMatch === null || openMatch[1] === undefined) {
      err(
        `code block should immediately follow - "${relPath}"\n not: ${opening}`,
      );
      return [opening];
    }

    if (!fb.closed) {
      err(`unterminated markdown code block for "${relPath}"`);
      return fb.lines;
    }

    const closing = mid.pop()!;
    const oldInner = mid;

    if (namedArgs.map.has("diff-with") || namedArgs.map.has("diff-u")) {
      err("diff-with / diff-u are not supported in this port");
      return [opening, ...oldInner, closing];
    }

    const resolvedPath = joinPathBase(pathBase, relPath);
    const source = ctx.readFile(resolvedPath, region);
    if (source === null) {
      err(`cannot read source file "${resolvedPath}"`);
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
    if (namedArgs.flags.has("plaster")) {
      plasterInput = undefined;
    } else if (namedArgs.map.has("plaster")) {
      plasterInput = namedArgs.map.get("plaster");
    } else {
      plasterInput = filePlasterTemplate ?? ctx.globalPlasterTemplate;
    }
    working = applyPlasterToLines(working, plasterInput, lang, excerptsYaml);

    working = applyExcerptTransformsInOrder(
      working,
      namedArgs.keyOrder,
      namedArgs.map,
      err,
    );

    let joined = working.join("\n");
    if (fileReplacePipeline !== null) {
      joined = fileReplacePipeline(joined);
    }
    if (appReplacePipeline !== null) {
      joined = appReplacePipeline(joined);
    }
    working = dropLeadingBlankLines(dropTrailingBlankLines(joined.split("\n")));

    const indentExtra = parseIndentForBlock(
      namedArgs.map.get("indent-by"),
      defaultIndentation,
      err,
    );
    const indentStr = " ".repeat(indentExtra);

    let linePrefix = linePrefixRaw ?? "";
    linePrefix = normalizeListLinePrefix(linePrefix);

    const escapeNg = ctx.escapeNgInterpolation !== false;
    const innerOut = working.map((line) =>
      escapeNgLine(
        `${linePrefix}${indentStr}${line}`.replace(/\s+$/, ""),
        escapeNg,
      ),
    );

    return [opening, ...innerOut, closing];
  };

  while (lines.length > 0) {
    const line = lines.shift()!;
    out.push(line);
    if (!line.includes("<?code-excerpt")) continue;

    const match = PROC_INSTR_RE.exec(line);
    if (match === null || match.groups === undefined) {
      const loose = PROC_INSTR_BODY.exec(line);
      const restAfterPi =
        loose !== null ? line.slice(loose[0].length).trim() : "";
      if (loose !== null && restAfterPi !== "") {
        warn(
          'processing instruction ignored: extraneous text after closing "?>"',
        );
        continue;
      }
      err(`invalid processing instruction: ${line}`);
      continue;
    }
    if (!match[0].endsWith("?>")) {
      warn('processing instruction must be closed using "?>" syntax');
    }

    const { linePrefix, unnamed, named } = match.groups;
    const namedStr = named ?? "";

    const st = ctx.instructionStats;
    if (st) {
      if (unnamed === undefined) st.set++;
      else st.fragment++;
    }

    if (unnamed === undefined) {
      handleSetInstruction(parseNamedArgs(namedStr, err));
      continue;
    }

    while (lines.length > 0 && /^\s*$/.test(lines[0]!)) {
      out.push(lines.shift()!);
    }

    out.push(...processFragmentBlock(lines, unnamed, namedStr, linePrefix));
  }

  return out.join("\n");
}

/**
 * Compiles CLI `--exclude` string arguments into {@link RegExp} instances.
 * Malformed patterns return a single error string instead of throwing.
 */

export type CompileExcludePatternsResult =
  | { ok: true; patterns: RegExp[] }
  | { ok: false; error: string };

/**
 * Builds one {@link RegExp} per string. On the first invalid pattern, returns
 * `{ ok: false, error }` with a one-line message suitable for `console.error`.
 */
export function compileExcludePatterns(
  strings: string[],
): CompileExcludePatternsResult {
  const patterns: RegExp[] = [];
  for (let i = 0; i < strings.length; i++) {
    const s = strings[i]!;
    try {
      patterns.push(new RegExp(s));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `error: invalid --exclude pattern ${JSON.stringify(s)}: ${detail}`,
      };
    }
  }
  return { ok: true, patterns };
}

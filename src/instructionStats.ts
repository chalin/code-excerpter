/**
 * Counts of **parsed** strict-line `<?code-excerpt …?>` directives (a strict-line
 * match; the directive may still error afterward).
 *
 * `updatePaths` shares one instance across every `injectMarkdown` call and
 * returns it on `UpdateResult.instructionStats`. Callers using
 * `injectMarkdown` only may supply their own object on the inject context for
 * optional totals.
 */
export interface InstructionStats {
  /** Set-only directives (`path-base`, `replace`, `plaster`, etc.). */
  set: number;
  /** Fragment directives (quoted path + following code fence). */
  fragment: number;
}

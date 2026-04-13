// Public API
export {
  type Directive,
  type DirectiveKind,
  tryParseDirective,
} from "./directive.js";
export {
  DEFAULT_PLASTER,
  dropLeadingBlankLines,
  dropTrailingBlankLines,
  extractExcerpts,
  getExcerptRegionLines,
  maxUnindent,
} from "./extract.js";
export { type InstructionStats } from "./instructionStats.js";
export {
  injectMarkdown,
  type MarkdownInjectContext,
  PROC_INSTR_RE,
} from "./inject.js";
export {
  applyExcerptTransforms,
  applyExcerptTransformsInOrder,
  applyFrom,
  applyRemove,
  applyRetain,
  applySkip,
  applyTake,
  applyTo,
  encodeSlashChar,
  type ExcerptTransformOptions,
  type LinePredicate,
  parseReplacePipeline,
  patternToLinePredicate,
} from "./transform.js";
export {
  type UpdateOptions,
  type UpdateResult,
  updatePaths,
} from "./update.js";

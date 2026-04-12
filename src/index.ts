// Public API
export {
  type Directive,
  type DirectiveKind,
  tryParseDirective,
} from "./directive.js";
export {
  DEFAULT_PLASTER,
  dropTrailingBlankLines,
  extractExcerpts,
  maxUnindent,
} from "./extract.js";
export {
  applyExcerptTransforms,
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

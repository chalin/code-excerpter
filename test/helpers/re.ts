/**
 * Tagged template: builds a `RegExp` from a raw pattern (equivalent to
 * wrapping `String.raw` with `new RegExp(...)`).
 */
export function re(
  strings: TemplateStringsArray,
  ...values: unknown[]
): RegExp {
  return new RegExp(String.raw(strings, ...values));
}

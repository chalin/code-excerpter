export function re(
  strings: TemplateStringsArray,
  ...parts: Array<string | RegExp>
): RegExp {
  const source = String.raw(
    strings,
    ...parts.map((part) => (part instanceof RegExp ? part.source : part)),
  );
  return new RegExp(source);
}

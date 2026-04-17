import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const YAML_BLOCK_KEY_RE = /^'([^']*)':\s*\|\+\s*$/;
const YAML_SCALAR_KEY_RE = /^'([^']*)':\s*'([^']*)'\s*$/;

/**
 * Parses the limited `.excerpt.yaml` subset currently supported by the disk
 * updater path:
 *
 * - quoted keys of the form `'key': |+`
 * - quoted scalar values of the form `'key': 'value'`
 * - two-space-indented block content
 *
 * This intentionally models the excerpt-yaml fixtures carried forward from the
 * original Dart updater, not arbitrary YAML.
 */
export function parseExcerptYamlMap(
  content: string,
): Map<string, string> | null {
  const result = new Map<string, string>();
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const block = YAML_BLOCK_KEY_RE.exec(line);
    if (block === null) {
      const scalar = YAML_SCALAR_KEY_RE.exec(line);
      if (scalar !== null) {
        result.set(scalar[1]!, scalar[2] ?? '');
        i += 1;
        continue;
      }
      return null;
    }

    const key = block[1]!;
    i += 1;

    const valueLines: string[] = [];
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (next.startsWith('  ')) {
        valueLines.push(next.slice(2));
        i += 1;
        continue;
      }
      if (next.trim() === '') {
        valueLines.push('');
        i += 1;
        continue;
      }
      break;
    }

    while (valueLines.length > 0 && valueLines[valueLines.length - 1] === '') {
      valueLines.pop();
    }
    result.set(key, valueLines.join('\n'));
  }

  return result;
}

export function stripExcerptYamlBorder(
  content: string,
  border: string,
): string {
  if (border === '') return content;
  return content
    .split('\n')
    .map((line) => (line.startsWith(border) ? line.slice(1) : line))
    .join('\n');
}

export function readExcerptYamlSync(
  readFile: (path: string, encoding: 'utf8') => string,
  yamlPath: string,
  region: string,
  borderKey = '#border',
): string | null {
  const doc = parseExcerptYamlMap(readFile(yamlPath, 'utf8'));
  if (doc === null) return null;
  const raw = doc.get(region);
  if (raw === undefined) return null;
  const border = doc.get(borderKey) ?? '';
  return stripExcerptYamlBorder(raw, border).trimEnd();
}

/** Filename suffix for excerpt sidecar files (e.g. `lib/a.dart.excerpt.yaml`). */
export const EXCERPT_YAML_EXT = '.excerpt.yaml';

/**
 * If `<resolvedPath>.excerpt.yaml` exists under `srcRoot`, returns the region
 * excerpt (or `null` when the region is missing). Returns `null` when there is
 * no sidecar file so callers can fall back to reading the plain source path.
 */
export function tryReadExcerptYamlSidecar(
  srcRoot: string,
  resolvedPath: string,
  region: string,
): string | null {
  const yamlPath = resolve(srcRoot, resolvedPath + EXCERPT_YAML_EXT);
  if (!existsSync(yamlPath)) return null;
  return readExcerptYamlSync(readFileSync, yamlPath, region);
}
